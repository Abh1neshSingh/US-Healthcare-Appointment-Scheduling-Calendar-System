import asyncio
from contextlib import suppress

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.database.connection import get_db

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule
from app.models.schedule_exception import ScheduleException
from app.models.patient import Patient
from app.models.referral import Referral

from app.schemas.appointment import (
    AppointmentCreate,
    StaffAppointmentCreate,
)

from app.services.email_service import (
    send_appointment_confirmation_email,
)


router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
)


# ==================================================
# TIMEZONE HELPERS
# ==================================================

STATE_TIMEZONES = {
    "AL": "America/Chicago",
    "AK": "America/Anchorage",
    "AZ": "America/Phoenix",
    "AR": "America/Chicago",
    "CA": "America/Los_Angeles",
    "CO": "America/Denver",
    "CT": "America/Chicago",
    "DE": "America/New_York",
    "FL": "America/New_York",
    "GA": "America/New_York",
    "HI": "Pacific/Honolulu",
    "ID": "America/Denver",
    "IL": "America/Chicago",
    "IN": "America/Indiana/Indianapolis",
    "IA": "America/Chicago",
    "KS": "America/Chicago",
    "KY": "America/New_York",
    "LA": "America/Chicago",
    "ME": "America/New_York",
    "MD": "America/New_York",
    "MA": "America/New_York",
    "MI": "America/Detroit",
    "MN": "America/Chicago",
    "MS": "America/Chicago",
    "MO": "America/Chicago",
    "MT": "America/Denver",
    "NE": "America/Chicago",
    "NV": "America/Los_Angeles",
    "NH": "America/New_York",
    "NJ": "America/New_York",
    "NM": "America/Denver",
    "NY": "America/New_York",
    "NC": "America/New_York",
    "ND": "America/Chicago",
    "OH": "America/New_York",
    "OK": "America/Chicago",
    "OR": "America/Los_Angeles",
    "PA": "America/New_York",
    "RI": "America/New_York",
    "SC": "America/New_York",
    "SD": "America/Chicago",
    "TN": "America/Chicago",
    "TX": "America/Chicago",
    "UT": "America/Denver",
    "VT": "America/New_York",
    "VA": "America/New_York",
    "WA": "America/Los_Angeles",
    "WV": "America/New_York",
    "WI": "America/Chicago",
    "WY": "America/Denver",
}


# ==================================================
# APPOINTMENT STATUS
# ==================================================

ACTIVE_APPOINTMENT_STATUSES = (
    "SCHEDULED",
    "CONFIRMED",
)

STAFF_MANAGED_STATUSES = {
    "SCHEDULED",
    "CONFIRMED",
    "CHECKED_IN",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
}


# --------------------------------------------------
# Human-readable status labels
#
# Database values remain unchanged so existing
# frontend/database logic does not break.
# --------------------------------------------------

APPOINTMENT_STATUS_LABELS = {
    "SCHEDULED": "Waiting",
    "CONFIRMED": "Waiting",
    "CHECKED_IN": "Attended",
    "IN_PROGRESS": "With Doctor",
    "COMPLETED": "Completed",
    "CANCELLED": "Cancelled",
    "NO_SHOW": "Not Attended",
}


class AppointmentStatusUpdate(BaseModel):
    status: str


# ==================================================
# STATUS HELPERS
# ==================================================

def get_appointment_status_label(
    status: str | None,
) -> str:
    """
    Convert internal appointment status into the
    business/UI status label.

    Internal database statuses are intentionally
    preserved for backward compatibility.
    """

    normalized_status = (
        str(status or "")
        .strip()
        .upper()
    )

    return APPOINTMENT_STATUS_LABELS.get(
        normalized_status,
        normalized_status.title()
        if normalized_status
        else "Unknown",
    )


# ==================================================
# BACKGROUND APPOINTMENT LIFECYCLE
# ==================================================

APPOINTMENT_LIFECYCLE_INTERVAL_SECONDS = 30

_lifecycle_task: asyncio.Task | None = None
_lifecycle_stop_event: asyncio.Event | None = None


async def _appointment_lifecycle_loop() -> None:
    """
    Periodically normalize expired appointments.

    Every cycle opens its own SQLAlchemy session, so the
    background task never reuses a request-scoped session.
    """

    while (
        _lifecycle_stop_event is not None
        and not _lifecycle_stop_event.is_set()
    ):
        db_generator = None

        try:
            db_generator = get_db()
            db = next(db_generator)

            mark_expired_appointments_as_no_show(db)

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            print(
                "Appointment lifecycle worker error:",
                exc,
            )

        finally:
            if db_generator is not None:
                with suppress(Exception):
                    db_generator.close()

        try:
            await asyncio.wait_for(
                _lifecycle_stop_event.wait(),
                timeout=APPOINTMENT_LIFECYCLE_INTERVAL_SECONDS,
            )
        except asyncio.TimeoutError:
            continue


@router.on_event("startup")
async def start_appointment_lifecycle_worker() -> None:
    """
    Start one lifecycle task when the FastAPI application starts.
    """

    global _lifecycle_task
    global _lifecycle_stop_event

    if (
        _lifecycle_task is not None
        and not _lifecycle_task.done()
    ):
        return

    _lifecycle_stop_event = asyncio.Event()

    _lifecycle_task = asyncio.create_task(
        _appointment_lifecycle_loop()
    )


