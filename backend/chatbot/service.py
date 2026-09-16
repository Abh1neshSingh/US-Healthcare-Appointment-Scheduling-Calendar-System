"""
Healthcare Chatbot Service Layer.

Responsibilities:
- Orchestrate NLP analysis and conversation state.
- Search active doctors from the existing database.
- Read existing doctor availability through the existing appointment
  availability implementation.
- Prepare a safe booking draft for the existing frontend booking flow.
- Provide appointment viewing guidance for authenticated patients.

This module does NOT:
- implement a separate appointment-creation system
- modify existing appointments
- bypass referral requirements
- bypass insurance requirements
- replace the existing appointment API
- expose private patient information to the home chatbot

The existing appointment creation endpoint remains the final source
of truth for appointment validation, referral/insurance rules,
schedule validation, overlap protection, and persistence.
"""

from __future__ import annotations

import logging
import re
from datetime import date, time
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.api.appointments import (
    create_appointment,
    get_appointment_status_label,
    get_doctor_availability,
    mark_expired_appointments_as_no_show,
)
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.enums import AppointmentType
from app.models.patient import Patient
from app.models.user import User
from app.schemas.appointment import AppointmentCreate

from .conversation import (
    ConversationManager,
    get_conversation_manager,
)
from .nlp import analyze_message
from .schemas import (
    ChatbotAvailabilityResponse,
    ChatbotAvailabilitySlot,
    ChatbotBookingDraft,
    ChatbotDoctor,
    ChatbotIntent,
    ChatbotIntentResult,
    ChatbotMessage,
    ChatbotMode,
    ChatbotOption,
    ChatbotResponse,
)

logger = logging.getLogger(__name__)


# ============================================================
# CONFIGURATION
# ============================================================

MAX_DOCTOR_OPTIONS = 8

MAX_APPOINTMENT_OPTIONS = 8


# ============================================================
# SERVICE
# ============================================================


