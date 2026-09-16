"""
Healthcare Chatbot API Schemas.

Responsibilities:
- Define request and response contracts for the chatbot.
- Define chatbot modes and intents.
- Represent extracted NLP entities.
- Represent conversational booking state.
- Represent doctor and availability information.
- Keep chatbot contracts independent from database models.

This module does NOT:
- create appointments
- modify appointments
- access the database
- perform insurance verification
- perform referral verification
- bypass authentication
- decide final appointment eligibility

The chatbot service layer remains responsible for application
and business logic.
"""

from __future__ import annotations

from datetime import date, time
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.enums import AppointmentType


# ============================================================
# ENUMS
# ============================================================


class ChatbotMode(str, Enum):
    """
    Identifies where the chatbot is being used.
    """

    HOME = "HOME"

    PATIENT = "PATIENT"


class ChatbotIntent(str, Enum):
    """
    High-level intents understood by the healthcare chatbot.
    """

    GREETING = "GREETING"

    BOOK_APPOINTMENT = "BOOK_APPOINTMENT"

    FIND_DOCTOR = "FIND_DOCTOR"

    VIEW_APPOINTMENTS = "VIEW_APPOINTMENTS"

    SELECT_DOCTOR = "SELECT_DOCTOR"

    SELECT_SPECIALTY = "SELECT_SPECIALTY"

    SELECT_DATE = "SELECT_DATE"

    SELECT_TIME = "SELECT_TIME"

    SELECT_APPOINTMENT_TYPE = "SELECT_APPOINTMENT_TYPE"

    PROVIDE_REASON = "PROVIDE_REASON"

    INSURANCE = "INSURANCE"

    HELP = "HELP"

    EMERGENCY = "EMERGENCY"

    CANCEL = "CANCEL"

    CHANGE_DETAILS = "CHANGE_DETAILS"

    UNKNOWN = "UNKNOWN"


# ============================================================
# SHARED VALIDATION
# ============================================================


def clean_optional_text(
    value: Optional[str],
) -> Optional[str]:
    """
    Strip optional text values and convert empty strings to None.
    """

    return (
        (cleaned := value.strip()) or None
        if value is not None
        else None
    )


def clean_required_text(
    value: str,
) -> str:
    """
    Strip required text values and reject empty strings.
    """

    if not (cleaned := value.strip()):
        raise ValueError(
            "Text value cannot be empty."
        )

    return cleaned


# ============================================================
# CHAT MESSAGE REQUEST
# ============================================================


class ChatbotMessage(BaseModel):
    """
    Request payload sent to the chatbot endpoint.
    """

    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
    )

    session_id: Optional[str] = Field(
        default=None,
        max_length=128,
    )

    @field_validator("message")
    @classmethod
    def validate_message(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)

    @field_validator("session_id")
    @classmethod
    def validate_session_id(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)


# ============================================================
# BOOKING DRAFT
# ============================================================


class ChatbotBookingDraft(BaseModel):
    """
    Conversational appointment booking draft.

    This is NOT an appointment creation payload.

    The existing appointment API remains the final source of
    truth for appointment creation and all business rules.
    """

    doctor_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    doctor_name: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    specialization: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    appointment_date: Optional[date] = None

    start_time: Optional[time] = None

    end_time: Optional[time] = None

    appointment_type: Optional[AppointmentType] = None

    reason: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    @field_validator(
        "doctor_name",
        "specialization",
        "reason",
        mode="before",
    )
    @classmethod
    def normalize_text_fields(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)


# ============================================================
# BOOKING CONFIRMATION REQUEST
# ============================================================


class ChatbotBookingConfirmation(BaseModel):
    """
    Request payload used to confirm the current chatbot booking draft.

    The session identifies conversational state only. The service
    layer performs the final appointment validation and delegates
    appointment creation to the existing appointment API.
    """

    session_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
    )

    @field_validator("session_id")
    @classmethod
    def normalize_confirmation_session_id(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)


# ============================================================
# NLP INTENT RESULT
# ============================================================


class ChatbotIntentResult(BaseModel):
    """
    Structured result returned by the chatbot NLP layer.
    """

    intent: ChatbotIntent

    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
    )

    specialty: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    doctor_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    doctor_name: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    appointment_date: Optional[date] = None

    start_time: Optional[time] = None

    appointment_type: Optional[AppointmentType] = None

    reason: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    entities: Dict[str, Any] = Field(
        default_factory=dict,
    )

    @field_validator(
        "specialty",
        "doctor_name",
        "reason",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)

    @field_validator("entities")
    @classmethod
    def normalize_entities(
        cls,
        value: Dict[str, Any],
    ) -> Dict[str, Any]:
        return dict(value)


# ============================================================
# CHATBOT OPTIONS
# ============================================================