@router.on_event("shutdown")
async def stop_appointment_lifecycle_worker() -> None:
    """
    Stop the lifecycle task cleanly during application shutdown.
    """

    global _lifecycle_task
    global _lifecycle_stop_event

    if _lifecycle_stop_event is not None:
        _lifecycle_stop_event.set()

    if _lifecycle_task is not None:
        with suppress(asyncio.CancelledError):
            await _lifecycle_task

    _lifecycle_task = None
    _lifecycle_stop_event = None


# ==================================================
# DOCTOR TIMEZONE
# ==================================================

def get_doctor_timezone(
    doctor: Doctor,
) -> ZoneInfo:
    """
    Get doctor's local timezone from clinic state.
    """

    state = (
        (doctor.state or "")
        .strip()
        .upper()
    )

    timezone_name = STATE_TIMEZONES.get(
        state,
        "America/New_York",
    )

    return ZoneInfo(timezone_name)


def get_current_doctor_datetime(
    doctor: Doctor,
) -> datetime:
    """
    Return current date/time in doctor's local timezone.
    """

    timezone = get_doctor_timezone(doctor)

    return datetime.now(timezone)


# ==================================================
# APPOINTMENT DATETIME HELPERS
# ==================================================

def get_appointment_start_datetime(
    appointment: Appointment,
    doctor: Doctor,
) -> datetime:
    """
    Convert appointment start date/time into
    doctor's local timezone.
    """

    timezone = get_doctor_timezone(doctor)

    return datetime.combine(
        appointment.appointment_date,
        appointment.start_time,
    ).replace(
        tzinfo=timezone
    )


def get_appointment_end_datetime(
    appointment: Appointment,
    doctor: Doctor,
) -> datetime:
    """
    Convert appointment end date/time into
    doctor's local timezone.
    """

    timezone = get_doctor_timezone(doctor)

    return datetime.combine(
        appointment.appointment_date,
        appointment.end_time,
    ).replace(
        tzinfo=timezone
    )


def is_past_slot(
    appointment_date: date,
    slot_start,
    doctor: Doctor,
) -> bool:
    """
    Check whether a slot has already started.
    """

    doctor_now = get_current_doctor_datetime(
        doctor
    )

    if appointment_date < doctor_now.date():
        return True

    if appointment_date > doctor_now.date():
        return False

    current_datetime = datetime.combine(
        appointment_date,
        slot_start,
    ).replace(
        tzinfo=doctor_now.tzinfo
    )

    return current_datetime <= doctor_now


# ==================================================
# AUTOMATIC NO-SHOW PROCESSING
# ==================================================

def mark_expired_appointments_as_no_show(
    db: Session,
    doctor: Doctor | None = None,
    patient_id: int | None = None,
) -> int:
    """
    Automatically mark appointments as NO_SHOW only
    after their scheduled END TIME has passed.

    Lifecycle rule:

        SCHEDULED / CONFIRMED
                    |
                    | end_time passed
                    v
                 NO_SHOW
             (Not Attended)

    Important:
    - SCHEDULED / CONFIRMED -> NO_SHOW
    - CHECKED_IN is never changed to NO_SHOW
    - IN_PROGRESS is never changed to NO_SHOW
    - COMPLETED is never changed to NO_SHOW
    - CANCELLED is never changed to NO_SHOW
    - Existing NO_SHOW remains unchanged
    """

    query = db.query(Appointment)

    if doctor is not None:
        query = query.filter(
            Appointment.doctor_id == doctor.id
        )

    if patient_id is not None:
        query = query.filter(
            Appointment.patient_id == patient_id
        )

    appointments = (
        query
        .filter(
            Appointment.status.in_(
                ACTIVE_APPOINTMENT_STATUSES
            )
        )
        .all()
    )

    changed_count = 0

    for appointment in appointments:

        appointment_doctor = (
            doctor
            if doctor is not None
            else appointment.doctor
        )

        if appointment_doctor is None:
            continue

        doctor_now = get_current_doctor_datetime(
            appointment_doctor
        )

        appointment_end = (
            get_appointment_end_datetime(
                appointment,
                appointment_doctor,
            )
        )

        # ------------------------------------------
        # IMPORTANT:
        # Only the END TIME can automatically make
        # a waiting appointment Not Attended.
        # ------------------------------------------

        if doctor_now >= appointment_end:

            appointment.status = "NO_SHOW"

            changed_count += 1

    if changed_count > 0:
        db.commit()

    return changed_count


# ==================================================
# DOCTOR AVAILABILITY
# ==================================================

