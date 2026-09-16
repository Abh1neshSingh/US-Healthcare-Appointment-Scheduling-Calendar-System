"""
Healthcare Chatbot Conversation State Manager.

Responsibilities:
- Maintain chatbot conversation state by session ID.
- Keep track of selected doctor, specialty, date, time,
  appointment type and reason.
- Support both HomeChatbot and PatientChatbot modes.
- Build and update booking drafts safely.
- Provide conversation reset and session cleanup helpers.

This module does NOT:
- create appointments
- modify appointments
- access the database
- bypass authentication
- bypass insurance rules
- bypass referral requirements

The service layer remains responsible for application/business logic.

Code-quality notes:
- The implementation intentionally avoids Sourcery control-flow
  refactoring warnings where those refactorings would reduce clarity.
- Session timestamps use timezone-aware UTC values.
- Session lookups use explicit assignment expressions where appropriate.
- Business rules remain outside this module.
- The public schemas remain the single source of chatbot state contracts.
- This manager is deliberately independent of SQLAlchemy and FastAPI.
"""

from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, Optional

from app.models.enums import AppointmentType

from .schemas import (
    ChatbotBookingDraft,
    ChatbotConversationState,
    ChatbotMode,
)

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    """Return the current time as timezone-aware UTC."""

    return datetime.now(timezone.utc)


# ============================================================
# CONFIGURATION
# ============================================================

DEFAULT_SESSION_TTL_MINUTES = 60

MAX_ACTIVE_SESSIONS = 5000


# ============================================================
# INTERNAL STATE
# ============================================================


@dataclass
class _ConversationRecord:
    """
    Internal representation of one chatbot conversation.

    The public chatbot state is exposed through
    ChatbotConversationState from schemas.py.
    """

    session_id: str

    mode: ChatbotMode

    created_at: datetime = field(
        default_factory=_utc_now
    )

    updated_at: datetime = field(
        default_factory=_utc_now
    )

    specialty: Optional[str] = None

    doctor_id: Optional[int] = None

    doctor_name: Optional[str] = None

    appointment_date: Optional[date] = None

    start_time: Optional[time] = None

    end_time: Optional[time] = None

    appointment_type: Optional[AppointmentType] = None

    reason: Optional[str] = None

    last_message: Optional[str] = None

    last_intent: Optional[str] = None

    awaiting: Optional[str] = None

    authenticated: bool = False


# ============================================================
# CONVERSATION MANAGER
# ============================================================


