"""
Healthcare Chatbot API Router.

Provides:
- Public home chatbot endpoint.
- Authenticated patient chatbot endpoint.
- Authenticated patient booking confirmation endpoint.
- Conversation state and booking-draft endpoints.
- Conversation reset endpoint.
- Public chatbot health endpoint.

The router does not implement appointment business rules itself.
The existing appointment APIs remain the source of truth.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.database.connection import get_db

from .conversation import (
    get_booking_draft,
    get_conversation_manager,
    get_conversation_state,
    reset_conversation,
)
from .nlp import TRANSFORMER_ENABLED, get_nlp_engine
from .schemas import (
    ChatbotBookingConfirmation,
    ChatbotBookingDraft,
    ChatbotConversationState,
    ChatbotHealthResponse,
    ChatbotMessage,
    ChatbotMode,
    ChatbotResponse,
)
from .service import (
    get_chatbot_service,
    handle_chatbot_message,
)


router = APIRouter(
    prefix="/chatbot",
    tags=["Healthcare Chatbot"],
)


# ============================================================
# PUBLIC HOME CHATBOT
# ============================================================


@router.post(
    "/home",
    response_model=ChatbotResponse,
)
def home_chatbot(
    payload: ChatbotMessage,
    db: Session = Depends(get_db),
) -> ChatbotResponse:
    """
    Process an anonymous/public home chatbot message.

    Home chatbot never receives patient-specific authentication
    context.
    """

    return handle_chatbot_message(
        db=db,
        payload=payload,
        mode=ChatbotMode.HOME,
    )


# ============================================================
# AUTHENTICATED PATIENT CHATBOT
# ============================================================


@router.post(
    "/patient",
    response_model=ChatbotResponse,
)
def patient_chatbot(
    payload: ChatbotMessage,
    current_user: dict[str, Any] = Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
) -> ChatbotResponse:
    """
    Process an authenticated patient chatbot message.
    """

    return handle_chatbot_message(
        db=db,
        payload=payload,
        mode=ChatbotMode.PATIENT,
        current_user=current_user,
    )


# ============================================================
# PATIENT BOOKING CONFIRMATION
# ============================================================


@router.post(
    "/patient/book",
    status_code=status.HTTP_201_CREATED,
)
def confirm_patient_chatbot_booking(
    payload: ChatbotBookingConfirmation,
    current_user: dict[str, Any] = Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Confirm the current chatbot booking draft.

    The service delegates final appointment creation to the existing
    appointment API, so all existing validation and business rules
    remain enforced.
    """

    try:
        return get_chatbot_service().confirm_booking(
            db=db,
            session_id=payload.session_id,
            current_user=current_user,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# ============================================================
# CONVERSATION STATE
# ============================================================


@router.get(
    "/session/{session_id}",
    response_model=ChatbotConversationState,
)
def get_chatbot_session(
    session_id: str,
) -> ChatbotConversationState:
    """
    Return the current non-clinical conversation state.
    """

    state = get_conversation_state(
        session_id
    )

    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot session not found",
        )

    return state


@router.get(
    "/session/{session_id}/booking",
    response_model=ChatbotBookingDraft,
)
def get_chatbot_booking_draft(
    session_id: str,
) -> ChatbotBookingDraft:
    """
    Return the current conversational booking draft.
    """

    draft = get_booking_draft(
        session_id
    )

    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot booking session not found",
        )

    return draft


# ============================================================
# RESET SESSION
# ============================================================


@router.delete(
    "/session/{session_id}",
)
def delete_chatbot_session(
    session_id: str,
) -> dict[str, str]:
    """
    Reset a chatbot conversation.

    This removes temporary chatbot state only. It never deletes
    appointments, users, patients, or other database records.
    """

    if not reset_conversation(
        session_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot session not found",
        )

    return {
        "message": "Chatbot session reset successfully",
    }


# ============================================================
# HEALTH
# ============================================================


@router.get(
    "/health",
    response_model=ChatbotHealthResponse,
)
def chatbot_health() -> ChatbotHealthResponse:
    """
    Return chatbot subsystem health information.
    """

    manager = get_conversation_manager()
    nlp_engine = get_nlp_engine()

    return ChatbotHealthResponse(
        status="ok",
        service="healthcare-chatbot",
        transformer_enabled=TRANSFORMER_ENABLED,
        transformer_loaded=nlp_engine.transformer_loaded,
        model_name=nlp_engine.model_name,
        active_sessions=manager.active_session_count(),
    )