@router.get("/availability")
def get_doctor_availability(
    doctor_id: int = Query(...),
    appointment_date: date = Query(...),
    current_user=Depends(
        require_roles(
            ["PATIENT", "ADMIN", "RECEPTIONIST"]
        )
    ),
    db: Session = Depends(get_db),
):

    doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id == doctor_id,
            Doctor.active.is_(True),
        )
        .first()
    )

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    # ----------------------------------------------
    # Automatically clean expired appointments
    # ----------------------------------------------

    mark_expired_appointments_as_no_show(
        db,
        doctor=doctor,
    )

    doctor_now = get_current_doctor_datetime(
        doctor
    )

    day_of_week = appointment_date.strftime(
        "%A"
    )

    # ----------------------------------------------
    # Past date
    # ----------------------------------------------

    if appointment_date < doctor_now.date():

        return {
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.name,
            "requires_referral": doctor.requires_referral,
            "date": appointment_date,
            "day": day_of_week,
            "available": False,
            "total_slots": 0,
            "available_slots": 0,
            "booked_slots": 0,
            "slots": [],
            "message": (
                "Appointments cannot be booked "
                "for a past date."
            ),
        }

    # ----------------------------------------------
    # Check schedule exception
    # ----------------------------------------------

    exception = (
        db.query(ScheduleException)
        .filter(
            ScheduleException.doctor_id == doctor_id,
            ScheduleException.exception_date
            == appointment_date,
        )
        .first()
    )

    if exception and not exception.is_available:

        return {
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.name,
            "requires_referral": doctor.requires_referral,
            "date": appointment_date,
            "day": day_of_week,
            "available": False,
            "total_slots": 0,
            "available_slots": 0,
            "booked_slots": 0,
            "slots": [],
            "message": (
                exception.reason
                or "Doctor is unavailable on this date."
            ),
        }

    # ----------------------------------------------
    # Find regular schedule
    # ----------------------------------------------

    schedules = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.day_of_week == day_of_week,
            DoctorSchedule.is_available.is_(True),
        )
        .all()
    )

    if not schedules:

        return {
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.name,
            "requires_referral": doctor.requires_referral,
            "date": appointment_date,
            "day": day_of_week,
            "available": False,
            "total_slots": 0,
            "available_slots": 0,
            "booked_slots": 0,
            "slots": [],
            "message": (
                "Doctor is not available on this day."
            ),
        }

    # ----------------------------------------------
    # Get existing active appointments
    #
    # NO_SHOW / CANCELLED appointments do not block
    # the slot.
    # ----------------------------------------------

    existing_appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date
            == appointment_date,
            Appointment.status.in_(
                ACTIVE_APPOINTMENT_STATUSES
            ),
        )
        .all()
    )

    # ----------------------------------------------
    # Generate slots
    # ----------------------------------------------

    slots = []

    for schedule in schedules:

        current_time = datetime.combine(
            appointment_date,
            schedule.start_time,
        )

        schedule_end = datetime.combine(
            appointment_date,
            schedule.end_time,
        )

        while current_time < schedule_end:

            slot_start = current_time.time()

            slot_end_datetime = (
                current_time
                + timedelta(
                    minutes=schedule.slot_duration
                )
            )

            slot_end = slot_end_datetime.time()

            if slot_end_datetime > schedule_end:
                break

            # --------------------------------------
            # Check lunch/break
            # --------------------------------------

            is_break = bool(
                schedule.break_start
                and schedule.break_end
                and schedule.break_start
                <= slot_start
                < schedule.break_end
            )

            if is_break:
                current_time = slot_end_datetime
                continue

            # --------------------------------------
            # Check if slot is in the past
            # --------------------------------------

            past_slot = is_past_slot(
                appointment_date,
                slot_start,
                doctor,
            )

            # --------------------------------------
            # Check existing appointment
            # --------------------------------------

            is_booked = any(
                slot_start < appointment.end_time
                and slot_end > appointment.start_time
                for appointment in existing_appointments
            )

            # --------------------------------------
            # Determine slot status
            # --------------------------------------

            slot_status = (
                "booked"
                if is_booked or past_slot
                else "available"
            )

            slots.append(
                {
                    "start_time": slot_start.strftime(
                        "%H:%M"
                    ),
                    "end_time": slot_end.strftime(
                        "%H:%M"
                    ),
                    "status": slot_status,
                }
            )

            current_time = slot_end_datetime

    # ----------------------------------------------
    # Calculate summary
    # ----------------------------------------------

    total_slots = len(slots)

    booked_slots = len(
        [
            slot
            for slot in slots
            if slot["status"] == "booked"
        ]
    )

    available_slots = (
        total_slots - booked_slots
    )

    # ----------------------------------------------
    # Return availability
    # ----------------------------------------------

    return {
        "doctor_id": doctor_id,
        "doctor_name": doctor.user.name,
        "requires_referral": doctor.requires_referral,
        "date": appointment_date,
        "day": day_of_week,
        "available": available_slots > 0,
        "total_slots": total_slots,
        "available_slots": available_slots,
        "booked_slots": booked_slots,
        "slots": slots,
    }


# ==================================================
# CREATE APPOINTMENT
# ==================================================

