from datetime import date, time
from typing import Optional

from pydantic import BaseModel, Field, model_validator

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

    # ==================================================
    # VALIDATION
    # ==================================================

    @model_validator(mode="after")
    def validate_schedule_times(self):
        if self.end_time <= self.start_time:
            raise ValueError(
                "End time must be later than start time"
            )

        if self.break_start is None and self.break_end is None:
            return self

        if self.break_start is None or self.break_end is None:
            raise ValueError(
                "Both break start and break end must be provided"
            )

        if self.break_end <= self.break_start:
            raise ValueError(
                "Break end time must be later than break start time"
            )

        if self.break_start < self.start_time:
            raise ValueError(
                "Break start time cannot be before schedule start time"
            )

        if self.break_end > self.end_time:
            raise ValueError(
                "Break end time cannot be after schedule end time"
            )

        return self