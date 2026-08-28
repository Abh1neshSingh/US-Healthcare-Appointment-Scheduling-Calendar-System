from datetime import date, time
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import AppointmentType


class AppointmentCreate(BaseModel):
    doctor_id: int

    appointment_date: date

    start_time: time
    end_time: time

    appointment_type: AppointmentType = AppointmentType.IN_PERSON

    reason: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=5000,
    )