@router.post(
    "",
    status_code=201,
)
def create_appointment(
    appointment_data: AppointmentCreate,
    current_user=Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
):

    # ----------------------------------------------
    # Find logged-in patient
    # ----------------------------------------------

    patient = (
        db.query(Patient)
        .filter(
            Patient.user_id
            == int(current_user["user_id"])
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found",
        )

    # ----------------------------------------------
    # Check doctor
    # ----------------------------------------------

    doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id
            == appointment_data.doctor_id,
            Doctor.active.is_(True),
        )
        .first()
    )

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    # ----------------------------------------------
    # Clean expired appointments before booking
    # ----------------------------------------------

    mark_expired_appointments_as_no_show(
        db,
        doctor=doctor,
    )

    # ----------------------------------------------
    # Get appointment date
    # ----------------------------------------------

    appointment_date = (
        appointment_data.appointment_date
    )

    # ----------------------------------------------
    # Check patient insurance
    # ----------------------------------------------

    has_insurance = (
        bool(patient.insurance_provider)
        or bool(patient.insurance_member_id)
    )

    # ----------------------------------------------
    # Referral check
    # ----------------------------------------------

    if doctor.requires_referral and has_insurance:

        valid_referral = (
            db.query(Referral)
            .filter(
                Referral.patient_id == patient.id,
                Referral.specialist_doctor_id
                == doctor.id,
                Referral.status == "ACTIVE",
                Referral.issued_date
                <= appointment_date,
                or_(
                    Referral.expiry_date.is_(None),
                    Referral.expiry_date
                    >= appointment_date,
                ),
            )
            .order_by(
                Referral.created_at.desc()
            )
            .first()
        )

        if not valid_referral:
            raise HTTPException(
                status_code=400,
                detail=(
                    "A valid referral is required "
                    "before booking an appointment "
                    "with this doctor."
                ),
            )

        # ------------------------------------------
        # Prior authorization check
        # ------------------------------------------

        if (
            valid_referral.authorization_required
            and valid_referral.authorization_status
            != "APPROVED"
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Prior authorization is required "
                    "and has not been approved yet."
                ),
            )

    # ----------------------------------------------
    # Get doctor's current local date/time
    # ----------------------------------------------

    doctor_now = get_current_doctor_datetime(
        doctor
    )

    # ----------------------------------------------
    # Reject past date
    # ----------------------------------------------

    if appointment_date < doctor_now.date():

        raise HTTPException(
            status_code=400,
            detail=(
                "Appointments cannot be booked "
                "for a past date."
            ),
        )

    # ----------------------------------------------
    # Reject past time for today
    # ----------------------------------------------

    if appointment_date == doctor_now.date():

        selected_datetime = datetime.combine(
            appointment_date,
            appointment_data.start_time,
        ).replace(
            tzinfo=doctor_now.tzinfo
        )

        if selected_datetime <= doctor_now:

            raise HTTPException(
                status_code=400,
                detail=(
                    "This appointment time has "
                    "already passed."
                ),
            )

    # ----------------------------------------------
    # Check schedule exception
    # ----------------------------------------------

    exception = (
        db.query(ScheduleException)
        .filter(
            ScheduleException.doctor_id
            == appointment_data.doctor_id,
            ScheduleException.exception_date
            == appointment_date,
        )
        .first()
    )

    if exception and not exception.is_available:

        raise HTTPException(
            status_code=400,
            detail=(
                exception.reason
                or "Doctor is unavailable on this date."
            ),
        )

    # ----------------------------------------------
    # Find regular schedule
    # ----------------------------------------------

    day_of_week = appointment_date.strftime(
        "%A"
    )

    schedules = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id
            == appointment_data.doctor_id,
            DoctorSchedule.day_of_week
            == day_of_week,
            DoctorSchedule.is_available.is_(True),
        )
        .all()
    )

    if not schedules:

        raise HTTPException(
            status_code=400,
            detail=(
                "Doctor is not available on this day."
            ),
        )

    # ----------------------------------------------
    # Validate selected time slot
    # ----------------------------------------------

    valid_slot = False

    for schedule in schedules:

        current_time = datetime.combine(
            appointment_date,
            schedule.start_time,
        )

        schedule_end = datetime.combine(
            appointment_date,
            schedule.end_time,
        )

        while current_time < schedule_end:

            slot_start = current_time.time()

            slot_end_datetime = (
                current_time
                + timedelta(
                    minutes=schedule.slot_duration
                )
            )

            slot_end = slot_end_datetime.time()

            if slot_end_datetime > schedule_end:
                break

            # --------------------------------------
            # Skip lunch/break
            # --------------------------------------

            is_break = bool(
                schedule.break_start
                and schedule.break_end
                and schedule.break_start
                <= slot_start
                < schedule.break_end
            )

            # --------------------------------------
            # Match requested slot
            # --------------------------------------

            if (
                not is_break
                and appointment_data.start_time
                == slot_start
                and appointment_data.end_time
                == slot_end
            ):
                valid_slot = True
                break

            current_time = slot_end_datetime

        if valid_slot:
            break

    if not valid_slot:

        raise HTTPException(
            status_code=400,
            detail=(
                "Selected time slot is not available."
            ),
        )

    # ----------------------------------------------
    # Check overlapping appointment
    #
    # Only active appointments block a slot.
    # ----------------------------------------------

    # sourcery skip: use-named-expression
    overlapping_appointment = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id
            == appointment_data.doctor_id,

            Appointment.appointment_date
            == appointment_date,

            Appointment.status.in_(
                ACTIVE_APPOINTMENT_STATUSES
            ),

            Appointment.start_time
            < appointment_data.end_time,

            Appointment.end_time
            > appointment_data.start_time,
        )
        .first()
    )

    if overlapping_appointment:

        raise HTTPException(
            status_code=409,
            detail=(
                "This appointment slot is already booked."
            ),
        )

    # ----------------------------------------------
    # Create appointment
    # ----------------------------------------------

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=appointment_data.doctor_id,
        appointment_date=appointment_date,
        start_time=appointment_data.start_time,
        end_time=appointment_data.end_time,
        status="SCHEDULED",
        appointment_type=(
            appointment_data.appointment_type
        ),
        reason=appointment_data.reason,
        notes=appointment_data.notes,
        created_by=patient.user_id,
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    # ----------------------------------------------
    # Send appointment confirmation email
    # ----------------------------------------------

    send_appointment_confirmation_email(
        patient_email=patient.user.email,
        patient_name=patient.user.name,
        doctor_name=doctor.user.name,
        appointment_date=appointment.appointment_date.strftime(
            "%B %d, %Y"
        ),
        start_time=appointment.start_time.strftime(
            "%I:%M %p"
        ),
        end_time=appointment.end_time.strftime(
            "%I:%M %p"
        ),
        appointment_type=appointment.appointment_type,
        appointment_id=appointment.id,
    )

    # ----------------------------------------------
    # Return appointment
    # ----------------------------------------------

    return {
        "message": "Appointment booked successfully",

        "appointment": {
            "id": appointment.id,
            "patient_id": appointment.patient_id,
            "doctor_id": appointment.doctor_id,
            "doctor_name": doctor.user.name,
            "requires_referral": doctor.requires_referral,
            "appointment_date": (
                appointment.appointment_date
            ),
            "start_time": appointment.start_time,
            "end_time": appointment.end_time,
            "status": appointment.status,
            "status_label": get_appointment_status_label(
                appointment.status
            ),
            "appointment_type": (
                appointment.appointment_type
            ),
            "reason": appointment.reason,
            "notes": appointment.notes,
        },
    }


