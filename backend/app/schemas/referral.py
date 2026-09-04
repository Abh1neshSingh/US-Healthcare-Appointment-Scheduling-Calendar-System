from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class ReferralCreate(BaseModel):
    patient_id: int
    referring_doctor_id: int
    specialist_doctor_id: int

    referral_number: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    status: str = Field(
        default="ACTIVE",
        max_length=50,
    )

    issued_date: date

    expiry_date: Optional[date] = None

    reason: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    authorization_required: bool = False

    authorization_status: str = Field(
        default="NOT_REQUIRED",
        max_length=50,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )