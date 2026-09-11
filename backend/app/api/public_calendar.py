from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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
    "ID": "America/Boise",
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


STATE_NAMES = {
    "ALABAMA": "AL",
    "ALASKA": "AK",
    "ARIZONA": "AZ",
    "ARKANSAS": "AR",
    "CALIFORNIA": "CA",
    "COLORADO": "CO",
    "CONNECTICUT": "CT",
    "DELAWARE": "DE",
    "FLORIDA": "FL",
    "GEORGIA": "GA",
    "HAWAII": "HI",
    "IDAHO": "ID",
    "ILLINOIS": "IL",
    "INDIANA": "IN",
    "IOWA": "IA",
    "KANSAS": "KS",
    "KENTUCKY": "KY",
    "LOUISIANA": "LA",
    "MAINE": "ME",
    "MARYLAND": "MD",
    "MASSACHUSETTS": "MA",
    "MICHIGAN": "MI",
    "MINNESOTA": "MN",
    "MISSISSIPPI": "MS",
    "MISSOURI": "MO",
    "MONTANA": "MT",
    "NEBRASKA": "NE",
    "NEVADA": "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    "OHIO": "OH",
    "OKLAHOMA": "OK",
    "OREGON": "OR",
    "PENNSYLVANIA": "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    "TENNESSEE": "TN",
    "TEXAS": "TX",
    "UTAH": "UT",
    "VERMONT": "VT",
    "VIRGINIA": "VA",
    "WASHINGTON": "WA",
    "WEST VIRGINIA": "WV",
    "WISCONSIN": "WI",
    "WYOMING": "WY",
}


# ============================================================
# APPOINTMENT STATUS
# ============================================================

FINAL_APPOINTMENT_STATUSES = {
    "completed",
    "complete",
    "attended",
    "not_attended",
    "not-attended",
    "no_show",
    "no-show",
    "noshow",
    "expired",
    "rejected",
    "declined",
    "cancelled",
    "canceled",
    "cancel",
}


# ============================================================
# TIMEZONE HELPERS
# ============================================================

def _normalize_state(value: str | None) -> str | None:
    if not value:
        return None

    state = str(value).strip().upper()

    return state if state in STATE_TIMEZONES else STATE_NAMES.get(state)


def _get_timezone_for_doctor(doctor: Doctor) -> str:
    if explicit_timezone := getattr(
        doctor,
        "timezone",
        None,
    ):
        timezone_name = str(
            explicit_timezone
        ).strip()

        try:
            ZoneInfo(timezone_name)
        except (
            ZoneInfoNotFoundError,
            ValueError,
        ):
            pass
        else:
            return timezone_name

    state = (
        getattr(doctor, "state", None)
        or getattr(doctor, "practice_state", None)
        or getattr(doctor, "location_state", None)
    )

    state_code = _normalize_state(state)

    return STATE_TIMEZONES.get(
        state_code,
        "America/New_York",
    )


def _get_doctor_now(doctor: Doctor) -> datetime:
    timezone_name = _get_timezone_for_doctor(
        doctor
    )

    try:
        doctor_timezone = ZoneInfo(
            timezone_name
        )
    except (
        ZoneInfoNotFoundError,
        ValueError,
    ):
        doctor_timezone = ZoneInfo(
            "America/New_York"
        )

    return datetime.now(
        doctor_timezone
    )


# ============================================================
# TIME HELPERS
# ============================================================

def _parse_time(value):
    if value is None:
        return None

    if hasattr(value, "hour") and hasattr(
        value,
        "minute",
    ):
        return value

    value_string = str(value).strip()

    for time_format in (
        "%H:%M:%S",
        "%H:%M",
    ):
        try:
            return datetime.strptime(
                value_string,
                time_format,
            ).time()
        except ValueError:
            continue

    return None


def _combine_local_datetime(
    calendar_date: date,
    time_value,
    timezone_name: str,
) -> datetime | None:
    parsed_time = _parse_time(
        time_value
    )

    if parsed_time is None:
        return None

    try:
        doctor_timezone = ZoneInfo(
            timezone_name
        )
    except (
        ZoneInfoNotFoundError,
        ValueError,
    ):
        doctor_timezone = ZoneInfo(
            "America/New_York"
        )

    return datetime(
        calendar_date.year,
        calendar_date.month,
        calendar_date.day,
        parsed_time.hour,
        parsed_time.minute,
        parsed_time.second,
        tzinfo=doctor_timezone,
    )


def _format_time(value) -> str:
    parsed_time = _parse_time(value)

    return (
        ""
        if parsed_time is None
        else parsed_time.strftime(
            "%H:%M"
        )
    )