# ==================================================
# STAFF BOOK APPOINTMENT
# ADMIN / RECEPTIONIST
# ==================================================

@router.post(
    "/staff-book",
    status_code=201,
)
def staff_book_appointment(
    appointment_data: StaffAppointmentCreate,
    current_user=Depends(
        require_roles(
            ["ADMIN", "RECEPTIONIST"]
        )
    ),
    db: Session = Depends(get_db),
):
    """
    Allow Admin/Receptionist to book an appointment
    for an existing patient.

    This uses the same doctor schedule and overlap
    rules as patient booking while taking the patient
    from the selected patient_id.
    """

    # ----------------------------------------------
    # Find selected patient
    # ----------------------------------------------

    patient = (
        db.query(Patient)
        .filter(
            Patient.id == appointment_data.patient_id,
            Patient.active.is_(True),
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    # ----------------------------------------------
    # Find doctor
    # ----------------------------------------------

    doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id == appointment_data.doctor_id,
            Doctor.active.is_(True),
        )
        .first()
    )

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    # ----------------------------------------------
    # Validate time range
    # ----------------------------------------------

    if (
        appointment_data.start_time
        >= appointment_data.end_time
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Appointment start time must be "
                "before end time."
            ),
        )

    # ----------------------------------------------
    # Clean expired appointments first
    # ----------------------------------------------

    mark_expired_appointments_as_no_show(
        db,
        doctor=doctor,
    )

    doctor_now = get_current_doctor_datetime(
        doctor
    )

    appointment_date = (
        appointment_data.appointment_date
    )

    # ----------------------------------------------
    # Reject past date
    # ----------------------------------------------

    if appointment_date < doctor_now.date():
        raise HTTPException(
            status_code=400,
            detail=(
                "Appointments cannot be booked "
                "for a past date."
            ),
        )

    # ----------------------------------------------
    # Reject past time for today
    # ----------------------------------------------

    if appointment_date == doctor_now.date():

        selected_datetime = datetime.combine(
            appointment_date,
            appointment_data.start_time,
        ).replace(
            tzinfo=doctor_now.tzinfo
        )

        if selected_datetime <= doctor_now:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This appointment time has "
                    "already passed."
                ),
            )

    # ----------------------------------------------
    # Check schedule exception
    # ----------------------------------------------

    exception = (
        db.query(ScheduleException)
        .filter(
            ScheduleException.doctor_id
            == doctor.id,
            ScheduleException.exception_date
            == appointment_date,
        )
        .first()
    )

    if exception and not exception.is_available:
        raise HTTPException(
            status_code=400,
            detail=(
                exception.reason
                or "Doctor is unavailable on this date."
            ),
        )

    # ----------------------------------------------
    # Find regular doctor schedule
    # ----------------------------------------------

    day_of_week = appointment_date.strftime(
        "%A"
    )

    schedules = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id
            == doctor.id,
            DoctorSchedule.day_of_week
            == day_of_week,
            DoctorSchedule.is_available.is_(True),
        )
        .all()
    )

    if not schedules:
        raise HTTPException(
            status_code=400,
            detail=(
                "Doctor is not available on this day."
            ),
        )

    # ----------------------------------------------
    # Validate that selected time is an actual
    # generated schedule slot.
    # ----------------------------------------------

    valid_slot = False

    for schedule in schedules:

        current_time = datetime.combine(
            appointment_date,
            schedule.start_time,
        )

        schedule_end = datetime.combine(
            appointment_date,
            schedule.end_time,
        )

        while current_time < schedule_end:

            slot_start = current_time.time()

            slot_end_datetime = (
                current_time
                + timedelta(
                    minutes=schedule.slot_duration
                )
            )

            slot_end = slot_end_datetime.time()

            if slot_end_datetime > schedule_end:
                break

            is_break = bool(
                schedule.break_start
                and schedule.break_end
                and schedule.break_start
                <= slot_start
                < schedule.break_end
            )

            if (
                not is_break
                and appointment_data.start_time
                == slot_start
                and appointment_data.end_time
                == slot_end
            ):
                valid_slot = True
                break

            current_time = slot_end_datetime

        if valid_slot:
            break

    if not valid_slot:
        raise HTTPException(
            status_code=400,
            detail=(
                "Selected time slot is not available."
            ),
        )

    # ----------------------------------------------
    # Check overlapping active appointment
    # ----------------------------------------------

    # sourcery skip: use-named-expression
    overlapping_appointment = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.appointment_date
            == appointment_date,
            Appointment.status.in_(
                ACTIVE_APPOINTMENT_STATUSES
            ),
            Appointment.start_time
            < appointment_data.end_time,
            Appointment.end_time
            > appointment_data.start_time,
        )
        .first()
    )

    if overlapping_appointment:
        raise HTTPException(
            status_code=409,
            detail=(
                "This appointment slot is already booked."
            ),
        )

    # ----------------------------------------------
    # Create appointment for selected patient
    # ----------------------------------------------

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        appointment_date=appointment_date,
        start_time=appointment_data.start_time,
        end_time=appointment_data.end_time,
        status="SCHEDULED",
        appointment_type=(
            appointment_data.appointment_type
        ),
        reason=appointment_data.reason,
        notes=appointment_data.notes,
        created_by=int(
            current_user["user_id"]
        ),
    )

    db.add(appointment)

    try:
        db.commit()
        db.refresh(appointment)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "This appointment slot was just "
                "booked by another user."
            ),
        )

    # ----------------------------------------------
    # Send confirmation email to patient
    # ----------------------------------------------

    send_appointment_confirmation_email(
        patient_email=patient.user.email,
        patient_name=patient.user.name,
        doctor_name=doctor.user.name,
        appointment_date=(
            appointment.appointment_date.strftime(
                "%B %d, %Y"
            )
        ),
        start_time=(
            appointment.start_time.strftime(
                "%I:%M %p"
            )
        ),
        end_time=(
            appointment.end_time.strftime(
                "%I:%M %p"
            )
        ),
        appointment_type=appointment.appointment_type,
        appointment_id=appointment.id,
    )

    # ----------------------------------------------
    # Return created appointment
    # ----------------------------------------------

    return {
        "message": "Appointment booked successfully",
        "appointment": {
            "id": appointment.id,
            "patient_id": appointment.patient_id,
            "patient_name": patient.user.name,
            "patient_email": patient.user.email,
            "doctor_id": appointment.doctor_id,
            "doctor_name": doctor.user.name,
            "requires_referral": doctor.requires_referral,
            "appointment_date": (
                appointment.appointment_date
            ),
            "start_time": appointment.start_time,
            "end_time": appointment.end_time,
            "status": appointment.status,
            "status_label": get_appointment_status_label(
                appointment.status
            ),
            "appointment_type": (
                appointment.appointment_type
            ),
            "reason": appointment.reason,
            "notes": appointment.notes,
        },
    }


