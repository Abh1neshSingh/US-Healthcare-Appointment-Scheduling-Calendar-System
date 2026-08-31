from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.database.connection import get_db

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule
from app.models.schedule_exception import ScheduleException
from app.models.patient import Patient

from app.schemas.appointment import AppointmentCreate

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
    "WY": "America/New_York",
}


def get_doctor_timezone(doctor: Doctor) -> ZoneInfo:
    """
    Get doctor's local timezone from clinic state.
    """

    state = (doctor.state or "").strip().upper()

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


def is_past_slot(
    appointment_date: date,
    slot_start,
    doctor: Doctor,
) -> bool:
    """
    Check whether a slot has already started.
    """

    doctor_now = get_current_doctor_datetime(doctor)

    if appointment_date < doctor_now.date():
        return True

    if appointment_date > doctor_now.date():
        return False

    current_datetime = datetime.combine(
        appointment_date,
        slot_start,
    ).replace(tzinfo=doctor_now.tzinfo)

    return current_datetime <= doctor_now


# ==================================================
# DOCTOR AVAILABILITY
# ==================================================

@router.get("/availability")
def get_doctor_availability(
    doctor_id: int = Query(...),
    appointment_date: date = Query(...),
    current_user=Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
):

    doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id == doctor_id,
            Doctor.active == True,
        )
        .first()
    )

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
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
            ScheduleException.doctor_id
            == doctor_id,
            ScheduleException.exception_date
            == appointment_date,
        )
        .first()
    )

    if exception and not exception.is_available:

        return {
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.name,
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
            DoctorSchedule.doctor_id
            == doctor_id,
            DoctorSchedule.day_of_week
            == day_of_week,
            DoctorSchedule.is_available == True,
        )
        .all()
    )

    if not schedules:

        return {
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.name,
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
    # Get existing appointments
    # ----------------------------------------------

    existing_appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date
            == appointment_date,
            Appointment.status == "SCHEDULED",
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

    available_slots = total_slots - booked_slots

    # ----------------------------------------------
    # Return availability
    # ----------------------------------------------

    return {
        "doctor_id": doctor_id,
        "doctor_name": doctor.user.name,
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
            Doctor.active == True,
        )
        .first()
    )

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    # ----------------------------------------------
    # Get doctor's current local date/time
    # ----------------------------------------------

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
            DoctorSchedule.is_available == True,
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
    # ----------------------------------------------

    if overlapping_appointment := (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id
            == appointment_data.doctor_id,

            Appointment.appointment_date
            == appointment_date,

            Appointment.status == "SCHEDULED",

            Appointment.start_time
            < appointment_data.end_time,

            Appointment.end_time
            > appointment_data.start_time,
        )
        .first()
    ):

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
            "appointment_date": (
                appointment.appointment_date
            ),
            "start_time": appointment.start_time,
            "end_time": appointment.end_time,
            "status": appointment.status,
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
                "appointment_type": (
                    appointment.appointment_type
                ),
                "reason": appointment.reason,
                "notes": appointment.notes,
            }
            for appointment in appointments
        ],
    }