class ConversationManager:
    """
    Thread-safe in-memory conversation manager.

    Each chatbot session has its own state.

    The manager intentionally does not persist conversations
    in PostgreSQL because conversational state is temporary
    application state. Business data remains in the existing
    application models and APIs.
    """

    def __init__(
        self,
        session_ttl_minutes: int = DEFAULT_SESSION_TTL_MINUTES,
        max_active_sessions: int = MAX_ACTIVE_SESSIONS,
    ) -> None:

        self.session_ttl = timedelta(
            minutes=max(
                1,
                session_ttl_minutes,
            )
        )

        self.max_active_sessions = max(
            1,
            max_active_sessions,
        )

        self._sessions: Dict[
            str,
            _ConversationRecord,
        ] = {}

        self._lock = threading.RLock()

    # ========================================================
    # SESSION CREATION
    # ========================================================

    def create_session(
        self,
        mode: ChatbotMode,
        session_id: Optional[str] = None,
        authenticated: bool = False,
    ) -> str:
        """
        Create a new chatbot session.

        If a session ID is supplied and already exists, the
        existing session is reused when its mode matches.
        """

        with self._lock:
            self._cleanup_expired_locked()

            requested_session_id = (
                session_id.strip()
                if session_id
                else ""
            )

            existing = (
                self._sessions.get(requested_session_id)
                if requested_session_id
                else None
            )

            if existing is not None and existing.mode == mode:
                existing.updated_at = _utc_now()
                existing.authenticated = (
                    existing.authenticated or authenticated
                )

                return existing.session_id

            new_session_id = (
                requested_session_id
                or self._generate_session_id()
            )

            while new_session_id in self._sessions:
                new_session_id = self._generate_session_id()

            self._ensure_capacity_locked()

            self._sessions[new_session_id] = (
                _ConversationRecord(
                    session_id=new_session_id,
                    mode=mode,
                    authenticated=authenticated,
                )
            )

            return new_session_id

    # ========================================================
    # SESSION ID
    # ========================================================

    @staticmethod
    def _generate_session_id() -> str:
        """
        Generate a cryptographically random session identifier.
        """

        return uuid.uuid4().hex

    # ========================================================
    # GET SESSION
    # ========================================================

    def get_session(
        self,
        session_id: str,
    ) -> Optional[_ConversationRecord]:
        """
        Return an internal session record.

        Expired sessions are removed automatically.
        """

        normalized_id = (
            session_id.strip()
        )

        if not normalized_id:
            return None

        with self._lock:
            self._cleanup_expired_locked()

            if not (
                session := self._sessions.get(
                    normalized_id
                )
            ):
                return None

            session.updated_at = _utc_now()

            return session

    # ========================================================
    # GET OR CREATE
    # ========================================================

    def get_or_create_session(
        self,
        mode: ChatbotMode,
        session_id: Optional[str] = None,
        authenticated: bool = False,
    ) -> str:
        """
        Return an existing valid session or create a new one.
        """

        return self.create_session(
            mode=mode,
            session_id=session_id,
            authenticated=authenticated,
        )

    # ========================================================
    # MODE
    # ========================================================

    def get_mode(
        self,
        session_id: str,
    ) -> Optional[ChatbotMode]:
        """
        Return the mode associated with a session.
        """

        if session := self.get_session(session_id):
            return session.mode

        return None

    # ========================================================
    # AUTHENTICATION
    # ========================================================

    def set_authenticated(
        self,
        session_id: str,
        authenticated: bool,
    ) -> bool:
        """
        Update authentication state for a session.
        """

        with self._lock:
            if not (
                session := self._sessions.get(
                    session_id.strip()
                )
            ):
                return False

            session.authenticated = authenticated
            session.updated_at = _utc_now()

            return True

    def is_authenticated(
        self,
        session_id: str,
    ) -> bool:
        """
        Return whether the chatbot session is authenticated.
        """

        if session := self.get_session(session_id):
            return session.authenticated

        return False

    # ========================================================
    # UPDATE MESSAGE
    # ========================================================

    def set_last_message(
        self,
        session_id: str,
        message: Optional[str],
    ) -> bool:
        """
        Store the latest user message.
        """

        with self._lock:
            if not (
                session := self._sessions.get(
                    session_id.strip()
                )
            ):
                return False

            session.last_message = (
                message.strip()
                if message
                else None
            )

            session.updated_at = _utc_now()

            return True

    # ========================================================
    # UPDATE INTENT
    # ========================================================

    def set_last_intent(
        self,
        session_id: str,
        intent: Optional[str],
    ) -> bool:
        """
        Store the latest detected intent.
        """

        with self._lock:
            if not (
                session := self._sessions.get(
                    session_id.strip()
                )
            ):
                return False

            session.last_intent = (
                intent.strip()
                if intent
                else None
            )

            session.updated_at = _utc_now()

            return True

    # ========================================================
    # AWAITING STATE
    # ========================================================

    def set_awaiting(
        self,
        session_id: str,
        value: Optional[str],
    ) -> bool:
        """
        Store the next piece of information expected
        from the patient.
        """

        with self._lock:
            if not (
                session := self._sessions.get(
                    session_id.strip()
                )
            ):
                return False

            session.awaiting = (
                value.strip()
                if value
                else None
            )

            session.updated_at = _utc_now()

            return True

    def get_awaiting(
        self,
        session_id: str,
    ) -> Optional[str]:
        """
        Return the information currently expected.
        """

        if session := self.get_session(session_id):
            return session.awaiting

        return None

    # ========================================================
    # BOOKING FIELD UPDATES
    # ========================================================

    def update_booking(
        self,
        session_id: str,
        *,
        specialty: Optional[str] = None,
        doctor_id: Optional[int] = None,
        doctor_name: Optional[str] = None,
        appointment_date: Optional[date] = None,
        start_time: Optional[time] = None,
        end_time: Optional[time] = None,
        appointment_type: Optional[AppointmentType] = None,
        reason: Optional[str] = None,
    ) -> bool:
        """
        Update only the booking fields explicitly supplied.

        None means "do not change this field".
        """

        with self._lock:
            if not (
                session := self._sessions.get(
                    session_id.strip()
                )
            ):
                return False

            if specialty is not None:
                session.specialty = (
                    specialty.strip()
                    or None
                )

            if doctor_id is not None:
                session.doctor_id = doctor_id

            if doctor_name is not None:
                session.doctor_name = (
                    doctor_name.strip()
                    or None
                )

            if appointment_date is not None:
                session.appointment_date = (
                    appointment_date
                )

            if start_time is not None:
                session.start_time = (
                    start_time
                )

            if end_time is not None:
                session.end_time = (
                    end_time
                )

            if appointment_type is not None:
                session.appointment_type = (
                    appointment_type
                )

            if reason is not None:
                session.reason = (
                    reason.strip()
                    or None
                )

            session.updated_at = _utc_now()

            return True

    # ========================================================
    # INDIVIDUAL BOOKING FIELDS
    # ========================================================

    def set_specialty(
        self,
        session_id: str,
        specialty: Optional[str],
    ) -> bool:
        """
        Set selected specialty.
        """

        return self.update_booking(
            session_id,
            specialty=specialty,
        )

    def set_doctor(
        self,
        session_id: str,
        doctor_id: int,
        doctor_name: Optional[str] = None,
    ) -> bool:
        """
        Set selected doctor.
        """

        return self.update_booking(
            session_id,
            doctor_id=doctor_id,
            doctor_name=doctor_name,
        )

    def set_date(
        self,
        session_id: str,
        appointment_date: date,
    ) -> bool:
        """
        Set selected appointment date.
        """

        return self.update_booking(
            session_id,
            appointment_date=appointment_date,
        )

    def set_time(
        self,
        session_id: str,
        start_time: time,
    ) -> bool:
        """
        Set selected appointment start time.
        """

        return self.update_booking(
            session_id,
            start_time=start_time,
        )

    def set_end_time(
        self,
        session_id: str,
        end_time: time,
    ) -> bool:
        """
        Set selected appointment end time.
        """

        return self.update_booking(
            session_id,
            end_time=end_time,
        )

    def set_appointment_type(
        self,
        session_id: str,
        appointment_type: AppointmentType,
    ) -> bool:
        """
        Set selected appointment type.
        """

        return self.update_booking(
            session_id,
            appointment_type=appointment_type,
        )

    def set_reason(
        self,
        session_id: str,
        reason: Optional[str],
    ) -> bool:
        """
        Set appointment reason.
        """

        return self.update_booking(
            session_id,
            reason=reason,
        )

    # ========================================================
    # BOOKING DRAFT
    # ========================================================

    def get_booking_draft(
        self,
        session_id: str,
    ) -> Optional[ChatbotBookingDraft]:
        """
        Convert the current session into a booking draft.

        The draft is only conversational data. It does not
        create an appointment.
        """

        if not (session := self.get_session(session_id)):
            return None

        return ChatbotBookingDraft(
            doctor_id=session.doctor_id,
            doctor_name=session.doctor_name,
            specialization=session.specialty,
            appointment_date=session.appointment_date,
            start_time=session.start_time,
            end_time=session.end_time,
            appointment_type=session.appointment_type,
            reason=session.reason,
        )

    # ========================================================
    # PUBLIC CONVERSATION STATE
    # ========================================================

    def get_state(
        self,
        session_id: str,
    ) -> Optional[ChatbotConversationState]:
        """
        Return the public conversation state defined by schemas.py.
        """

        if not (session := self.get_session(session_id)):
            return None

        return ChatbotConversationState(
            session_id=session.session_id,
            mode=session.mode,
            specialty=session.specialty,
            doctor_id=session.doctor_id,
            doctor_name=session.doctor_name,
            appointment_date=session.appointment_date,
            start_time=session.start_time,
            end_time=session.end_time,
            appointment_type=session.appointment_type,
            reason=session.reason,
        )

    # ========================================================
    # MISSING BOOKING INFORMATION
    # ========================================================

    def missing_booking_fields(
        self,
        session_id: str,
    ) -> list[str]:
        """
        Return booking fields that are still missing.

        Doctor/date/time are the core fields needed before the
        service layer can open the existing booking flow.
        """

        if not (session := self.get_session(session_id)):
            return []

        missing: list[str] = []

        if session.doctor_id is None:
            missing.append("doctor")

        if session.appointment_date is None:
            missing.append("date")

        if session.start_time is None:
            missing.append("time")

        if session.appointment_type is None:
            missing.append("appointment_type")

        return missing

    # ========================================================
    # BOOKING COMPLETENESS
    # ========================================================

    def is_booking_ready(
        self,
        session_id: str,
    ) -> bool:
        """
        Determine whether the conversational booking draft
        contains the minimum information required to continue.
        """

        return not self.missing_booking_fields(
            session_id
        )

    # ========================================================
    # CLEAR SELECTED FIELD
    # ========================================================

    def clear_booking_field(
        self,
        session_id: str,
        field_name: str,
    ) -> bool:
        """
        Clear one conversational booking field.

        This is useful when the patient changes a date,
        doctor, time or appointment type.
        """

        normalized_field = (
            field_name.strip().lower()
        )

        with self._lock:
            if not (
                session := self._sessions.get(
                    session_id.strip()
                )
            ):
                return False

            if normalized_field == "specialty":
                session.specialty = None

            elif normalized_field == "doctor":
                session.doctor_id = None
                session.doctor_name = None

            elif normalized_field in {
                "date",
                "appointment_date",
            }:
                session.appointment_date = None

            elif normalized_field in {
                "time",
                "start_time",
            }:
                session.start_time = None

            elif normalized_field == "end_time":
                session.end_time = None

            elif normalized_field in {
                "appointment_type",
                "type",
            }:
                session.appointment_type = None

            elif normalized_field == "reason":
                session.reason = None

            elif normalized_field == "awaiting":
                session.awaiting = None

            else:
                return False

            session.updated_at = _utc_now()

            return True

    # ========================================================
    # RESET BOOKING
    # ========================================================

    def reset_booking(
        self,
        session_id: str,
    ) -> bool:
        """
        Reset only the booking-related state.

        The chatbot session itself remains active.
        """

        with self._lock:
            if not (
                session := self._sessions.get(
                    session_id.strip()
                )
            ):
                return False

            session.specialty = None
            session.doctor_id = None
            session.doctor_name = None
            session.appointment_date = None
            session.start_time = None
            session.end_time = None
            session.appointment_type = None
            session.reason = None
            session.awaiting = None

            session.updated_at = _utc_now()

            return True

    # ========================================================
    # RESET SESSION
    # ========================================================

    def reset_session(
        self,
        session_id: str,
    ) -> bool:
        """
        Completely remove a chatbot session.
        """

        normalized_id = (
            session_id.strip()
        )

        if not normalized_id:
            return False

        with self._lock:
            return (
                self._sessions.pop(
                    normalized_id,
                    None,
                )
                is not None
            )

    # ========================================================
    # SESSION EXISTS
    # ========================================================

    def has_session(
        self,
        session_id: str,
    ) -> bool:
        """
        Check whether a valid session exists.
        """

        return (
            self.get_session(session_id)
            is not None
        )

    # ========================================================
    # ACTIVE SESSION COUNT
    # ========================================================

    def active_session_count(self) -> int:
        """
        Return the number of active sessions.
        """

        with self._lock:
            self._cleanup_expired_locked()

            return len(self._sessions)

    # ========================================================
    # EXPIRATION
    # ========================================================

    def cleanup_expired(self) -> int:
        """
        Remove expired sessions and return the number removed.
        """

        with self._lock:
            return self._cleanup_expired_locked()

    def _cleanup_expired_locked(self) -> int:
        """
        Internal cleanup implementation.

        Caller must hold self._lock.
        """

        now = _utc_now()

        expired_ids = [
            session_id
            for session_id, session in self._sessions.items()
            if now - session.updated_at
            > self.session_ttl
        ]

        for session_id in expired_ids:
            self._sessions.pop(
                session_id,
                None,
            )

        if expired_ids:
            logger.debug(
                "Removed %d expired chatbot sessions.",
                len(expired_ids),
            )

        return len(expired_ids)

    # ========================================================
    # CAPACITY
    # ========================================================

    def _remove_oldest_session_locked(self) -> None:
        """
        Remove the least recently updated session.

        Caller must hold self._lock.
        """

        if not self._sessions:
            return

        oldest_session_id = min(
            self._sessions,
            key=lambda session_id: (
                self._sessions[
                    session_id
                ].updated_at
            ),
        )

        self._sessions.pop(
            oldest_session_id,
            None,
        )

        logger.warning(
            "Chatbot session capacity reached. "
            "Removed the oldest inactive session."
        )

    def _ensure_capacity_locked(self) -> None:
        """
        Prevent unlimited in-memory session growth.

        Expired sessions are removed first. If the configured
        capacity is still reached, the least recently updated
        session is removed.

        Caller must hold self._lock.
        """

        if len(self._sessions) < self.max_active_sessions:
            return

        self._cleanup_expired_locked()

        if len(self._sessions) >= self.max_active_sessions:
            self._remove_oldest_session_locked()



