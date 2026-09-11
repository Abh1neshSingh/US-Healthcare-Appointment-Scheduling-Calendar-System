from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ==================================================
# VALIDATION HELPERS
# ==================================================

def clean_required_text(value: str, field_name: str) -> str:
    if not (value := value.strip()):
        raise ValueError(f"{field_name} cannot be empty")

    return value


def clean_optional_text(value: Optional[str]) -> Optional[str]:
    return None if value is None else value.strip() or None


# ==================================================
# REFERRAL CREATION
# ==================================================

class ReferralCreate(BaseModel):
    patient_id: int = Field(..., gt=0)
    referring_doctor_id: int = Field(..., gt=0)
    specialist_doctor_id: int = Field(..., gt=0)

    referral_number: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    status: str = Field(
        default="ACTIVE",
        min_length=1,
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
        min_length=1,
        max_length=50,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    # ==================================================
    # VALIDATION
    # ==================================================

    @field_validator(
        "patient_id",
        "referring_doctor_id",
        "specialist_doctor_id",
    )
    @classmethod
    def validate_ids(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("ID must be greater than zero")

        return value

    @field_validator("referral_number", "reason", "notes")
    @classmethod
    def clean_optional_fields(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return clean_required_text(value, "Status")

    @field_validator("authorization_status")
    @classmethod
    def validate_authorization_status(cls, value: str) -> str:
        return clean_required_text(
            value,
            "Authorization status",
        )