from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ==================================================
# SHARED VALIDATION HELPERS
# ==================================================

def clean_required_text(value: str, field_name: str) -> str:
    if not (value := value.strip()):
        raise ValueError(f"{field_name} cannot be empty")

    return value


def clean_optional_text(value: Optional[str]) -> Optional[str]:
    return None if value is None else value.strip() or None


# ==================================================
# DOCTOR CREATION
# ==================================================

class DoctorCreate(BaseModel):
    # User account information
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    # Professional information
    license_number: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

    npi_number: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=10,
    )

    specialization: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

    sub_specialization: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    qualification: str = Field(
        ...,
        min_length=2,
        max_length=200,
    )

    medical_school: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    board_certification: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    years_of_experience: Optional[int] = Field(
        default=None,
        ge=0,
        le=70,
    )

    department: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    # Referral / authorization policy
    requires_referral: bool = False

    # Practice information
    clinic_name: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    clinic_address: Optional[str] = Field(
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

    consultation_fee: Optional[float] = Field(
        default=None,
        ge=0,
    )

    consultation_mode: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    # Professional profile
    bio: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    languages: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    profile_photo: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    accepting_new_patients: bool = True

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

    @field_validator("license_number")
    @classmethod
    def validate_license_number(cls, value: str) -> str:
        return clean_required_text(value, "License number")

    @field_validator("specialization")
    @classmethod
    def validate_specialization(cls, value: str) -> str:
        return clean_required_text(value, "Specialization")

    @field_validator("qualification")
    @classmethod
    def validate_qualification(cls, value: str) -> str:
        return clean_required_text(value, "Qualification")

    @field_validator(
        "npi_number",
        "sub_specialization",
        "medical_school",
        "board_certification",
        "department",
        "clinic_name",
        "clinic_address",
        "city",
        "state",
        "zip_code",
        "consultation_mode",
        "bio",
        "languages",
        "profile_photo",
        mode="before",
    )
    @classmethod
    def clean_optional_fields(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)