# ==================================================
# GET MY APPOINTMENTS
# ==================================================

@router.get("/my")
def get_my_appointments(
    current_user=Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
):

    # ----------------------------------------------
    # Find logged-in patient
    # ----------------------------------------------

    patient = (
        db.query(Patient)
        .filter(
            Patient.user_id
            == int(current_user["user_id"])
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found",
        )

    # ----------------------------------------------
    # Automatically mark expired appointments
    # as NO_SHOW before returning them.
    # ----------------------------------------------

    mark_expired_appointments_as_no_show(
        db,
        patient_id=patient.id,
    )

    # ----------------------------------------------
    # Get patient appointments
    # ----------------------------------------------

    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id
            == patient.id,
        )
        .order_by(
            Appointment.appointment_date,
            Appointment.start_time,
        )
        .all()
    )

    # ----------------------------------------------
    # Return appointments
    # ----------------------------------------------

    return {
        "count": len(appointments),

        "appointments": [
            {
                "id": appointment.id,
                "doctor_id": appointment.doctor_id,
                "doctor_name": (
                    appointment.doctor.user.name
                ),
                "appointment_date": (
                    appointment.appointment_date
                ),
                "start_time": (
                    appointment.start_time
                ),
                "end_time": (
                    appointment.end_time
                ),
                "status": appointment.status,
                "status_label": get_appointment_status_label(
                    appointment.status
                ),
                "appointment_type": (
                    appointment.appointment_type
                ),
                "reason": appointment.reason,
                "notes": appointment.notes,
            }
            for appointment in appointments
        ],
    }


# ==================================================
# UPDATE APPOINTMENT STATUS
# ==================================================