class ChatbotOption(BaseModel):
    """
    One selectable chatbot option.
    """

    label: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    value: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    @field_validator("label", "value")
    @classmethod
    def normalize_option_text(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)


# ============================================================
# CHATBOT RESPONSE
# ============================================================


class ChatbotResponse(BaseModel):
    """
    Standard chatbot response returned to the frontend.
    """

    session_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
    )

    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
    )

    intent: ChatbotIntent = (
        ChatbotIntent.UNKNOWN
    )

    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
    )

    mode: ChatbotMode

    options: List[ChatbotOption] = Field(
        default_factory=list,
    )

    booking: Optional[ChatbotBookingDraft] = None

    requires_authentication: bool = False

    redirect_to_booking: bool = False

    emergency: bool = False

    @field_validator("session_id", "message")
    @classmethod
    def normalize_response_text(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)


# ============================================================
# DOCTOR
# ============================================================


class ChatbotDoctor(BaseModel):
    """
    Doctor information exposed to the chatbot.

    This is a response representation and is not a database model.
    """

    id: int = Field(
        ...,
        gt=0,
    )

    name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    specialization: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    requires_referral: bool = False

    @field_validator(
        "name",
        "specialization",
    )
    @classmethod
    def normalize_doctor_text(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)


# ============================================================
# AVAILABILITY SLOT
# ============================================================


class ChatbotAvailabilitySlot(BaseModel):
    """
    One appointment availability slot.
    """

    start_time: time

    end_time: time

    status: str = Field(
        default="available",
        min_length=1,
        max_length=50,
    )

    @field_validator("status")
    @classmethod
    def normalize_slot_status(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value).lower()


# ============================================================
# AVAILABILITY RESPONSE
# ============================================================


class ChatbotAvailabilityResponse(BaseModel):
    """
    Availability information used by the chatbot.

    Availability is read from the existing appointment/schedule
    system. This schema does not calculate or reserve a slot.
    """

    doctor_id: int = Field(
        ...,
        gt=0,
    )

    doctor_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    date: date

    day: str = Field(
        ...,
        min_length=1,
        max_length=30,
    )

    available: bool

    total_slots: int = Field(
        default=0,
        ge=0,
    )

    available_slots: int = Field(
        default=0,
        ge=0,
    )

    booked_slots: int = Field(
        default=0,
        ge=0,
    )

    slots: List[ChatbotAvailabilitySlot] = Field(
        default_factory=list,
    )

    message: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    @field_validator(
        "doctor_name",
        "day",
    )
    @classmethod
    def normalize_required_text(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)

    @field_validator("message")
    @classmethod
    def normalize_message(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)


# ============================================================
# PATIENT CONTEXT
# ============================================================


class ChatbotPatientContext(BaseModel):
    """
    Limited patient context required by the chatbot service.

    Sensitive clinical data is intentionally not stored here.
    """

    patient_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    patient_name: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    insurance_provider: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    insurance_member_id: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    authenticated: bool = False

    @field_validator(
        "patient_name",
        "insurance_provider",
        "insurance_member_id",
        mode="before",
    )
    @classmethod
    def normalize_patient_text(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)


# ============================================================
# CONVERSATION STATE
# ============================================================


class ChatbotConversationState(BaseModel):
    """
    Public representation of the current chatbot conversation.

    This matches the state maintained by ConversationManager.
    """

    session_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
    )

    mode: ChatbotMode

    specialty: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    doctor_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    doctor_name: Optional[str] = Field(
        default=None,
        max_length=150,
    )

    appointment_date: Optional[date] = None

    start_time: Optional[time] = None

    end_time: Optional[time] = None

    appointment_type: Optional[AppointmentType] = None

    reason: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    @field_validator(
        "session_id",
        mode="before",
    )
    @classmethod
    def normalize_session_id(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)

    @field_validator(
        "specialty",
        "doctor_name",
        "reason",
        mode="before",
    )
    @classmethod
    def normalize_state_text(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)


# ============================================================
# HEALTH RESPONSE
# ============================================================


class ChatbotHealthResponse(BaseModel):
    """
    Health/status response for the chatbot subsystem.
    """

    status: str = Field(
        default="ok",
        min_length=1,
        max_length=50,
    )

    service: str = Field(
        default="healthcare-chatbot",
        min_length=1,
        max_length=100,
    )

    transformer_enabled: bool = False

    transformer_loaded: bool = False

    model_name: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    active_sessions: int = Field(
        default=0,
        ge=0,
    )

    @field_validator("status", "service")
    @classmethod
    def normalize_health_text(
        cls,
        value: str,
    ) -> str:
        return clean_required_text(value)

    @field_validator("model_name")
    @classmethod
    def normalize_model_name(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        return clean_optional_text(value)