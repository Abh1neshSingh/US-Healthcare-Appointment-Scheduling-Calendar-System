from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


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

    insurance_provider: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    insurance_member_id: Optional[str] = Field(
        default=None,
        max_length=100,
    )