from datetime import date, time
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.enums import AppointmentType


class AppointmentCreate(BaseModel):
    doctor_id: int = Field(..., gt=0)

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

    @field_validator("reason", "notes")
    @classmethod
    def clean_text_fields(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        value = value.strip()

        return value or None


class StaffAppointmentCreate(AppointmentCreate):
    """
    Appointment payload used by authorized front-desk staff
    to book an appointment for an existing patient.
    """

    patient_id: int = Field(..., gt=0)