def _slot_has_started(
    doctor: Doctor,
    slot_date: date,
    slot_start,
) -> bool:
    slot_start_local = _combine_local_datetime(
        slot_date,
        slot_start,
        _get_timezone_for_doctor(doctor),
    )

    if slot_start_local is None:
        return True

    return (
        _get_doctor_now(doctor)
        >= slot_start_local
    )


# ============================================================
# APPOINTMENT HELPERS
# ============================================================

def _appointment_status(
    appointment: Appointment,
) -> str:
    status = getattr(
        appointment,
        "status",
        None,
    )

    if status is None:
        return ""

    return str(
        getattr(
            status,
            "value",
            status,
        )
    ).strip().lower()


def _is_active_appointment(
    appointment: Appointment,
) -> bool:
    status = _appointment_status(
        appointment
    )

    return bool(
        status
        and status
        not in FINAL_APPOINTMENT_STATUSES
    )


def _load_appointments_for_date(
    db: Session,
    doctor_id: int,
    calendar_date: date,
) -> list[Appointment]:
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date
            == calendar_date,
        )
        .all()
    )

    return [
        appointment
        for appointment in appointments
        if _is_active_appointment(
            appointment
        )
    ]


def _appointment_matches_slot(
    appointment: Appointment,
    slot_start,
    slot_end,
) -> bool:
    appointment_start = getattr(
        appointment,
        "start_time",
        None,
    )

    appointment_end = getattr(
        appointment,
        "end_time",
        None,
    )

    if (
        appointment_start is None
        or appointment_end is None
    ):
        return False

    return (
        appointment_start < slot_end
        and appointment_end > slot_start
    )


# ============================================================
# SCHEDULE HELPERS
# ============================================================

def _weekday_matches(
    schedule_weekday,
    calendar_date: date,
) -> bool:
    if schedule_weekday is None:
        return False

    value = str(
        getattr(
            schedule_weekday,
            "value",
            schedule_weekday,
        )
    ).strip()

    normalized = value.lower()

    weekday_name = calendar_date.strftime(
        "%A"
    ).lower()

    weekday_short = calendar_date.strftime(
        "%a"
    ).lower()

    if normalized in {
        weekday_name,
        weekday_short,
    }:
        return True

    try:
        return int(value) == calendar_date.weekday()
    except (
        TypeError,
        ValueError,
    ):
        return False


def _schedule_is_closed(
    schedule: DoctorSchedule,
) -> bool:
    return any(
        getattr(
            schedule,
            field_name,
            None,
        )
        is False
        for field_name in (
            "is_available",
            "is_working",
            "is_active",
        )
    )


def _get_schedule_for_date(
    db: Session,
    doctor_id: int,
    calendar_date: date,
) -> list[DoctorSchedule]:
    schedules = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id
            == doctor_id,
        )
        .all()
    )

    matched_schedules = [
        schedule
        for schedule in schedules
        if _weekday_matches(
            getattr(
                schedule,
                "day_of_week",
                None,
            ),
            calendar_date,
        )
        and not _schedule_is_closed(
            schedule
        )
    ]

    return sorted(
        matched_schedules,
        key=lambda schedule: (
            getattr(
                schedule,
                "start_time",
                None,
            )
            or datetime.min.time()
        ),
    )


def _get_exception_for_date(
    db: Session,
    doctor_id: int,
    calendar_date: date,
) -> ScheduleException | None:
    exceptions = (
        db.query(ScheduleException)
        .filter(
            ScheduleException.doctor_id
            == doctor_id,
        )
        .all()
    )

    for exception in exceptions:
        exception_date = (
            getattr(
                exception,
                "exception_date",
                None,
            )
            or getattr(
                exception,
                "date",
                None,
            )
        )

        if isinstance(
            exception_date,
            datetime,
        ):
            exception_date = (
                exception_date.date()
            )

        if exception_date == calendar_date:
            return exception

    return None


def _exception_is_closed(
    exception: ScheduleException | None,
) -> bool:
    if exception is None:
        return False

    if any(
        getattr(
            exception,
            field_name,
            None,
        )
        is False
        for field_name in (
            "is_available",
            "is_working",
            "is_active",
        )
    ):
        return True

    exception_type = (
        getattr(
            exception,
            "exception_type",
            None,
        )
        or getattr(
            exception,
            "type",
            None,
        )
    )

    if exception_type is None:
        return False

    exception_value = str(
        getattr(
            exception_type,
            "value",
            exception_type,
        )
    ).strip().lower()

    return exception_value in {
        "closed",
        "holiday",
        "leave",
        "off",
        "unavailable",
    }


# ============================================================
# SLOT GENERATION
# ============================================================

