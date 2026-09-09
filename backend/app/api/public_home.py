from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule
from app.models.schedule_exception import ScheduleException


router = APIRouter(
    prefix="/public/home",
    tags=["Public Home"],
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

    if appointment_date < doctor_now.date():
        return True

    if appointment_date > doctor_now.date():
        return False

    slot_datetime = datetime.combine(
        appointment_date,
        start_time,
    ).replace(
        tzinfo=get_doctor_timezone(doctor)
    )

    return slot_datetime <= doctor_now


def time_ranges_overlap(
    slot_start,
    slot_end,
    other_start,
    other_end,
) -> bool:
    return (
        slot_start < other_end
        and slot_end > other_start
    )


# ============================================================
# BUILD DOCTOR SLOTS FOR ONE DATE
# ============================================================

def build_doctor_day(
    doctor: Doctor,
    appointment_date: date,
    db: Session,
):
    day_of_week = appointment_date.strftime("%A").title()

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
    # REGULAR SCHEDULE
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

    if not schedules:
        return []

    # --------------------------------------------------------
    # EXISTING APPOINTMENTS
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

    slots = []

    # --------------------------------------------------------
    # GENERATE SLOTS
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

        if slot_duration <= 0:
            slot_duration = 30

        while current < schedule_end:

            slot_start = current.time()

            slot_end_datetime = (
                current
                + timedelta(
                    minutes=slot_duration
                )
            )

            # Don't create partial slot.
            if slot_end_datetime > schedule_end:
                break

            slot_end = slot_end_datetime.time()

            status = "available"

            # ------------------------------------------------
            # BREAK
            # ------------------------------------------------

            if (
                schedule.break_start
                and schedule.break_end
                and time_ranges_overlap(
                    slot_start,
                    slot_end,
                    schedule.break_start,
                    schedule.break_end,
                )
            ):
                status = "break"

            # ------------------------------------------------
            # DATE EXCEPTION
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
            # BOOKED
            # ------------------------------------------------

            else:
                for appointment in appointments:

                    if time_ranges_overlap(
                        slot_start,
                        slot_end,
                        appointment.start_time,
                        appointment.end_time,
                    ):
                        status = "booked"
                        break

            slots.append(
                {
                    "start_time": slot_start.strftime("%H:%M"),
                    "end_time": slot_end.strftime("%H:%M"),
                    "status": status,
                }
            )

            current = slot_end_datetime

    return slots


# ============================================================
# PUBLIC HOME API
# ============================================================

@router.get("")
def get_public_home(
    db: Session = Depends(get_db),
):
    """
    Public data used by the Home Page.

    No authentication required.
    """

    # --------------------------------------------------------
    # TODAY
    # --------------------------------------------------------

    today = date.today()

    # --------------------------------------------------------
    # ACTIVE DOCTORS
    # --------------------------------------------------------

    doctors = (
        db.query(Doctor)
        .join(Doctor.user)
        .filter(
            Doctor.active.is_(True)
        )
        .all()
    )

    # Sort doctors by name.
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
    # SPECIALTIES
    # --------------------------------------------------------

    specialties = sorted(
        {
            doctor.specialization.strip()
            for doctor in doctors
            if doctor.specialization
            and doctor.specialization.strip()
        },
        key=str.lower,
    )

    # --------------------------------------------------------
    # TODAY'S STATISTICS
    # --------------------------------------------------------

    total_available = 0
    total_booked = 0
    total_break = 0
    total_not_available = 0

    next_available = None

    # --------------------------------------------------------
    # CHECK EVERY DOCTOR
    # --------------------------------------------------------

    for doctor in doctors:

        doctor_slots = build_doctor_day(
            doctor=doctor,
            appointment_date=today,
            db=db,
        )

        # Sort by start time.
        doctor_slots.sort(
            key=lambda slot: slot["start_time"]
        )

        for slot in doctor_slots:

            status = slot["status"]

            # ----------------------------------------------
            # AVAILABLE
            # ----------------------------------------------

            if status == "available":

                total_available += 1

                # First available slot becomes
                # Home Page's next available appointment.
                if next_available is None:

                    next_available = {
                        "doctor": {
                            "id": doctor.id,
                            "name": doctor.user.name,
                            "specialization": doctor.specialization,
                            "department": doctor.department,
                            "profile_photo": doctor.profile_photo,
                            "requires_referral": doctor.requires_referral,
                        },
                        "date": str(today),
                        "day": today.strftime("%A"),
                        "slot": {
                            "start_time": slot["start_time"],
                            "end_time": slot["end_time"],
                        },
                    }

            # ----------------------------------------------
            # BOOKED
            # ----------------------------------------------

            elif status == "booked":

                total_booked += 1

            # ----------------------------------------------
            # BREAK
            # ----------------------------------------------

            elif status == "break":

                total_break += 1

            # ----------------------------------------------
            # NOT AVAILABLE
            # ----------------------------------------------

            elif status == "not_available":

                total_not_available += 1

    # --------------------------------------------------------
    # FINAL RESPONSE
    # --------------------------------------------------------

    return {
        "date": str(today),

        "stats": {
            "doctors": len(doctors),
            "available_slots": total_available,
            "booked_slots": total_booked,
            "break_slots": total_break,
            "not_available_slots": total_not_available,
        },

        "specialties": specialties,

        "doctors": doctor_response,

        "next_available": next_available,
    }