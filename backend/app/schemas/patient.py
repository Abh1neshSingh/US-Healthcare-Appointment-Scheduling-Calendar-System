from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


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
# PATIENT CREATION
# ==================================================

class PatientCreate(BaseModel):
    # User account information
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    # Patient information
    date_of_birth: Optional[date] = None

    gender: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    address: Optional[str] = Field(
        default=None,
        max_length=300,
    )

    city: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    state: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    zip_code: Optional[str] = Field(
        default=None,
        max_length=20,
    )

    emergency_contact_name: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    emergency_contact_phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    # Insurance information
    insurance_provider: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    insurance_member_id: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    # Primary Care Provider (PCP)
    pcp_doctor_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    # ==================================================
    # VALIDATION
    # ==================================================

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_required_text(value, "Name")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> EmailStr:
        return EmailStr(str(value).strip().lower())

    @field_validator(
        "gender",
        "phone",
        "address",
        "city",
        "state",
        "zip_code",
        "emergency_contact_name",
        "emergency_contact_phone",
        "insurance_provider",
        "insurance_member_id",
        mode="before",
    )
    @classmethod
    def clean_optional_fields(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)