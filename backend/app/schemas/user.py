from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import UserRole


# ==================================================
# SHARED VALIDATION HELPERS
# ==================================================

def validate_name(value: str) -> str:
    value = value.strip()

    if not value:
        raise ValueError("Name cannot be empty")

    if len(value) > 100:
        raise ValueError("Name must be 100 characters or fewer")

    return value


def validate_phone(value: str) -> str:
    value = value.strip()

    if not value:
        raise ValueError("Phone cannot be empty")

    if len(value) > 30:
        raise ValueError("Phone must be 30 characters or fewer")

    return value


# ==================================================
# USER CREATION
# ==================================================

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole

    @field_validator("name")
    @classmethod
    def validate_user_name(cls, value: str) -> str:
        return validate_name(value)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


# ==================================================
# LOGIN
# ==================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_login_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


# ==================================================
# PATIENT REGISTRATION
# ==================================================

class PatientRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    date_of_birth: date
    gender: str = Field(..., min_length=1, max_length=50)
    phone: str = Field(..., min_length=1, max_length=30)

    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)

    # Insurance information
    insurance_provider: str | None = Field(
        default=None,
        max_length=150,
    )

    insurance_member_id: str | None = Field(
        default=None,
        max_length=100,
    )

    # Primary Care Provider
    pcp_doctor_id: int | None = Field(
        default=None,
        gt=0,
    )

    @field_validator("name")
    @classmethod
    def validate_patient_name(cls, value: str) -> str:
        return validate_name(value)

    @field_validator("email")
    @classmethod
    def normalize_patient_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("phone")
    @classmethod
    def validate_patient_phone(cls, value: str) -> str:
        return validate_phone(value)

    @field_validator(
        "gender",
        "city",
        "state",
        "insurance_provider",
        "insurance_member_id",
        mode="before",
    )
    @classmethod
    def strip_optional_strings(cls, value):
        if value is None:
            return None

        value = str(value).strip()

        return value or None


# ==================================================
# PATIENT PROFILE UPDATE
# ==================================================

class PatientProfileUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        max_length=100,
    )

    phone: str | None = Field(
        default=None,
        max_length=30,
    )

    date_of_birth: date | None = None

    gender: str | None = Field(
        default=None,
        max_length=50,
    )

    address: str | None = Field(
        default=None,
        max_length=255,
    )

    city: str | None = Field(
        default=None,
        max_length=100,
    )

    state: str | None = Field(
        default=None,
        max_length=100,
    )

    zip_code: str | None = Field(
        default=None,
        max_length=20,
    )

    # Insurance information
    insurance_provider: str | None = Field(
        default=None,
        max_length=150,
    )

    insurance_member_id: str | None = Field(
        default=None,
        max_length=100,
    )

    # Primary Care Provider
    pcp_doctor_id: int | None = Field(
        default=None,
        gt=0,
    )

    @field_validator("name")
    @classmethod
    def validate_updated_name(
        cls,
        value: str | None,
    ) -> str | None:
        return None if value is None else validate_name(value)

    @field_validator("phone")
    @classmethod
    def validate_updated_phone(
        cls,
        value: str | None,
    ) -> str | None:
        return None if value is None else validate_phone(value)

    @field_validator(
        "gender",
        "address",
        "city",
        "state",
        "zip_code",
        "insurance_provider",
        "insurance_member_id",
        mode="before",
    )
    @classmethod
    def strip_updated_strings(cls, value):
        return None if value is None else str(value).strip() or None


# ==================================================
# ADMIN CREATION
# ==================================================

class AdminCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    email: EmailStr

    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
    )

    @field_validator("name")
    @classmethod
    def validate_admin_name(cls, value: str) -> str:
        return validate_name(value)

    @field_validator("email")
    @classmethod
    def normalize_admin_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()