def _generate_slots(
    doctor: Doctor,
    schedules: list[DoctorSchedule],
    exception: ScheduleException | None,
    appointments: list[Appointment],
    calendar_date: date,
) -> dict:
    if not schedules or _exception_is_closed(
        exception
    ):
        return {}

    timezone_name = _get_timezone_for_doctor(
        doctor
    )

    doctor_now = _get_doctor_now(
        doctor
    )

    day_is_past = (
        calendar_date < doctor_now.date()
    )

    result = {}

    for schedule in schedules:
        start_time = _parse_time(
            getattr(
                schedule,
                "start_time",
                None,
            )
        )

        end_time = _parse_time(
            getattr(
                schedule,
                "end_time",
                None,
            )
        )

        if (
            start_time is None
            or end_time is None
        ):
            continue

        duration_value = (
            getattr(
                schedule,
                "slot_duration",
                None,
            )
            or getattr(
                schedule,
                "duration_minutes",
                None,
            )
            or getattr(
                schedule,
                "appointment_duration",
                None,
            )
            or 30
        )

        try:
            duration = int(
                duration_value
            )
        except (
            TypeError,
            ValueError,
        ):
            duration = 30

        if duration <= 0:
            duration = 30

        current = _combine_local_datetime(
            calendar_date,
            start_time,
            timezone_name,
        )

        schedule_end = _combine_local_datetime(
            calendar_date,
            end_time,
            timezone_name,
        )

        if (
            current is None
            or schedule_end is None
            or current >= schedule_end
        ):
            continue

        break_start = _parse_time(
            getattr(
                schedule,
                "break_start",
                None,
            )
        )

        break_end = _parse_time(
            getattr(
                schedule,
                "break_end",
                None,
            )
        )

        while current < schedule_end:
            slot_end_datetime = (
                current
                + timedelta(
                    minutes=duration
                )
            )

            if slot_end_datetime > schedule_end:
                break

            slot_start = current.time()
            slot_end = slot_end_datetime.time()

            start_text = _format_time(
                slot_start
            )

            end_text = _format_time(
                slot_end
            )

            status = _get_slot_status(
                doctor=doctor,
                doctor_now=doctor_now,
                calendar_date=calendar_date,
                day_is_past=day_is_past,
                slot_start=slot_start,
                slot_end=slot_end,
                break_start=break_start,
                break_end=break_end,
                appointments=appointments,
            )

            result[start_text] = {
                "start_time": start_text,
                "end_time": end_text,
                "status": status,
            }

            current = slot_end_datetime

    return result


def _get_slot_status(
    doctor: Doctor,
    doctor_now: datetime,
    calendar_date: date,
    day_is_past: bool,
    slot_start,
    slot_end,
    break_start,
    break_end,
    appointments: list[Appointment],
) -> str:
    # --------------------------------------------------------
    # BREAK
    # --------------------------------------------------------

    if (
        break_start is not None
        and break_end is not None
        and break_start
        <= slot_start
        < break_end
    ):
        return "break"

    # --------------------------------------------------------
    # PAST DATE
    # --------------------------------------------------------

    if day_is_past:
        return "not_available"

    # --------------------------------------------------------
    # TODAY / LIVE TIME
    # --------------------------------------------------------

    if (
        calendar_date == doctor_now.date()
        and _slot_has_started(
            doctor,
            calendar_date,
            slot_start,
        )
    ):
        return "not_available"

    # --------------------------------------------------------
    # BOOKED
    # --------------------------------------------------------

    if any(
        _appointment_matches_slot(
            appointment,
            slot_start,
            slot_end,
        )
        for appointment in appointments
    ):
        return "booked"

    return "available"


# ============================================================
# DOCTOR CALENDAR
# ============================================================

def _build_doctor_calendar(
    db: Session,
    doctor: Doctor,
    start_date: date,
    end_date: date,
) -> dict:
    days = {}

    current_date = start_date

    while current_date <= end_date:
        schedules = _get_schedule_for_date(
            db,
            doctor.id,
            current_date,
        )

        exception = _get_exception_for_date(
            db,
            doctor.id,
            current_date,
        )

        appointments = _load_appointments_for_date(
            db,
            doctor.id,
            current_date,
        )

        slots = _generate_slots(
            doctor=doctor,
            schedules=schedules,
            exception=exception,
            appointments=appointments,
            calendar_date=current_date,
        )

        status_counts = {
            "available": 0,
            "booked": 0,
            "break": 0,
            "not_available": 0,
        }

        for slot in slots.values():
            status = slot["status"]

            if status in status_counts:
                status_counts[status] += 1

        days[str(current_date)] = {
            "date": str(current_date),
            "day": current_date.strftime(
                "%A"
            ),
            "available_slots": status_counts[
                "available"
            ],
            "booked_slots": status_counts[
                "booked"
            ],
            "break_slots": status_counts[
                "break"
            ],
            "not_available_slots": status_counts[
                "not_available"
            ],
            "doctors": {
                str(doctor.id): slots
            },
        }

        current_date += timedelta(
            days=1
        )

    return days


# ============================================================
# DOCTOR NAME
# ============================================================

