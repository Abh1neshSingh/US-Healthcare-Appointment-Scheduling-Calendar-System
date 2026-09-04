from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule
from app.models.schedule_exception import ScheduleException


router = APIRouter(
    prefix="/public/calendar",
    tags=["Public Calendar"],
)


# ============================================================
# US STATE TIMEZONES
# ============================================================

STATE_TIMEZONES = {
    "AL": "America/Chicago",
    "AK": "America/Anchorage",
    "AZ": "America/Phoenix",
    "AR": "America/Chicago",
    "CA": "America/Los_Angeles",
    "CO": "America/Denver",
    "CT": "America/New_York",
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


# ============================================================
# HELPERS
# ============================================================

def get_doctor_timezone(doctor: Doctor) -> ZoneInfo:
    state = (doctor.state or "").strip().upper()

    timezone_name = STATE_TIMEZONES.get(
        state,
        "America/New_York",
    )

    return ZoneInfo(timezone_name)


def get_doctor_now(doctor: Doctor) -> datetime:
    return datetime.now(
        get_doctor_timezone(doctor)
    )


def is_past_slot(
    appointment_date: date,
    start_time,
    doctor: Doctor,
) -> bool:
    doctor_now = get_doctor_now(doctor)

    # Entire date is in the past.
    if appointment_date < doctor_now.date():
        return True

    # Future date.
    if appointment_date > doctor_now.date():
        return False

    # Same date -> compare exact local time.
    slot_datetime = datetime.combine(
        appointment_date,
        start_time,
    ).replace(
        tzinfo=get_doctor_timezone(doctor)
    )

    return slot_datetime <= doctor_now


def normalize_day_name(value: str) -> str:
    """
    DoctorSchedule stores weekday values in the same
    format used by the existing availability flow:

        Monday
        Tuesday
        Wednesday
        Thursday
        Friday
        Saturday
        Sunday

    Python strftime("%A") already returns this format.
    """

    return value.strip().title()


def format_time(value) -> str:
    return value.strftime("%H:%M")


# ============================================================
# BUILD ONE DOCTOR'S SCHEDULE FOR ONE DATE
# ============================================================

def build_doctor_day(
    doctor: Doctor,
    appointment_date: date,
    db: Session,
):
    day_of_week = normalize_day_name(
        appointment_date.strftime("%A")
    )

    # --------------------------------------------------------
    # DATE EXCEPTION
    # --------------------------------------------------------

    exception = (
        db.query(ScheduleException)
        .filter(
            ScheduleException.doctor_id == doctor.id,
            ScheduleException.exception_date == appointment_date,
        )
        .first()
    )

    # --------------------------------------------------------
    # REGULAR DOCTOR SCHEDULE
    # --------------------------------------------------------

    schedules = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id == doctor.id,
            DoctorSchedule.day_of_week == day_of_week,
            DoctorSchedule.is_available.is_(True),
        )
        .order_by(
            DoctorSchedule.start_time
        )
        .all()
    )

    # No regular schedule for this day.
    if not schedules:
        return {}

    # --------------------------------------------------------
    # EXISTING BOOKINGS
    # --------------------------------------------------------

    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.id,
            Appointment.appointment_date == appointment_date,
            Appointment.status == "SCHEDULED",
        )
        .all()
    )

    result = {}

    # --------------------------------------------------------
    # GENERATE TIME SLOTS
    # --------------------------------------------------------

    for schedule in schedules:

        current = datetime.combine(
            appointment_date,
            schedule.start_time,
        )

        schedule_end = datetime.combine(
            appointment_date,
            schedule.end_time,
        )

        slot_duration = schedule.slot_duration or 30

        while current < schedule_end:

            slot_start = current.time()

            slot_end_datetime = (
                current
                + timedelta(
                    minutes=slot_duration
                )
            )

            # Do not create a partial slot.
            if slot_end_datetime > schedule_end:
                break

            slot_end = slot_end_datetime.time()

            slot_key = format_time(
                slot_start
            )

            # ------------------------------------------------
            # DEFAULT STATUS
            # ------------------------------------------------

            status = "available"

            # ------------------------------------------------
            # BREAK
            # ------------------------------------------------

            if (
                schedule.break_start
                and schedule.break_end
                and schedule.break_start
                <= slot_start
                < schedule.break_end
            ):
                status = "break"

            # ------------------------------------------------
            # DATE-SPECIFIC UNAVAILABLE
            # ------------------------------------------------

            elif (
                exception
                and not exception.is_available
            ):
                status = "not_available"

            # ------------------------------------------------
            # PAST SLOT
            # ------------------------------------------------

            elif is_past_slot(
                appointment_date,
                slot_start,
                doctor,
            ):
                status = "not_available"

            # ------------------------------------------------
            # EXISTING APPOINTMENT
            # ------------------------------------------------

            else:
                for appointment in appointments:

                    appointment_start = (
                        appointment.start_time
                    )

                    appointment_end = (
                        appointment.end_time
                    )

                    # Check whether appointment overlaps
                    # with this calendar slot.
                    if (
                        slot_start < appointment_end
                        and slot_end > appointment_start
                    ):
                        status = "booked"
                        break

            # ------------------------------------------------
            # SAVE SLOT
            # ------------------------------------------------

            result[slot_key] = {
                "start_time": format_time(
                    slot_start
                ),
                "end_time": format_time(
                    slot_end
                ),
                "status": status,
            }

            current = slot_end_datetime

    return result


