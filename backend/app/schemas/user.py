from datetime import date

from pydantic import BaseModel, EmailStr

from app.models.enums import UserRole


class UserCreate(BaseModel):

    name: str

    email: EmailStr

    password: str

    role: UserRole


class LoginRequest(BaseModel):

    email: EmailStr

    password: str


class PatientRegister(BaseModel):

    name: str

    email: EmailStr

    password: str

    date_of_birth: date

    gender: str

    phone: str

    city: str | None = None

    state: str | None = None

    # Insurance information
    insurance_provider: str | None = None
    insurance_member_id: str | None = None

    # Primary Care Provider
    pcp_doctor_id: int | None = None


class AdminCreate(BaseModel):

    name: str

    email: EmailStr

    password: str