from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class DoctorCreate(BaseModel):
    # User account information
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    # Professional information
    license_number: str = Field(..., min_length=2, max_length=100)
    npi_number: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=10,
    )

    specialization: str = Field(..., min_length=2, max_length=100)
    sub_specialization: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    qualification: str = Field(..., min_length=2, max_length=200)
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