@router.patch("/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    status_data: AppointmentStatusUpdate,
    current_user=Depends(
        require_roles(
            [
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
            ]
        )
    ),
    db: Session = Depends(get_db),
):

    # ----------------------------------------------
    # Normalize requested status
    # ----------------------------------------------

    new_status = (
        status_data.status or ""
    ).strip().upper()

    if new_status not in STAFF_MANAGED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid appointment status.",
        )

    # ----------------------------------------------
    # Find appointment
    # ----------------------------------------------

    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id == appointment_id,
        )
        .first()
    )

    if not appointment:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found",
        )

    # ----------------------------------------------
    # Find doctor
    # ----------------------------------------------

    doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id == appointment.doctor_id,
        )
        .first()
    )

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    # ----------------------------------------------
    # Current role
    # ----------------------------------------------

    current_role = str(
        current_user.get("role", "")
    ).upper()

    current_user_id = int(
        current_user["user_id"]
    )

    # ----------------------------------------------
    # Doctor can update only own appointments
    # ----------------------------------------------

    if (
        current_role == "DOCTOR"
        and doctor.user_id != current_user_id
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Doctors can update only "
                "their own appointments."
            ),
        )

    # ----------------------------------------------
    # Existing status
    # ----------------------------------------------

    current_status = str(
        appointment.status or ""
    ).upper()

    # ----------------------------------------------
    # Strict appointment lifecycle
    #
    # SCHEDULED
    #   -> CONFIRMED
    #   -> CHECKED_IN
    #   -> CANCELLED
    #   -> NO_SHOW
    #
    # CONFIRMED
    #   -> CHECKED_IN
    #   -> CANCELLED
    #   -> NO_SHOW
    #
    # CHECKED_IN
    #   -> IN_PROGRESS
    #   -> CANCELLED
    #
    # IN_PROGRESS
    #   -> COMPLETED
    #
    # COMPLETED / CANCELLED / NO_SHOW
    #   -> terminal
    # ----------------------------------------------

    allowed_transitions = {
        "SCHEDULED": {
            "CONFIRMED",
            "CHECKED_IN",
            "CANCELLED",
            "NO_SHOW",
        },
        "CONFIRMED": {
            "CHECKED_IN",
            "CANCELLED",
            "NO_SHOW",
        },
        "CHECKED_IN": {
            "IN_PROGRESS",
            "CANCELLED",
        },
        "IN_PROGRESS": {
            "COMPLETED",
        },
        "COMPLETED": set(),
        "CANCELLED": set(),
        "NO_SHOW": set(),
    }

    # ----------------------------------------------
    # Same status
    # ----------------------------------------------

    if new_status == current_status:
        return {
            "message": (
                "Appointment status is already "
                f"{current_status}."
            ),
            "appointment": {
                "id": appointment.id,
                "status": appointment.status,
                "status_label": get_appointment_status_label(
                    appointment.status
                ),
            },
        }

    # ----------------------------------------------
    # Validate transition
    # ----------------------------------------------

    allowed_next_statuses = allowed_transitions.get(
        current_status,
        set(),
    )

    if new_status not in allowed_next_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Appointment cannot move from "
                f"{current_status} to "
                f"{new_status}."
            ),
        )

    # ==================================================
    # ROLE-SPECIFIC RULES
    # ==================================================

    # ----------------------------------------------
    # Doctor can only:
    #
    # CHECKED_IN -> IN_PROGRESS
    # IN_PROGRESS -> COMPLETED
    # ----------------------------------------------

    if (
        current_role == "DOCTOR"
        and new_status not in {
            "IN_PROGRESS",
            "COMPLETED",
        }
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Doctors can only start or "
                "complete their own visits."
            ),
        )

    # ----------------------------------------------
    # NO_SHOW can only happen from a waiting state
    # and only AFTER the appointment END TIME.
    #
    # This applies to both Admin and Receptionist.
    # ----------------------------------------------

    if new_status == "NO_SHOW":

        if current_status not in {
            "SCHEDULED",
            "CONFIRMED",
        }:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only waiting appointments can "
                    "be marked Not Attended."
                ),
            )

        appointment_end = (
            get_appointment_end_datetime(
                appointment,
                doctor,
            )
        )

        doctor_now = get_current_doctor_datetime(
            doctor
        )

        if doctor_now < appointment_end:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The appointment must reach its "
                    "end time before it can be marked "
                    "Not Attended."
                ),
            )

    # ----------------------------------------------
    # Update status
    # ----------------------------------------------

    appointment.status = new_status

    db.commit()
    db.refresh(appointment)

    # ----------------------------------------------
    # Return updated appointment
    # ----------------------------------------------

    return {
        "message": (
            "Appointment status updated successfully"
        ),
        "appointment": {
            "id": appointment.id,
            "patient_id": appointment.patient_id,
            "doctor_id": appointment.doctor_id,
            "doctor_name": doctor.user.name,
            "appointment_date": (
                appointment.appointment_date
            ),
            "start_time": appointment.start_time,
            "end_time": appointment.end_time,
            "status": appointment.status,
            "status_label": get_appointment_status_label(
                appointment.status
            ),
            "appointment_type": (
                appointment.appointment_type
            ),
            "reason": appointment.reason,
            "notes": appointment.notes,
        },
    }


# ==================================================
# STAFF APPOINTMENTS
# ADMIN / RECEPTIONIST / DOCTOR
# ==================================================