# ============================================================
# PUBLIC CALENDAR
# ============================================================

@router.get("")
def get_public_calendar(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail=(
                "end_date must be on or after start_date"
            ),
        )

    # Maximum 43 days.
    if (end_date - start_date).days > 42:
        raise HTTPException(
            status_code=400,
            detail=(
                "Calendar range cannot exceed 43 days"
            ),
        )

    # --------------------------------------------------------
    # GET ACTIVE DOCTORS
    # --------------------------------------------------------

    doctors = (
        db.query(Doctor)
        .join(Doctor.user)
        .filter(
            Doctor.active.is_(True)
        )
        .all()
    )

    # Deterministic ordering by doctor name.
    doctors.sort(
        key=lambda doctor: (
            doctor.user.name or ""
        ).lower()
    )

    # --------------------------------------------------------
    # DOCTOR RESPONSE
    # --------------------------------------------------------

    doctor_response = [
        {
            "id": doctor.id,
            "name": doctor.user.name,
            "specialization": doctor.specialization,
            "department": doctor.department,
            "profile_photo": doctor.profile_photo,
            "requires_referral": doctor.requires_referral,
        }
        for doctor in doctors
    ]

    # --------------------------------------------------------
    # BUILD DAYS
    # --------------------------------------------------------

    days = {}

    all_time_slots = set()

    current_date = start_date

    while current_date <= end_date:

        doctor_data = {}

        available_slots = 0
        booked_slots = 0
        break_slots = 0
        not_available_slots = 0

        # ----------------------------------------------------
        # ALL DOCTORS
        # ----------------------------------------------------

        for doctor in doctors:

            doctor_slots = build_doctor_day(
                doctor=doctor,
                appointment_date=current_date,
                db=db,
            )

            doctor_data[
                str(doctor.id)
            ] = doctor_slots

            # Collect all available time keys.
            all_time_slots.update(
                doctor_slots.keys()
            )

            # ------------------------------------------------
            # SUMMARY
            # ------------------------------------------------

            for slot in doctor_slots.values():

                status = slot["status"]

                if status == "available":
                    available_slots += 1

                elif status == "booked":
                    booked_slots += 1

                elif status == "break":
                    break_slots += 1

                elif status == "not_available":
                    not_available_slots += 1

        # ----------------------------------------------------
        # DAY RESPONSE
        # ----------------------------------------------------

        days[
            str(current_date)
        ] = {
            "date": str(current_date),
            "day": current_date.strftime("%A"),
            "available_slots": available_slots,
            "booked_slots": booked_slots,
            "break_slots": break_slots,
            "not_available_slots": not_available_slots,
            "doctors": doctor_data,
        }

        current_date += timedelta(days=1)

    # --------------------------------------------------------
    # FINAL RESPONSE
    # --------------------------------------------------------

    return {
        "start_date": str(start_date),
        "end_date": str(end_date),
        "doctors": doctor_response,
        "days": days,
        "time_slots": sorted(all_time_slots),
    }