class ChatbotService:
    """
    Main healthcare chatbot orchestration service.

    The service keeps conversational intelligence separate from
    FastAPI route definitions and from SQLAlchemy models.

    Appointment creation is intentionally delegated to the existing
    application booking flow. The chatbot only converts the current
    conversational draft into the existing AppointmentCreate contract.
    """

    def __init__(
        self,
        conversation_manager: Optional[ConversationManager] = None,
    ) -> None:
        self.conversation_manager = (
            conversation_manager
            or get_conversation_manager()
        )

    # ========================================================
    # MAIN MESSAGE HANDLER
    # ========================================================

    def handle_message(
        self,
        db: Session,
        payload: ChatbotMessage,
        mode: ChatbotMode,
        current_user: Optional[dict[str, Any]] = None,
    ) -> ChatbotResponse:
        """
        Process one chatbot message.

        Home mode may be anonymous.

        Patient mode requires an authenticated patient context
        for patient-specific actions.
        """

        session_id = (
            self.conversation_manager.get_or_create_session(
                mode=mode,
                session_id=payload.session_id,
                authenticated=self._is_authenticated_patient(
                    current_user
                ),
            )
        )

        self.conversation_manager.set_last_message(
            session_id,
            payload.message,
        )

        analysis = analyze_message(
            payload.message
        )

        analysis = self._apply_contextual_selection(
            db=db,
            session_id=session_id,
            message=payload.message,
            analysis=analysis,
        )

        self.conversation_manager.set_last_intent(
            session_id,
            analysis.intent.value,
        )

        self._merge_analysis_into_session(
            session_id,
            analysis,
        )

        try:
            return self._dispatch(
                db=db,
                session_id=session_id,
                mode=mode,
                analysis=analysis,
                current_user=current_user,
            )
        except Exception as exc:
            logger.exception(
                "Healthcare chatbot service error: %s",
                exc,
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "I’m sorry, but I couldn't process that request "
                    "right now. Please try again."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

    # ========================================================
    # CONTEXTUAL OPTION / CONVERSATION SELECTION
    # ========================================================

    def _apply_contextual_selection(
        self,
        db: Session,
        session_id: str,
        message: str,
        analysis: ChatbotIntentResult,
    ) -> ChatbotIntentResult:
        """
        Give the active conversation state priority when a user
        selects one of the options returned by the chatbot.

        The NLP layer understands natural language, while this
        method understands deterministic UI option values such as
        ``doctor:3`` or ``confirm_booking``. It also accepts the
        visible doctor label so the current frontend remains
        compatible during the transition to value-based buttons.
        """

        awaiting = (
            self.conversation_manager.get_awaiting(
                session_id
            )
        )

        normalized = re.sub(
            r"\s+",
            " ",
            message.strip().lower(),
        )

        if awaiting == "doctor":
            doctor = self._resolve_doctor_selection(
                db=db,
                message=message,
                analysis=analysis,
            )

            if doctor is not None:
                self.conversation_manager.set_doctor(
                    session_id,
                    doctor.id,
                    doctor.user.name,
                )

                self.conversation_manager.set_awaiting(
                    session_id,
                    "date",
                )

                return analysis.model_copy(
                    update={
                        "intent": ChatbotIntent.SELECT_DOCTOR,
                        "confidence": max(
                            analysis.confidence,
                            0.97,
                        ),
                        "doctor_id": doctor.id,
                        "doctor_name": doctor.user.name,
                        "specialty": (
                            doctor.specialization
                            or analysis.specialty
                        ),
                    }
                )

        if (
            awaiting == "date"
            and analysis.appointment_date is not None
        ):
                self.conversation_manager.set_date(
                    session_id,
                    analysis.appointment_date,
                )

                self.conversation_manager.set_awaiting(
                    session_id,
                    "time",
                )

                return analysis.model_copy(
                    update={
                        "intent": ChatbotIntent.SELECT_DATE,
                        "confidence": max(
                            analysis.confidence,
                            0.96,
                        ),
                    }
                )

        if (
            awaiting == "time"
            and analysis.start_time is not None
        ):
                self.conversation_manager.set_time(
                    session_id,
                    analysis.start_time,
                )

                self.conversation_manager.set_awaiting(
                    session_id,
                    "appointment_type",
                )

                return analysis.model_copy(
                    update={
                        "intent": ChatbotIntent.SELECT_TIME,
                        "confidence": max(
                            analysis.confidence,
                            0.96,
                        ),
                    }
                )

        if (
            awaiting == "appointment_type"
            and analysis.appointment_type is not None
        ):
                self.conversation_manager.set_appointment_type(
                    session_id,
                    analysis.appointment_type,
                )

                self.conversation_manager.set_awaiting(
                    session_id,
                    "reason",
                )

                return analysis.model_copy(
                    update={
                        "intent": (
                            ChatbotIntent.SELECT_APPOINTMENT_TYPE
                        ),
                        "confidence": max(
                            analysis.confidence,
                            0.96,
                        ),
                    }
                )

        if awaiting == "reason":
            skip_reason = normalized in {
                "skip",
                "skip reason",
                "no reason",
                "none",
                "not provided",
            }

            if not skip_reason:
                self.conversation_manager.set_reason(
                    session_id,
                    message.strip(),
                )

            self.conversation_manager.set_awaiting(
                session_id,
                "confirmation",
            )

            return analysis.model_copy(
                update={
                    "intent": ChatbotIntent.PROVIDE_REASON,
                    "confidence": max(
                        analysis.confidence,
                        0.96,
                    ),
                    "reason": (
                        None
                        if skip_reason
                        else message.strip()
                    ),
                }
            )

        if awaiting == "confirmation":
            if normalized in {
                "confirm",
                "confirm appointment",
                "yes",
                "yes confirm",
                "book it",
                "book appointment",
                "yes book it",
            }:
                return analysis.model_copy(
                    update={
                        "intent": ChatbotIntent.BOOK_APPOINTMENT,
                        "confidence": max(
                            analysis.confidence,
                            0.99,
                        ),
                        "entities": {
                            **analysis.entities,
                            "confirm_booking": True,
                        },
                    }
                )

            if normalized in {
                "change",
                "change details",
                "edit",
                "edit details",
            }:
                return analysis.model_copy(
                    update={
                        "intent": ChatbotIntent.CHANGE_DETAILS,
                        "confidence": max(
                            analysis.confidence,
                            0.97,
                        ),
                    }
                )

        return analysis

    def _resolve_doctor_selection(
        self,
        db: Session,
        message: str,
        analysis: ChatbotIntentResult,
    ) -> Optional[Doctor]:
        """
        Resolve a doctor selected from a chatbot option.

        Supported forms:
        - doctor:123
        - doctor_123
        - 123
        - Dr. John Carter
        - Dr. John Carter — Cardiology
        """

        normalized = re.sub(
            r"\s+",
            " ",
            message.strip(),
        )

        doctor_id_match = re.fullmatch(
            r"(?:doctor[\s:_-]*)?(\d+)",
            normalized,
            flags=re.IGNORECASE,
        )

        if doctor_id_match:
            doctor_id = int(
                doctor_id_match.group(1)
            )

            return (
                db.query(Doctor)
                .join(Doctor.user)
                .filter(
                    Doctor.id == doctor_id,
                    Doctor.active.is_(True),
                    User.is_active.is_(True),
                )
                .first()
            )

        if analysis.doctor_id:
            doctor = (
                db.query(Doctor)
                .join(Doctor.user)
                .filter(
                    Doctor.id == analysis.doctor_id,
                    Doctor.active.is_(True),
                    User.is_active.is_(True),
                )
                .first()
            )

            if doctor is not None:
                return doctor

        candidates = (
            db.query(Doctor)
            .join(Doctor.user)
            .filter(
                Doctor.active.is_(True),
                User.is_active.is_(True),
            )
            .order_by(
                User.name.asc(),
                Doctor.id.asc(),
            )
            .limit(MAX_DOCTOR_OPTIONS)
            .all()
        )

        def normalize_name(value: str) -> str:
            cleaned = re.sub(
                r"[^a-z0-9\s]",
                " ",
                value.lower(),
            )

            cleaned = re.sub(
                r"\bdoctor\b",
                " ",
                cleaned,
            )

            cleaned = re.sub(
                r"\bdr\b",
                " ",
                cleaned,
            )

            return re.sub(
                r"\s+",
                " ",
                cleaned,
            ).strip()

        selected_text = normalize_name(
            normalized
        )

        for doctor in candidates:
            doctor_name = normalize_name(
                doctor.user.name
            )

            doctor_label = normalize_name(
                (
                    f"{doctor.user.name} "
                    f"{doctor.specialization or ''}"
                )
            )

            if selected_text in {
                doctor_name,
                doctor_label,
            }:
                return doctor

        return None

    # ========================================================
    # DISPATCH
    # ========================================================

    def _dispatch(
        self,
        db: Session,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Route the detected intent to the appropriate service action.
        """

        if analysis.intent == ChatbotIntent.EMERGENCY:
            return self._emergency_response(
                session_id,
                mode,
                analysis,
            )

        if analysis.intent == ChatbotIntent.GREETING:
            return self._greeting_response(
                session_id,
                mode,
                analysis,
            )

        if analysis.intent == ChatbotIntent.HELP:
            return self._help_response(
                session_id,
                mode,
                analysis,
            )

        if analysis.intent == ChatbotIntent.INSURANCE:
            return self._insurance_response(
                db,
                session_id,
                mode,
                analysis,
                current_user,
            )

        if analysis.intent == ChatbotIntent.VIEW_APPOINTMENTS:
            return self._view_appointments(
                db,
                session_id,
                mode,
                analysis,
                current_user,
            )

        if analysis.intent == ChatbotIntent.CANCEL:
            return self._cancel_response(
                session_id,
                mode,
                analysis,
                current_user,
            )

        if analysis.intent == ChatbotIntent.CHANGE_DETAILS:
            return self._change_details_response(
                session_id,
                mode,
                analysis,
                current_user,
            )

        if analysis.intent == ChatbotIntent.SELECT_DOCTOR:
            return self._doctor_selected_response(
                db=db,
                session_id=session_id,
                mode=mode,
                analysis=analysis,
                current_user=current_user,
            )

        if analysis.intent in {
            ChatbotIntent.FIND_DOCTOR,
            ChatbotIntent.SELECT_SPECIALTY,
        }:
            return self._doctor_search_response(
                db,
                session_id,
                mode,
                analysis,
                current_user,
            )

        if analysis.entities.get(
            "confirm_booking"
        ):
            return self._confirm_chatbot_booking_response(
                db=db,
                session_id=session_id,
                mode=mode,
                analysis=analysis,
                current_user=current_user,
            )

        if analysis.intent in {
            ChatbotIntent.BOOK_APPOINTMENT,
            ChatbotIntent.SELECT_DATE,
            ChatbotIntent.SELECT_TIME,
            ChatbotIntent.SELECT_APPOINTMENT_TYPE,
            ChatbotIntent.PROVIDE_REASON,
        }:
            return self._booking_response(
                db,
                session_id,
                mode,
                analysis,
                current_user,
            )

        if (
            analysis.specialty
            or analysis.doctor_name
            or analysis.appointment_date
            or analysis.start_time
            or analysis.appointment_type
            or analysis.reason
        ):
            return self._booking_response(
                db,
                session_id,
                mode,
                analysis,
                current_user,
            )

        return self._unknown_response(
            session_id,
            mode,
            analysis,
        )

    # ========================================================
    # ANALYSIS → SESSION
    # ========================================================

    def _merge_analysis_into_session(
        self,
        session_id: str,
        analysis: ChatbotIntentResult,
    ) -> None:
        """
        Persist only explicitly extracted conversational fields.
        """

        self.conversation_manager.update_booking(
            session_id,
            specialty=analysis.specialty,
            doctor_name=analysis.doctor_name,
            appointment_date=analysis.appointment_date,
            start_time=analysis.start_time,
            appointment_type=analysis.appointment_type,
            reason=analysis.reason,
        )

    # ========================================================
    # AUTHENTICATION
    # ========================================================

    @staticmethod
    def _is_authenticated_patient(
        current_user: Optional[dict[str, Any]],
    ) -> bool:
        """
        Return true only for an authenticated PATIENT context.
        """

        if not current_user:
            return False

        return (
            str(current_user.get("role", "")).upper()
            == "PATIENT"
            and bool(current_user.get("user_id"))
        )

    def _authentication_response(
        self,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
    ) -> ChatbotResponse:
        """
        Standard response for patient-only operations.
        """

        return ChatbotResponse(
            session_id=session_id,
            message=(
                "Please sign in as a patient to continue with "
                "your appointment."
            ),
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
            requires_authentication=True,
            redirect_to_booking=False,
            booking=self.conversation_manager.get_booking_draft(
                session_id
            ),
        )

    # ========================================================
    # GREETING
    # ========================================================

    def _greeting_response(
        self,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
    ) -> ChatbotResponse:
        """
        Return a concise healthcare chatbot greeting.
        """

        if mode == ChatbotMode.PATIENT:
            message = (
                "Hello! I can help you find a doctor, check "
                "availability, and prepare an appointment."
            )
        else:
            message = (
                "Hello! I can help you find a doctor and "
                "learn how appointment booking works."
            )

        return ChatbotResponse(
            session_id=session_id,
            message=message,
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
            options=self._common_options(mode),
        )

    # ========================================================
    # HELP
    # ========================================================

    def _help_response(
        self,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
    ) -> ChatbotResponse:
        """
        Explain supported chatbot actions.
        """

        options = [
            ChatbotOption(
                label="Find a doctor",
                value="find_doctor",
            ),
            ChatbotOption(
                label="Book an appointment",
                value="book_appointment",
            ),
        ]

        if mode == ChatbotMode.PATIENT:
            options.extend(
                [
                    ChatbotOption(
                        label="My appointments",
                        value="view_appointments",
                    ),
                    ChatbotOption(
                        label="Insurance",
                        value="insurance",
                    ),
                ]
            )

        return ChatbotResponse(
            session_id=session_id,
            message=(
                "I can help with doctor search, appointment "
                "availability, appointment booking, and basic "
                "insurance or appointment information."
            ),
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
            options=options,
        )

    # ========================================================
    # EMERGENCY
    # ========================================================

    def _emergency_response(
        self,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
    ) -> ChatbotResponse:
        """
        Handle emergency language without attempting to schedule
        an appointment as a substitute for emergency care.
        """

        return ChatbotResponse(
            session_id=session_id,
            message=(
                "If you may be experiencing a medical emergency, "
                "call 911 or go to the nearest emergency department "
                "now. Do not wait for an appointment."
            ),
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
            emergency=True,
        )

    # ========================================================
    # INSURANCE
    # ========================================================

    def _insurance_response(
        self,
        db: Session,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Explain insurance handling without making eligibility
        decisions outside the existing appointment API.
        """

        if not self._is_authenticated_patient(current_user):
            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "Insurance details are available after patient "
                    "sign-in. The existing booking system performs "
                    "the final insurance and referral checks."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
                requires_authentication=True,
            )

        patient = self._get_current_patient(
            db=db,
            current_user=current_user,
        )

        if patient is None:
            return self._authentication_response(
                session_id,
                mode,
                analysis,
            )

        provider = (
            patient.insurance_provider
            or "Not provided"
        )

        member_id = (
            patient.insurance_member_id
            or "Not provided"
        )

        return ChatbotResponse(
            session_id=session_id,
            message=(
                f"Your insurance provider is {provider} and your "
                f"member ID is {member_id}. Final coverage, referral, "
                "and authorization checks remain handled by the "
                "existing appointment booking process."
            ),
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
        )

    # ========================================================
    # DOCTOR SEARCH
    # ========================================================

    def _doctor_selected_response(
        self,
        db: Session,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Continue the conversation after a doctor has been selected.

        Patient mode moves directly to date selection. Home mode
        cannot continue into patient-specific scheduling and instead
        sends the user to the secure patient login flow.
        """

        doctor = self._resolve_session_doctor(
            db=db,
            session_id=session_id,
        )

        if doctor is None:
            self.conversation_manager.set_awaiting(
                session_id,
                "doctor",
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "I couldn't confirm that doctor selection. "
                    "Please choose a doctor from the list."
                ),
                intent=ChatbotIntent.SELECT_DOCTOR,
                confidence=0.95,
                mode=mode,
                options=self._doctor_options(
                    db=db,
                    specialty=analysis.specialty,
                ),
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        if mode == ChatbotMode.HOME:
            self.conversation_manager.set_awaiting(
                session_id,
                None,
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    f"You selected {doctor.user.name}. "
                    "Please sign in as a patient to continue "
                    "with appointment booking."
                ),
                intent=ChatbotIntent.SELECT_DOCTOR,
                confidence=max(
                    analysis.confidence,
                    0.97,
                ),
                mode=mode,
                options=[
                    ChatbotOption(
                        label="Sign in to book",
                        value="login",
                    ),
                ],
                requires_authentication=True,
                redirect_to_booking=True,
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        self.conversation_manager.set_awaiting(
            session_id,
            "date",
        )

        return ChatbotResponse(
            session_id=session_id,
            message=(
                f"You're booking with {doctor.user.name}. "
                "What date would you like?"
            ),
            intent=ChatbotIntent.SELECT_DATE,
            confidence=max(
                analysis.confidence,
                0.97,
            ),
            mode=mode,
            booking=self.conversation_manager.get_booking_draft(
                session_id
            ),
        )

    def _doctor_options(
        self,
        db: Session,
        specialty: Optional[str] = None,
    ) -> list[ChatbotOption]:
        """Build reusable doctor-selection options."""

        doctors = self._search_doctors(
            db=db,
            specialty=specialty,
            doctor_name=None,
        )

        return [
            ChatbotOption(
                label=(
                    f"{doctor.name} — "
                    f"{doctor.specialization}"
                ),
                value=str(doctor.id),
            )
            for doctor in doctors
        ]

    def _doctor_search_response(
        self,
        db: Session,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Search currently active doctors.
        """

        doctors = self._search_doctors(
            db=db,
            specialty=analysis.specialty,
            doctor_name=analysis.doctor_name,
        )

        if not doctors:
            specialty_text = (
                f" for {analysis.specialty}"
                if analysis.specialty
                else ""
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "I couldn't find an active doctor"
                    f"{specialty_text}. "
                    "Try another specialty or doctor name."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
                options=self._common_options(mode),
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        options = [
            ChatbotOption(
                label=(
                    f"{doctor.name} — "
                    f"{doctor.specialization}"
                ),
                value=str(doctor.id),
            )
            for doctor in doctors
        ]

        if len(doctors) == 1:
            doctor = doctors[0]

            self.conversation_manager.set_doctor(
                session_id,
                doctor.id,
                doctor.name,
            )

            if analysis.intent in {
                ChatbotIntent.BOOK_APPOINTMENT,
                ChatbotIntent.SELECT_DOCTOR,
            }:
                return self._booking_response(
                    db=db,
                    session_id=session_id,
                    mode=mode,
                    analysis=analysis,
                    current_user=current_user,
                )

        self.conversation_manager.set_awaiting(
            session_id,
            "doctor",
        )

        message = (
            "I found these doctors. Select one to continue."
        )

        return ChatbotResponse(
            session_id=session_id,
            message=message,
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
            options=options[:MAX_DOCTOR_OPTIONS],
            booking=self.conversation_manager.get_booking_draft(
                session_id
            ),
        )

    def _search_doctors(
        self,
        db: Session,
        specialty: Optional[str],
        doctor_name: Optional[str],
    ) -> list[ChatbotDoctor]:
        """
        Search the same active doctor population exposed by the
        existing /users/doctors patient endpoint.
        """

        query = (
            db.query(Doctor)
            .join(Doctor.user)
            .filter(
                Doctor.active.is_(True),
                User.is_active.is_(True),
            )
        )

        if specialty:
            query = query.filter(
                Doctor.specialization.ilike(
                    f"%{specialty}%"
                )
            )

        if doctor_name:
            name_parts = [
                part
                for part in doctor_name.split()
                if part
            ]

            for part in name_parts:
                query = query.filter(
                    User.name.ilike(
                        f"%{part}%"
                    )
                )

        doctors = (
            query
            .order_by(
                User.name.asc(),
                Doctor.id.asc(),
            )
            .limit(MAX_DOCTOR_OPTIONS)
            .all()
        )

        return [
            ChatbotDoctor(
                id=doctor.id,
                name=doctor.user.name,
                specialization=doctor.specialization,
                requires_referral=bool(
                    doctor.requires_referral
                ),
            )
            for doctor in doctors
        ]

    # ========================================================
    # BOOKING
    # ========================================================

    def _booking_response(
        self,
        db: Session,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Prepare the booking draft and open the existing frontend
        booking flow when the minimum data is available.
        """

        if mode == ChatbotMode.HOME:
            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "I can help prepare the appointment details. "
                    "Please sign in as a patient to continue with "
                    "booking."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
                requires_authentication=True,
                redirect_to_booking=False,
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        if not self._is_authenticated_patient(current_user):
            return self._authentication_response(
                session_id,
                mode,
                analysis,
            )

        doctor = self._resolve_session_doctor(
            db,
            session_id,
        )

        if doctor is None:
            doctors = self._search_doctors(
                db=db,
                specialty=analysis.specialty,
                doctor_name=analysis.doctor_name,
            )

            if not doctors:
                return ChatbotResponse(
                    session_id=session_id,
                    message=(
                        "I couldn't find a matching doctor. "
                        "Please provide a doctor name or specialty."
                    ),
                    intent=analysis.intent,
                    confidence=analysis.confidence,
                    mode=mode,
                    options=self._common_options(mode),
                    booking=self.conversation_manager.get_booking_draft(
                        session_id
                    ),
                )

            if len(doctors) > 1:
                options = [
                    ChatbotOption(
                        label=(
                            f"{doctor_option.name} — "
                            f"{doctor_option.specialization}"
                        ),
                        value=str(doctor_option.id),
                    )
                    for doctor_option in doctors
                ]

                self.conversation_manager.set_awaiting(
                    session_id,
                    "doctor",
                )

                return ChatbotResponse(
                    session_id=session_id,
                    message=(
                        "Please select a doctor before I check "
                        "appointment availability."
                    ),
                    intent=ChatbotIntent.SELECT_DOCTOR,
                    confidence=0.95,
                    mode=mode,
                    options=options,
                    booking=self.conversation_manager.get_booking_draft(
                        session_id
                    ),
                )

            selected_doctor = doctors[0]

            self.conversation_manager.set_doctor(
                session_id,
                selected_doctor.id,
                selected_doctor.name,
            )

            doctor = (
                db.query(Doctor)
                .filter(
                    Doctor.id == selected_doctor.id,
                    Doctor.active.is_(True),
                )
                .first()
            )

        if doctor is None:
            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "The selected doctor is no longer available. "
                    "Please choose another doctor."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
            )

        appointment_date = (
            self._get_session_date(session_id)
        )

        if appointment_date is None:
            self.conversation_manager.set_awaiting(
                session_id,
                "date",
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    f"You're booking with {doctor.user.name}. "
                    "What date would you like?"
                ),
                intent=ChatbotIntent.SELECT_DATE,
                confidence=0.94,
                mode=mode,
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        availability = self._get_availability(
            db=db,
            doctor=doctor,
            appointment_date=appointment_date,
            current_user=current_user,
        )

        available_slots = [
            slot
            for slot in availability.slots
            if slot.status == "available"
        ]

        if not available_slots:
            self.conversation_manager.set_awaiting(
                session_id,
                "date",
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    f"{doctor.user.name} has no available slots on "
                    f"{appointment_date.strftime('%B %d, %Y')}. "
                    "Please choose another date."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        selected_start = self._get_session_time(
            session_id
        )

        if selected_start is None:
            self.conversation_manager.set_awaiting(
                session_id,
                "time",
            )

            options = [
                ChatbotOption(
                    label=(
                        slot.start_time.strftime(
                            "%I:%M %p"
                        )
                        + " – "
                        + slot.end_time.strftime(
                            "%I:%M %p"
                        )
                    ),
                    value=slot.start_time.strftime(
                        "%H:%M"
                    ),
                )
                for slot in available_slots[:MAX_APPOINTMENT_OPTIONS]
            ]

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    f"These times are available with {doctor.user.name} "
                    f"on {appointment_date.strftime('%B %d, %Y')}. "
                    "Please select a time."
                ),
                intent=ChatbotIntent.SELECT_TIME,
                confidence=0.95,
                mode=mode,
                options=options,
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        selected_slot = next(
            (
                slot
                for slot in available_slots
                if slot.start_time == selected_start
            ),
            None,
        )

        if selected_slot is None:
            self.conversation_manager.clear_booking_field(
                session_id,
                "time",
            )

            self.conversation_manager.set_awaiting(
                session_id,
                "time",
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "That time is not available. Please choose "
                    "one of the available times."
                ),
                intent=ChatbotIntent.SELECT_TIME,
                confidence=0.94,
                mode=mode,
                options=[
                    ChatbotOption(
                        label=(
                            slot.start_time.strftime(
                                "%I:%M %p"
                            )
                            + " – "
                            + slot.end_time.strftime(
                                "%I:%M %p"
                            )
                        ),
                        value=slot.start_time.strftime(
                            "%H:%M"
                        ),
                    )
                    for slot in available_slots[:MAX_APPOINTMENT_OPTIONS]
                ],
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        self.conversation_manager.set_end_time(
            session_id,
            selected_slot.end_time,
        )

        appointment_type = (
            self._get_session_appointment_type(
                session_id
            )
        )

        if appointment_type is None:
            self.conversation_manager.set_awaiting(
                session_id,
                "appointment_type",
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "Would you like an in-person visit or a "
                    "telehealth appointment?"
                ),
                intent=ChatbotIntent.SELECT_APPOINTMENT_TYPE,
                confidence=0.94,
                mode=mode,
                options=[
                    ChatbotOption(
                        label="In person",
                        value="IN_PERSON",
                    ),
                    ChatbotOption(
                        label="Telehealth",
                        value="TELEHEALTH",
                    ),
                ],
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        draft = (
            self.conversation_manager.get_booking_draft(
                session_id
            )
        )

        awaiting = (
            self.conversation_manager.get_awaiting(
                session_id
            )
        )

        if (
            draft is not None
            and draft.reason is None
            and awaiting != "confirmation"
        ):
            self.conversation_manager.set_awaiting(
                session_id,
                "reason",
            )

            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "What is the main reason for this appointment? "
                    "You can also say 'skip' if you do not want to "
                    "provide a reason."
                ),
                intent=ChatbotIntent.PROVIDE_REASON,
                confidence=0.94,
                mode=mode,
                options=[
                    ChatbotOption(
                        label="Skip reason",
                        value="skip_reason",
                    ),
                ],
                booking=draft,
            )

        self.conversation_manager.set_awaiting(
            session_id,
            "confirmation",
        )

        draft = (
            self.conversation_manager.get_booking_draft(
                session_id
            )
        )

        if draft is None:
            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "I couldn't prepare the appointment details. "
                    "Please try again."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
            )

        return ChatbotResponse(
            session_id=session_id,
            message=(
                f"Please review your appointment with "
                f"{doctor.user.name}. "
                f"Date: {draft.appointment_date.strftime('%B %d, %Y')}. "
                f"Time: {draft.start_time.strftime('%I:%M %p')} – "
                f"{draft.end_time.strftime('%I:%M %p')}. "
                f"Type: {draft.appointment_type.value.replace('_', ' ').title()}. "
                f"Reason: {draft.reason or 'Not provided'}. "
                "Would you like to confirm this appointment?"
            ),
            intent=ChatbotIntent.BOOK_APPOINTMENT,
            confidence=max(
                analysis.confidence,
                0.97,
            ),
            mode=mode,
            options=[
                ChatbotOption(
                    label="Confirm appointment",
                    value="confirm_booking",
                ),
                ChatbotOption(
                    label="Change details",
                    value="change_details",
                ),
            ],
            booking=draft,
        )

    def _confirm_chatbot_booking_response(
        self,
        db: Session,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Confirm an appointment from a conversational confirmation.

        The final persistence operation still goes through the existing
        appointment creation function, so the chatbot cannot bypass
        the application's normal booking rules.
        """

        if mode != ChatbotMode.PATIENT:
            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "Please sign in as a patient before confirming "
                    "an appointment."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
                requires_authentication=True,
                redirect_to_booking=True,
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        try:
            result = self.confirm_booking(
                db=db,
                session_id=session_id,
                current_user=current_user,
            )
        except ValueError as exc:
            return ChatbotResponse(
                session_id=session_id,
                message=str(exc),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
                booking=self.conversation_manager.get_booking_draft(
                    session_id
                ),
            )

        appointment = result.get(
            "appointment",
            {},
        )

        doctor_name = (
            appointment.get(
                "doctor_name"
            )
            or self.conversation_manager.get_booking_draft(
                session_id
            ).doctor_name
            if self.conversation_manager.get_booking_draft(
                session_id
            )
            else "your doctor"
        )

        appointment_date = appointment.get(
            "appointment_date"
        )

        start_time = appointment.get(
            "start_time"
        )

        return ChatbotResponse(
            session_id=session_id,
            message=(
                "Appointment booked successfully"
                + (
                    f" with {doctor_name}"
                    if doctor_name
                    else ""
                )
                + (
                    f" for {appointment_date}"
                    if appointment_date
                    else ""
                )
                + (
                    f" at {start_time}"
                    if start_time
                    else ""
                )
                + ". Your appointment has been added to "
                "your patient calendar."
            ),
            intent=ChatbotIntent.BOOK_APPOINTMENT,
            confidence=max(
                analysis.confidence,
                0.99,
            ),
            mode=mode,
            booking=None,
        )

    # ========================================================
    # BOOKING CONFIRMATION
    # ========================================================

    def confirm_booking(
        self,
        db: Session,
        session_id: str,
        current_user: Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Confirm and create the current chatbot booking draft.

        The chatbot does not implement a second appointment-creation
        system. It converts the conversational draft into the existing
        AppointmentCreate contract and delegates the final operation to
        the existing create_appointment() application API.

        This preserves the application's existing:
        - doctor validation
        - patient validation
        - schedule validation
        - past-date/time validation
        - insurance checks
        - referral checks
        - authorization checks
        - overlap protection
        - appointment persistence
        - confirmation email behavior
        """

        if not self._is_authenticated_patient(current_user):
            raise ValueError(
                "Patient authentication is required to confirm "
                "the appointment."
            )

        session = self.conversation_manager.get_session(
            session_id
        )

        if session is None:
            raise ValueError(
                "The chatbot session has expired. "
                "Please start the booking again."
            )

        if session.mode != ChatbotMode.PATIENT:
            raise ValueError(
                "Only a patient chatbot session can confirm "
                "an appointment."
            )

        draft = self.conversation_manager.get_booking_draft(
            session_id
        )

        if draft is None:
            raise ValueError(
                "No active booking draft was found."
            )

        if missing_fields := (
            self.conversation_manager.missing_booking_fields(
                session_id
            )
        ):
            missing_labels = ", ".join(
                field.replace("_", " ")
                for field in missing_fields
            )

            raise ValueError(
                "The appointment is missing required details: "
                f"{missing_labels}."
            )

        if draft.doctor_id is None:
            raise ValueError(
                "Please select a doctor before confirming "
                "the appointment."
            )

        if draft.appointment_date is None:
            raise ValueError(
                "Please select an appointment date before "
                "confirming the appointment."
            )

        if draft.start_time is None:
            raise ValueError(
                "Please select an appointment time before "
                "confirming the appointment."
            )

        if draft.end_time is None:
            raise ValueError(
                "The selected appointment slot has no end time. "
                "Please select another available time."
            )

        if draft.appointment_type is None:
            raise ValueError(
                "Please select an appointment type before "
                "confirming the appointment."
            )

        appointment_data = AppointmentCreate(
            doctor_id=draft.doctor_id,
            appointment_date=draft.appointment_date,
            start_time=draft.start_time,
            end_time=draft.end_time,
            appointment_type=draft.appointment_type,
            reason=draft.reason,
            notes=None,
        )

        result = create_appointment(
            appointment_data=appointment_data,
            current_user=current_user,
            db=db,
        )

        self.conversation_manager.set_awaiting(
            session_id,
            None,
        )

        return result

    # ========================================================
    # AVAILABILITY
    # ========================================================

    def _get_availability(
        self,
        db: Session,
        doctor: Doctor,
        appointment_date: date,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotAvailabilityResponse:
        """
        Reuse the existing appointment availability implementation
        instead of duplicating schedule and overlap business rules.
        """

        availability_user = current_user or {
            "user_id": "0",
            "role": "PATIENT",
        }

        raw_result = get_doctor_availability(
            doctor_id=doctor.id,
            appointment_date=appointment_date,
            current_user=availability_user,
            db=db,
        )

        slots = [
            ChatbotAvailabilitySlot(
                start_time=self._coerce_time(
                    item.get("start_time")
                ),
                end_time=self._coerce_time(
                    item.get("end_time")
                ),
                status=str(
                    item.get("status", "available")
                ).lower(),
            )
            for item in raw_result.get(
                "slots",
                [],
            )
        ]

        return ChatbotAvailabilityResponse(
            doctor_id=doctor.id,
            doctor_name=doctor.user.name,
            date=appointment_date,
            day=str(
                raw_result.get(
                    "day",
                    appointment_date.strftime("%A"),
                )
            ),
            available=bool(
                raw_result.get(
                    "available",
                    False,
                )
            ),
            total_slots=int(
                raw_result.get(
                    "total_slots",
                    len(slots),
                )
            ),
            available_slots=int(
                raw_result.get(
                    "available_slots",
                    sum(
                        slot.status == "available"
                        for slot in slots
                    ),
                )
            ),
            booked_slots=int(
                raw_result.get(
                    "booked_slots",
                    sum(
                        slot.status == "booked"
                        for slot in slots
                    ),
                )
            ),
            slots=slots,
            message=raw_result.get("message"),
        )

    @staticmethod
    def _coerce_time(
        value: Any,
    ) -> time:
        """
        Convert an existing availability time representation into
        a Python time object.
        """

        if isinstance(value, time):
            return value

        if isinstance(value, str):
            return time.fromisoformat(
                value
            )

        raise ValueError(
            "Invalid appointment slot time."
        )

    # ========================================================
    # SESSION FIELD READERS
    # ========================================================

    def _resolve_session_doctor(
        self,
        db: Session,
        session_id: str,
    ) -> Optional[Doctor]:
        """
        Resolve the selected doctor from conversation state.
        """

        session = self.conversation_manager.get_session(
            session_id
        )

        if session is None or session.doctor_id is None:
            return None

        return (
            db.query(Doctor)
            .filter(
                Doctor.id == session.doctor_id,
                Doctor.active.is_(True),
            )
            .first()
        )

    def _get_session_date(
        self,
        session_id: str,
    ) -> Optional[date]:
        """
        Return the current booking date.
        """

        session = self.conversation_manager.get_session(
            session_id
        )

        return (
            session.appointment_date
            if session
            else None
        )

    def _get_session_time(
        self,
        session_id: str,
    ) -> Optional[time]:
        """
        Return the current booking start time.
        """

        session = self.conversation_manager.get_session(
            session_id
        )

        return (
            session.start_time
            if session
            else None
        )

    def _get_session_appointment_type(
        self,
        session_id: str,
    ) -> Optional[AppointmentType]:
        """
        Return the current appointment type.
        """

        session = self.conversation_manager.get_session(
            session_id
        )

        return (
            session.appointment_type
            if session
            else None
        )

    # ========================================================
    # VIEW APPOINTMENTS
    # ========================================================

    def _view_appointments(
        self,
        db: Session,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Show a concise patient appointment summary.
        """

        if not self._is_authenticated_patient(current_user):
            return self._authentication_response(
                session_id,
                mode,
                analysis,
            )

        patient = self._get_current_patient(
            db=db,
            current_user=current_user,
        )

        if patient is None:
            return ChatbotResponse(
                session_id=session_id,
                message="Patient profile not found.",
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
            )

        mark_expired_appointments_as_no_show(
            db,
            patient_id=patient.id,
        )

        appointments = (
            db.query(Appointment)
            .filter(
                Appointment.patient_id == patient.id
            )
            .order_by(
                Appointment.appointment_date.asc(),
                Appointment.start_time.asc(),
            )
            .limit(MAX_APPOINTMENT_OPTIONS)
            .all()
        )

        if not appointments:
            return ChatbotResponse(
                session_id=session_id,
                message=(
                    "You don't have any appointments in the system."
                ),
                intent=analysis.intent,
                confidence=analysis.confidence,
                mode=mode,
            )

        lines = []

        for appointment in appointments:
            doctor_name = (
                appointment.doctor.user.name
                if appointment.doctor
                and appointment.doctor.user
                else "Doctor"
            )

            lines.append(
                (
                    f"{appointment.appointment_date.strftime('%b %d, %Y')} "
                    f"at {appointment.start_time.strftime('%I:%M %p')} "
                    f"with {doctor_name} — "
                    f"{get_appointment_status_label(appointment.status)}"
                )
            )

        return ChatbotResponse(
            session_id=session_id,
            message=(
                "Here are your appointments:\n"
                + "\n".join(lines)
            ),
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
        )

    # ========================================================
    # CANCEL
    # ========================================================

    def _cancel_response(
        self,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Explain that cancellation should continue through the
        existing appointment-management flow.

        No cancellation is performed here.
        """

        if not self._is_authenticated_patient(current_user):
            return self._authentication_response(
                session_id,
                mode,
                analysis,
            )

        return ChatbotResponse(
            session_id=session_id,
            message=(
                "I can help you locate your appointment, but I "
                "won't cancel it directly from the chatbot. Please "
                "use the appointment management controls so the "
                "existing cancellation rules remain enforced."
            ),
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
        )

    # ========================================================
    # CHANGE DETAILS
    # ========================================================

    def _change_details_response(
        self,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
        current_user: Optional[dict[str, Any]],
    ) -> ChatbotResponse:
        """
        Prepare a new booking selection without modifying an
        existing appointment.
        """

        if not self._is_authenticated_patient(current_user):
            return self._authentication_response(
                session_id,
                mode,
                analysis,
            )

        self.conversation_manager.set_awaiting(
            session_id,
            "booking_change",
        )

        return ChatbotResponse(
            session_id=session_id,
            message=(
                "I can help prepare a new appointment selection. "
                "Tell me the new doctor, date, time, or appointment "
                "type you want. Your existing appointment will not "
                "be changed by the chatbot."
            ),
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
            booking=self.conversation_manager.get_booking_draft(
                session_id
            ),
        )

    # ========================================================
    # UNKNOWN
    # ========================================================

    def _unknown_response(
        self,
        session_id: str,
        mode: ChatbotMode,
        analysis: ChatbotIntentResult,
    ) -> ChatbotResponse:
        """
        Safe fallback for unsupported language.
        """

        return ChatbotResponse(
            session_id=session_id,
            message=(
                "I can help you find a doctor, check availability, "
                "or prepare an appointment. What would you like to do?"
            ),
            intent=analysis.intent,
            confidence=analysis.confidence,
            mode=mode,
            options=self._common_options(mode),
        )

    # ========================================================
    # COMMON OPTIONS
    # ========================================================

    @staticmethod
    def _common_options(
        mode: ChatbotMode,
    ) -> list[ChatbotOption]:
        """
        Return common chatbot actions.
        """

        options = [
            ChatbotOption(
                label="Find a doctor",
                value="find_doctor",
            ),
            ChatbotOption(
                label="Book an appointment",
                value="book_appointment",
            ),
        ]

        if mode == ChatbotMode.PATIENT:
            options.append(
                ChatbotOption(
                    label="My appointments",
                    value="view_appointments",
                )
            )

        return options

    # ========================================================
    # PATIENT
    # ========================================================

    @staticmethod
    def _get_current_patient(
        db: Optional[Session],
        current_user: Optional[dict[str, Any]],
    ) -> Optional[Patient]:
        """
        Resolve the authenticated patient from the database.
        """

        if db is None or not current_user:
            return None

        user_id = current_user.get(
            "user_id"
        )

        if not user_id:
            return None

        try:
            numeric_user_id = int(user_id)
        except (TypeError, ValueError):
            return None

        return (
            db.query(Patient)
            .filter(
                Patient.user_id == numeric_user_id,
                Patient.active.is_(True),
            )
            .first()
        )


# ============================================================
# SHARED SERVICE INSTANCE
# ============================================================


_chatbot_service = ChatbotService()


def get_chatbot_service() -> ChatbotService:
    """
    Return the shared chatbot service instance.
    """

    return _chatbot_service


# ============================================================
# CONVENIENCE API
# ============================================================


def handle_chatbot_message(
    db: Session,
    payload: ChatbotMessage,
    mode: ChatbotMode,
    current_user: Optional[dict[str, Any]] = None,
) -> ChatbotResponse:
    """
    Convenience wrapper for the chatbot route layer.
    """

    return get_chatbot_service().handle_message(
        db=db,
        payload=payload,
        mode=mode,
        current_user=current_user,
    )