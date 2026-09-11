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
# RECEPTIONIST CREATION
# ==================================================

class ReceptionistCreate(BaseModel):
    # User account information
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    # Receptionist information
    employee_id: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

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

    @field_validator("employee_id")
    @classmethod
    def validate_employee_id(cls, value: str) -> str:
        return clean_required_text(value, "Employee ID")

    @field_validator(
        "department",
        "phone",
        "hire_date",
        "shift",
        "clinic_location",
        mode="before",
    )
    @classmethod
    def clean_optional_fields(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)