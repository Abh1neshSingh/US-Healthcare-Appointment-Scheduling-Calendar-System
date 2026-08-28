from datetime import date, time
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import DayOfWeek


class DoctorScheduleCreate(BaseModel):
    day_of_week: DayOfWeek

    start_time: time
    end_time: time

    slot_duration: int = Field(
        default=30,
        ge=5,
        le=120,
    )

    break_start: Optional[time] = None
    break_end: Optional[time] = None

    is_available: bool = True

    effective_from: Optional[date] = None