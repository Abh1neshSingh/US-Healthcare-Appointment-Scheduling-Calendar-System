from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ReceptionistCreate(BaseModel):
    # User account information
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    # Receptionist information
    employee_id: str = Field(..., min_length=2, max_length=100)

    department: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    hire_date: Optional[str] = None

    shift: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    clinic_location: Optional[str] = Field(
        default=None,
        max_length=200,
    )