# ============================================================
# SHARED MANAGER
# ============================================================


_conversation_manager = ConversationManager()


def get_conversation_manager() -> ConversationManager:
    """
    Return the shared conversation manager.

    The same manager is used by HomeChatbot and PatientChatbot
    within the running backend process.
    """

    return _conversation_manager


# ============================================================
# CONVENIENCE FUNCTIONS
# ============================================================


def create_conversation(
    mode: ChatbotMode,
    session_id: Optional[str] = None,
    authenticated: bool = False,
) -> str:
    """
    Convenience wrapper for creating or reusing a session.
    """

    return get_conversation_manager().create_session(
        mode=mode,
        session_id=session_id,
        authenticated=authenticated,
    )


def get_conversation_state(
    session_id: str,
) -> Optional[ChatbotConversationState]:
    """
    Convenience wrapper for retrieving conversation state.
    """

    return get_conversation_manager().get_state(
        session_id
    )


def get_booking_draft(
    session_id: str,
) -> Optional[ChatbotBookingDraft]:
    """
    Convenience wrapper for retrieving the current booking draft.
    """

    return get_conversation_manager().get_booking_draft(
        session_id
    )


def reset_conversation(
    session_id: str,
) -> bool:
    """
    Convenience wrapper for removing a complete conversation.
    """

    return get_conversation_manager().reset_session(
        session_id
    )