@router.get("/staff")
def get_staff_appointments(
    appointment_date: date | None = Query(
        default=None
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
    ),
    current_user=Depends(
        require_roles(
            [
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
            ]
        )
    ),
    db: Session = Depends(get_db),
):
    """
    Operational appointment list for staff.

    ADMIN / RECEPTIONIST:
        Can see all appointments.

    DOCTOR:
        Can see only appointments assigned to that doctor.

    Expired SCHEDULED / CONFIRMED appointments are
    normalized to NO_SHOW before the response is built.
    """

    # ----------------------------------------------
    # Automatic lifecycle normalization
    # ----------------------------------------------

    mark_expired_appointments_as_no_show(db)

    current_role = str(
        current_user.get("role", "")
    ).upper()

    query = db.query(Appointment)

    # ----------------------------------------------
    # Doctor sees only own appointments
    # ----------------------------------------------

    if current_role == "DOCTOR":

        current_user_id = int(
            current_user["user_id"]
        )

        query = (
            query
            .join(Doctor)
            .filter(
                Doctor.user_id == current_user_id
            )
        )

    # ----------------------------------------------
    # Date filter
    # ----------------------------------------------

    if appointment_date is not None:

        query = query.filter(
            Appointment.appointment_date
            == appointment_date
        )

    # ----------------------------------------------
    # Status filter
    # ----------------------------------------------

    if status_filter:

        requested_statuses = {
            item.strip().upper()
            for item in status_filter.split(",")
            if item.strip()
        }

        # sourcery skip: use-named-expression
        valid_requested_statuses = (
            requested_statuses
            & STAFF_MANAGED_STATUSES
        )

        if valid_requested_statuses:

            query = query.filter(
                Appointment.status.in_(
                    valid_requested_statuses
                )
            )

        else:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid appointment status filter."
                ),
            )

    appointments = (
        query
        .order_by(
            Appointment.appointment_date.asc(),
            Appointment.start_time.asc(),
        )
        .all()
    )

    return {
        "count": len(appointments),

        "appointments": [
            {
                "id": appointment.id,

                "patient_id": appointment.patient_id,

                "patient_name": (
                    appointment.patient.user.name
                    if appointment.patient
                    and appointment.patient.user
                    else "Unknown patient"
                ),

                "patient_email": (
                    appointment.patient.user.email
                    if appointment.patient
                    and appointment.patient.user
                    else None
                ),

                "doctor_id": appointment.doctor_id,

                "doctor_name": (
                    appointment.doctor.user.name
                    if appointment.doctor
                    and appointment.doctor.user
                    else "Unknown doctor"
                ),

                "appointment_date": (
                    appointment.appointment_date
                ),

                "start_time": (
                    appointment.start_time
                ),

                "end_time": (
                    appointment.end_time
                ),

                "status": appointment.status,

                "status_label": (
                    get_appointment_status_label(
                        appointment.status
                    )
                ),

                "appointment_type": (
                    appointment.appointment_type
                ),

                "reason": appointment.reason,

                "notes": appointment.notes,
            }

            for appointment in appointments
        ],
    }


# ==================================================
# GET SINGLE APPOINTMENT
# ==================================================

@router.get("/{appointment_id}")
def get_appointment(
    appointment_id: int,
    current_user=Depends(
        require_roles(
            [
                "PATIENT",
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
            ]
        )
    ),
    db: Session = Depends(get_db),
):

    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id
            == appointment_id,
        )
        .first()
    )

    if not appointment:

        raise HTTPException(
            status_code=404,
            detail="Appointment not found",
        )

    doctor = appointment.doctor

    # ----------------------------------------------
    # Automatically normalize expired appointment
    # ----------------------------------------------

    mark_expired_appointments_as_no_show(
        db,
        doctor=doctor,
    )

    db.refresh(appointment)

    # ----------------------------------------------
    # Access control
    # ----------------------------------------------

    current_role = (
        str(
            current_user.get(
                "role",
                "",
            )
        )
        .upper()
    )

    current_user_id = int(
        current_user["user_id"]
    )

    if current_role == "PATIENT":

        patient = (
            db.query(Patient)
            .filter(
                Patient.user_id
                == current_user_id
            )
            .first()
        )

        if (
            not patient
            or appointment.patient_id
            != patient.id
        ):

            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have access "
                    "to this appointment."
                ),
            )

    elif current_role == "DOCTOR":

        if (
            not doctor
            or doctor.user_id
            != current_user_id
        ):

            raise HTTPException(
                status_code=403,
                detail=(
                    "Doctors can access only "
                    "their own appointments."
                ),
            )

    # ----------------------------------------------
    # Return appointment
    # ----------------------------------------------

    return {
        "appointment": {
            "id": appointment.id,
            "patient_id": appointment.patient_id,
            "doctor_id": appointment.doctor_id,
            "doctor_name": (
                doctor.user.name
                if doctor and doctor.user
                else None
            ),
            "appointment_date": (
                appointment.appointment_date
            ),
            "start_time": (
                appointment.start_time
            ),
            "end_time": (
                appointment.end_time
            ),
            "status": appointment.status,
            "status_label": get_appointment_status_label(
                appointment.status
            ),
            "appointment_type": (
                appointment.appointment_type
            ),
            "reason": appointment.reason,
            "notes": appointment.notes,
        }
    }