def _get_doctor_name(
    doctor: Doctor,
) -> str:
    if direct_name := getattr(
        doctor,
        "name",
        None,
    ):
        return str(
            direct_name
        ).strip()

    first_name = getattr(
        doctor,
        "first_name",
        None,
    ) or ""

    last_name = getattr(
        doctor,
        "last_name",
        None,
    ) or ""

    if full_name := (
        f"{first_name} {last_name}"
    ).strip():
        return full_name

    user = getattr(
        doctor,
        "user",
        None,
    )

    user_name = getattr(
        user,
        "name",
        None,
    )

    return (
        str(user_name).strip()
        if user_name
        else "Doctor"
    )


# ============================================================
# PUBLIC CALENDAR ENDPOINT
# ============================================================

@router.get("")
def get_public_calendar(
    start_date: date | None = Query(
        default=None
    ),
    end_date: date | None = Query(
        default=None
    ),
    doctor_id: int | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
):
    """
    Public calendar API.

    Availability is calculated dynamically using
    the doctor's local timezone.

    Slot lifecycle:

        Future slot       -> available
        Booked slot       -> booked
        Slot start passed -> not_available
        Past date         -> not_available
        Break             -> break
    """

    today = date.today()

    if start_date is None:
        start_date = today

    if end_date is None:
        end_date = (
            start_date
            + timedelta(days=30)
        )

    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail=(
                "end_date cannot be before "
                "start_date"
            ),
        )

    # --------------------------------------------------------
    # DOCTORS
    # --------------------------------------------------------

    doctor_query = db.query(Doctor)

    if doctor_id is not None:
        doctor_query = doctor_query.filter(
            Doctor.id == doctor_id
        )

    doctors = (
        doctor_query
        .order_by(Doctor.id)
        .all()
    )

    if (
        doctor_id is not None
        and not doctors
    ):
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )

    # --------------------------------------------------------
    # INITIALIZE DAYS
    # --------------------------------------------------------

    days = {}

    current_date = start_date

    while current_date <= end_date:
        days[str(current_date)] = {
            "date": str(current_date),
            "day": current_date.strftime(
                "%A"
            ),
            "available_slots": 0,
            "booked_slots": 0,
            "break_slots": 0,
            "not_available_slots": 0,
            "doctors": {},
        }

        current_date += timedelta(
            days=1
        )

    # --------------------------------------------------------
    # BUILD DOCTOR CALENDARS
    # --------------------------------------------------------

    time_slots = set()

    for doctor in doctors:
        doctor_days = _build_doctor_calendar(
            db=db,
            doctor=doctor,
            start_date=start_date,
            end_date=end_date,
        )

        for date_key, day_data in (
            doctor_days.items()
        ):
            doctor_slots = (
                day_data["doctors"].get(
                    str(doctor.id),
                    {},
                )
            )

            days[date_key]["doctors"][
                str(doctor.id)
            ] = doctor_slots

            time_slots.update(
                slot["start_time"]
                for slot
                in doctor_slots.values()
            )

    # --------------------------------------------------------
    # AGGREGATE COUNTS
    # --------------------------------------------------------

    for day_data in days.values():
        status_counts = {
            "available": 0,
            "booked": 0,
            "break": 0,
            "not_available": 0,
        }

        for doctor_slots in (
            day_data["doctors"].values()
        ):
            for slot in doctor_slots.values():
                status = slot["status"]

                if status in status_counts:
                    status_counts[status] += 1

        day_data["available_slots"] = (
            status_counts["available"]
        )

        day_data["booked_slots"] = (
            status_counts["booked"]
        )

        day_data["break_slots"] = (
            status_counts["break"]
        )

        day_data[
            "not_available_slots"
        ] = status_counts[
            "not_available"
        ]

    # --------------------------------------------------------
    # DOCTOR PAYLOAD
    # --------------------------------------------------------

    doctor_payload = [
        {
            "id": doctor.id,
            "name": _get_doctor_name(
                doctor
            ),
            "specialization": getattr(
                doctor,
                "specialization",
                None,
            ),
            "department": getattr(
                doctor,
                "department",
                None,
            ),
            "profile_photo": getattr(
                doctor,
                "profile_photo",
                None,
            ),
            "requires_referral": bool(
                getattr(
                    doctor,
                    "requires_referral",
                    False,
                )
            ),
            "timezone": _get_timezone_for_doctor(
                doctor
            ),
        }
        for doctor in doctors
    ]

    # --------------------------------------------------------
    # SERVER TIME
    # --------------------------------------------------------

    server_time = datetime.now(
        timezone.utc
    ).isoformat()

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "start_date": str(
            start_date
        ),
        "end_date": str(
            end_date
        ),
        "doctors": doctor_payload,
        "days": days,
        "time_slots": sorted(
            time_slots
        ),
        "server_time": server_time,
    }