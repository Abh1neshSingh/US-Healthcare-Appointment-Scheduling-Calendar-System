from datetime import date

from pydantic import BaseModel, EmailStr

from app.models.enums import UserRole


# ==================================================
# USER CREATION
# ==================================================

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole


# ==================================================
# LOGIN
# ==================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ==================================================
# PATIENT REGISTRATION
# ==================================================

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


# ==================================================
# PATIENT PROFILE UPDATE
# ==================================================

class PatientProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None

    date_of_birth: date | None = None
    gender: str | None = None

    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None

    # Insurance information
    insurance_provider: str | None = None
    insurance_member_id: str | None = None

    # Primary Care Provider
    pcp_doctor_id: int | None = None


# ==================================================
# ADMIN CREATION
# ==================================================

class AdminCreate(BaseModel):
    name: str
    email: EmailStr
    password: str