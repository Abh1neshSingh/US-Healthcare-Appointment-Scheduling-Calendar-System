"""
Healthcare chatbot NLP / Transformer layer.

Responsibilities:
- Load a Hugging Face Transformer model when configured.
- Detect high-level chatbot intent.
- Extract simple structured entities such as:
    * specialty
    * doctor name
    * appointment date
    * appointment type
    * time
    * reason
- Provide a safe deterministic fallback when the transformer model
  is not available.

This module does NOT:
- create appointments
- modify appointments
- bypass referral / insurance rules
- access the database directly

The service layer remains responsible for application/business logic.
"""

from __future__ import annotations

import importlib
import logging
import os
import re
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, Optional, Protocol, Tuple, cast

from app.models.enums import AppointmentType

from .schemas import (
    ChatbotIntent,
    ChatbotIntentResult,
)

logger = logging.getLogger(__name__)


# ============================================================
# CONFIGURATION
# ============================================================

DEFAULT_MODEL_NAME = os.getenv(
    "CHATBOT_TRANSFORMER_MODEL",
    "distilbert-base-uncased",
)

TRANSFORMER_ENABLED = (
    os.getenv(
        "CHATBOT_TRANSFORMER_ENABLED",
        "true",
    ).strip().lower()
    in {"1", "true", "yes", "on"}
)


# ============================================================
# COMMON HEALTHCARE TERMS
# ============================================================

SPECIALTY_ALIASES: Dict[str, str] = {
    "cardiology": "Cardiology",
    "cardiologist": "Cardiology",
    "heart doctor": "Cardiology",
    "heart specialist": "Cardiology",

    "dermatology": "Dermatology",
    "dermatologist": "Dermatology",
    "skin doctor": "Dermatology",
    "skin specialist": "Dermatology",

    "neurology": "Neurology",
    "neurologist": "Neurology",
    "brain doctor": "Neurology",
    "brain specialist": "Neurology",

    "orthopedics": "Orthopedics",
    "orthopaedics": "Orthopedics",
    "orthopedic": "Orthopedics",
    "orthopaedic": "Orthopedics",
    "bone doctor": "Orthopedics",

    "pediatrics": "Pediatrics",
    "paediatrics": "Pediatrics",
    "pediatrician": "Pediatrics",
    "child doctor": "Pediatrics",
    "children doctor": "Pediatrics",

    "gynecology": "Gynecology",
    "gynaecology": "Gynecology",
    "gynecologist": "Gynecology",
    "gynaecologist": "Gynecology",
    "women's health": "Gynecology",

    "psychiatry": "Psychiatry",
    "psychiatrist": "Psychiatry",
    "mental health doctor": "Psychiatry",

    "urology": "Urology",
    "urologist": "Urology",

    "gastroenterology": "Gastroenterology",
    "gastroenterologist": "Gastroenterology",
    "stomach doctor": "Gastroenterology",

    "endocrinology": "Endocrinology",
    "endocrinologist": "Endocrinology",

    "pulmonology": "Pulmonology",
    "pulmonologist": "Pulmonology",
    "lung doctor": "Pulmonology",

    "oncology": "Oncology",
    "oncologist": "Oncology",
    "cancer doctor": "Oncology",

    "ophthalmology": "Ophthalmology",
    "ophthalmologist": "Ophthalmology",
    "eye doctor": "Ophthalmology",

    "ent": "ENT",
    "ent doctor": "ENT",
    "ear nose throat": "ENT",

    "dentistry": "Dentistry",
    "dentist": "Dentistry",
    "dental": "Dentistry",

    "family medicine": "Family Medicine",
    "family doctor": "Family Medicine",
    "primary care": "Family Medicine",
    "primary care doctor": "Family Medicine",

    "internal medicine": "Internal Medicine",
    "internist": "Internal Medicine",

    "general medicine": "General Medicine",
    "general physician": "General Medicine",
}


# ============================================================
# NLP ENGINE
# ============================================================


class _TransformerModelProtocol(Protocol):
    """Minimal interface required from the loaded Transformer model."""

    def eval(self) -> object:
        ...


class ChatbotNLP:
    """
    Central NLP engine for HomeChatbot and PatientChatbot.

    The engine attempts to use a Hugging Face Transformer when
    available, while keeping deterministic healthcare-specific
    extraction as the reliable application layer.

    A generic DistilBERT checkpoint is NOT treated as a trained
    healthcare intent classifier. When available, it is used as a
    semantic prototype classifier for ambiguous messages. The
    deterministic healthcare rules remain authoritative for
    safety-critical and explicit application intents.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
    ) -> None:
        self.model_name = (
            model_name
            or DEFAULT_MODEL_NAME
        )

        self.tokenizer: Optional[object] = None
        self.model: Optional[_TransformerModelProtocol] = None
        self.transformer_loaded = False

        # Semantic intent prototypes are built only after the model
        # loads successfully. This keeps the Transformer useful even
        # though the base checkpoint is not fine-tuned for healthcare.
        self._intent_embeddings: Dict[ChatbotIntent, Any] = {}

        if TRANSFORMER_ENABLED:
            self._load_transformer()

    # ========================================================
    # TRANSFORMER LOADING
    # ========================================================

    @staticmethod
    def _get_transformer_classes() -> Tuple[Any, Any]:
        """
        Import and return the Hugging Face model/tokenizer classes.

        The import stays lazy so the backend can still start when the
        optional Transformer dependency is unavailable.
        """

        transformers = importlib.import_module("transformers")
        return (
            transformers.AutoTokenizer,
            transformers.AutoModel,
        )

    def _initialize_transformer(
        self,
        auto_tokenizer: Any,
        auto_model: Any,
    ) -> None:
        """Create and initialize the configured Transformer model."""

        self.tokenizer = auto_tokenizer.from_pretrained(
            self.model_name,
        )

        self.model = cast(
            _TransformerModelProtocol,
            auto_model.from_pretrained(
                self.model_name,
            ),
        )

        self.model.eval()
        self.transformer_loaded = True
        self._build_intent_embeddings()

    def _load_transformer(self) -> None:
        """
        Load Hugging Face tokenizer/model.

        Importing transformers is intentionally done lazily so
        the backend can still start before the dependency/model
        is installed.
        """

        try:
            auto_tokenizer, auto_model = (
                self._get_transformer_classes()
            )
        except (ImportError, AttributeError):
            logger.warning(
                "Hugging Face transformers is not installed. "
                "Chatbot NLP will use the healthcare fallback engine."
            )
            return

        try:
            self._initialize_transformer(
                auto_tokenizer,
                auto_model,
            )

            logger.info(
                "Chatbot Transformer loaded: %s",
                self.model_name,
            )

        except Exception as exc:
            self.tokenizer = None
            self.model = None
            self.transformer_loaded = False

            logger.warning(
                "Unable to load chatbot Transformer '%s': %s. "
                "Using fallback NLP engine.",
                self.model_name,
                exc,
            )

    # ========================================================
    # PUBLIC API
    # ========================================================

    def analyze(
        self,
        message: str,
    ) -> ChatbotIntentResult:
        """
        Analyze one user message.

        The returned object is safe for both chatbot modes.
        """

        cleaned = self._clean_text(message)

        if not cleaned:
            return ChatbotIntentResult(
                intent=ChatbotIntent.UNKNOWN,
                confidence=0.0,
                entities={},
            )

        intent, confidence = (
            self._detect_intent(cleaned)
        )

        specialty = (
            self._extract_specialty(cleaned)
        )

        doctor_name = (
            self._extract_doctor_name(cleaned)
        )

        appointment_date = (
            self._extract_date(cleaned)
        )

        start_time = (
            self._extract_time(cleaned)
        )

        appointment_type = (
            self._extract_appointment_type(
                cleaned
            )
        )

        reason = (
            self._extract_reason(cleaned)
        )

        entities: Dict[str, Any] = {}

        if specialty:
            entities["specialty"] = specialty

        if doctor_name:
            entities["doctor_name"] = doctor_name

        if appointment_date:
            entities["appointment_date"] = (
                appointment_date.isoformat()
            )

        if start_time:
            entities["start_time"] = (
                start_time.strftime("%H:%M")
            )

        if appointment_type:
            entities["appointment_type"] = (
                appointment_type.value
            )

        if reason:
            entities["reason"] = reason

        return ChatbotIntentResult(
            intent=intent,
            confidence=confidence,
            specialty=specialty,
            appointment_date=appointment_date,
            start_time=start_time,
            appointment_type=appointment_type,
            reason=reason,
            entities=entities,
        )

    # ========================================================
    # INTENT DETECTION
    # ========================================================

    def _detect_intent(
        self,
        text: str,
    ) -> Tuple[ChatbotIntent, float]:

        normalized = text.lower().strip()

        # -----------------------------------------------
        # Emergency
        # -----------------------------------------------

        emergency_terms = (
            "chest pain",
            "difficulty breathing",
            "can't breathe",
            "cannot breathe",
            "severe bleeding",
            "unconscious",
            "stroke",
            "heart attack",
            "suicidal",
            "suicide",
            "severe allergic reaction",
        )

        if any(
            term in normalized
            for term in emergency_terms
        ):
            return (
                ChatbotIntent.EMERGENCY,
                0.99,
            )

        # -----------------------------------------------
        # Greeting
        # -----------------------------------------------

        greeting_terms = (
            "hello",
            "hi",
            "hey",
            "good morning",
            "good afternoon",
            "good evening",
            "good night",
        )

        if normalized in greeting_terms:
            return (
                ChatbotIntent.GREETING,
                0.98,
            )

        # -----------------------------------------------
        # Cancel
        # -----------------------------------------------

        cancel_terms = (
            "cancel appointment",
            "cancel my appointment",
            "cancel booking",
            "cancel my booking",
        )

        if any(
            term in normalized
            for term in cancel_terms
        ):
            return (
                ChatbotIntent.CANCEL,
                0.96,
            )

        # -----------------------------------------------
        # Existing appointments
        # -----------------------------------------------

        appointment_view_terms = (
            "my appointments",
            "my appointment",
            "upcoming appointments",
            "upcoming appointment",
            "appointment history",
            "show my bookings",
            "show my appointments",
            "view appointments",
        )

        if any(
            term in normalized
            for term in appointment_view_terms
        ):
            return (
                ChatbotIntent.VIEW_APPOINTMENTS,
                0.96,
            )

        # -----------------------------------------------
        # Insurance
        # -----------------------------------------------

        insurance_terms = (
            "insurance",
            "insurance provider",
            "insurance coverage",
            "insurance card",
            "member id",
            "coverage",
        )

        if any(
            term in normalized
            for term in insurance_terms
        ):
            return (
                ChatbotIntent.INSURANCE,
                0.93,
            )

        # -----------------------------------------------
        # Help
        # -----------------------------------------------

        help_terms = (
            "help",
            "what can you do",
            "how can you help",
            "support",
        )

        if any(
            term in normalized
            for term in help_terms
        ):
            return (
                ChatbotIntent.HELP,
                0.94,
            )

        # -----------------------------------------------
        # Change details
        # -----------------------------------------------

        change_terms = (
            "change date",
            "change time",
            "change doctor",
            "change appointment",
            "different doctor",
            "different time",
            "different date",
        )

        if any(
            term in normalized
            for term in change_terms
        ):
            return (
                ChatbotIntent.CHANGE_DETAILS,
                0.94,
            )

        # -----------------------------------------------
        # Booking
        # -----------------------------------------------

        booking_terms = (
            "book",
            "booking",
            "appointment",
            "schedule",
            "see a doctor",
            "consultation",
            "consult",
        )

        if any(
            term in normalized
            for term in booking_terms
        ):
            return (
                ChatbotIntent.BOOK_APPOINTMENT,
                0.94,
            )

        # -----------------------------------------------
        # Doctor search / explicit doctor
        # -----------------------------------------------

        doctor_terms = (
            "find doctor",
            "find a doctor",
            "doctor near",
            "doctor available",
            "specialist",
            "find specialist",
            "looking for a doctor",
        )

        if any(
            term in normalized
            for term in doctor_terms
        ) or self._extract_doctor_name(normalized):
            return (
                ChatbotIntent.FIND_DOCTOR,
                0.92,
            )

        # -----------------------------------------------
        # Appointment type
        # -----------------------------------------------

        if appointment_type := self._extract_appointment_type(
            normalized
        ):
            return (
                ChatbotIntent.SELECT_APPOINTMENT_TYPE,
                0.91,
            )

        # -----------------------------------------------
        # Date / time
        # -----------------------------------------------

        if self._extract_date(normalized):
            return (
                ChatbotIntent.SELECT_DATE,
                0.90,
            )

        if self._extract_time(normalized):
            return (
                ChatbotIntent.SELECT_TIME,
                0.90,
            )

        # -----------------------------------------------
        # Specialty
        # -----------------------------------------------

        if specialty := self._extract_specialty(normalized):
            return (
                ChatbotIntent.SELECT_SPECIALTY,
                0.89,
            )

        if transformer_result := self._transformer_intent(normalized):
            return transformer_result

        return (
            ChatbotIntent.UNKNOWN,
            0.35,
        )

    # ========================================================
    # TRANSFORMER SEMANTIC INTENT CLASSIFICATION
    # ========================================================

    def _build_intent_embeddings(self) -> None:
        """
        Build semantic reference embeddings for ambiguous intents.

        The model is a generic language model, not a healthcare
        classifier. Each intent is represented by a small set of
        natural-language examples and classified by cosine similarity.
        """

        if not self.transformer_loaded:
            return

        prototypes: Dict[ChatbotIntent, Tuple[str, ...]] = {
            ChatbotIntent.BOOK_APPOINTMENT: (
                "I want to book an appointment with a doctor",
                "I need to schedule a medical appointment",
                "Can I make an appointment",
            ),
            ChatbotIntent.FIND_DOCTOR: (
                "I need help finding a doctor",
                "Which doctor should I see",
                "Find a specialist for me",
            ),
            ChatbotIntent.VIEW_APPOINTMENTS: (
                "Show me my upcoming appointments",
                "I want to see my appointments",
                "What appointments do I have",
            ),
            ChatbotIntent.INSURANCE: (
                "I have a question about my insurance coverage",
                "Does my insurance cover this appointment",
                "I need help with my insurance",
            ),
            ChatbotIntent.CHANGE_DETAILS: (
                "I want to change my appointment details",
                "Can I change the date or time of my appointment",
                "I need a different appointment time",
            ),
            ChatbotIntent.HELP: (
                "What can you help me with",
                "I need help using the appointment system",
                "How does this chatbot work",
            ),
            ChatbotIntent.GREETING: (
                "Hello",
                "Hi there",
                "Good morning",
            ),
        }

        try:
            for intent, examples in prototypes.items():
                self._intent_embeddings[intent] = (
                    self._encode_texts(examples)
                )
        except Exception as exc:
            self._intent_embeddings.clear()
            logger.warning(
                "Unable to build chatbot Transformer intent embeddings: %s",
                exc,
            )

    def _encode_texts(
        self,
        texts: Tuple[str, ...],
    ) -> Any:
        """Encode text and return one normalized mean embedding."""

        if self.tokenizer is None or self.model is None:
            raise RuntimeError("Transformer is not loaded.")

        torch = importlib.import_module("torch")

        tokenizer = self.tokenizer
        model = self.model

        encoded = tokenizer(
            list(texts),
            padding=True,
            truncation=True,
            max_length=128,
            return_tensors="pt",
        )

        with torch.no_grad():
            outputs = model(**encoded)

        hidden_state = outputs.last_hidden_state
        attention_mask = encoded["attention_mask"].unsqueeze(-1)
        masked_hidden = hidden_state * attention_mask
        token_count = attention_mask.sum(dim=1).clamp(min=1)
        embeddings = masked_hidden.sum(dim=1) / token_count

        embeddings = torch.nn.functional.normalize(
            embeddings,
            p=2,
            dim=1,
        )

        embedding = embeddings.mean(dim=0, keepdim=True)

        return torch.nn.functional.normalize(
            embedding,
            p=2,
            dim=1,
        )

    def _calculate_transformer_intent(
        self,
        text: str,
    ) -> Optional[Tuple[ChatbotIntent, float]]:
        """Calculate the best semantic intent from Transformer embeddings."""

        torch = importlib.import_module("torch")
        query_embedding = self._encode_texts((text,))

        best_intent: Optional[ChatbotIntent] = None
        best_score = -1.0

        for intent, prototype in self._intent_embeddings.items():
            score = torch.nn.functional.cosine_similarity(
                query_embedding,
                prototype,
                dim=1,
            ).item()

            if score > best_score:
                best_score = score
                best_intent = intent

        if best_intent is None or best_score < 0.62:
            return None

        confidence = min(
            0.89,
            max(0.62, 0.62 + (best_score - 0.62) * 0.9),
        )

        return best_intent, confidence

    def _transformer_intent(
        self,
        text: str,
    ) -> Optional[Tuple[ChatbotIntent, float]]:
        """
        Classify an ambiguous message using semantic similarity.

        A conservative threshold prevents the generic model from
        overriding deterministic healthcare rules with weak matches.
        """

        if (
            not self.transformer_loaded
            or self.tokenizer is None
            or self.model is None
            or not self._intent_embeddings
        ):
            return None

        try:
            return self._calculate_transformer_intent(text)
        except Exception as exc:
            logger.debug(
                "Transformer intent classification failed; "
                "using deterministic fallback: %s",
                exc,
            )
            return None

    # ========================================================
    # SPECIALTY EXTRACTION
    # ========================================================

    def _extract_specialty(
        self,
        text: str,
    ) -> Optional[str]:

        normalized = text.lower().strip()

        # Longest aliases first prevents shorter aliases
        # from matching inside longer phrases.
        aliases = sorted(
            SPECIALTY_ALIASES.items(),
            key=lambda item: len(item[0]),
            reverse=True,
        )

        return next(
            (
                specialty
                for alias, specialty in aliases
                if self._contains_phrase(
                    normalized,
                    alias,
                )
            ),
            None,
        )

    # ========================================================
    # DOCTOR NAME EXTRACTION
    # ========================================================

    @staticmethod
    def _extract_doctor_name(
        text: str,
    ) -> Optional[str]:
        """Extract a doctor name only when it is explicitly named."""

        normalized = re.sub(r"\s+", " ", text.strip())
        stop_words = (
            "for", "at", "on", "tomorrow", "today", "tonight",
            "appointment", "booking", "telehealth", "telemedicine",
            "in person", "in-person",
        )
        stop_pattern = "|".join(re.escape(word) for word in stop_words)
        patterns = (
            rf"\b(?:dr\.?|doctor)\s+([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){{0,2}}?)(?=\s+(?:{stop_pattern})\b|$)",
        )

        for pattern in patterns:
            if match := re.search(
                pattern,
                normalized,
                flags=re.IGNORECASE,
            ):
                name = re.sub(r"\s+", " ", match[1]).strip(" ,.-")
                if name and len(name) >= 2:
                    return name

        return None

    # ========================================================
    # DATE EXTRACTION
    # ========================================================

    @staticmethod
    def _parse_month_date(
        month_match: re.Match[str],
        today: date,
    ) -> Optional[date]:
        try:
            month_name = month_match[1]
            day_number = int(month_match[2])
            year_value = month_match[3]

            month_number = datetime.strptime(
                month_name,
                "%B",
            ).month

            year_number = (
                int(year_value)
                if year_value
                else today.year
            )

            candidate = date(
                year_number,
                month_number,
                day_number,
            )

            # If no year was supplied and the date
            # has already passed, use next year.
            if (
                year_value is None
                and candidate < today
            ):
                candidate = date(
                    today.year + 1,
                    month_number,
                    day_number,
                )

            return candidate
        except ValueError:
            return None

    def _extract_date(
        self,
        text: str,
    ) -> Optional[date]:

        normalized = text.lower().strip()
        today = date.today()

        # -----------------------------------------------
        # Relative dates
        # -----------------------------------------------

        if re.search(
            r"\b(today|tonight)\b",
            normalized,
        ):
            return today

        if re.search(
            r"\bday after tomorrow\b",
            normalized,
        ):
            return today + timedelta(days=2)

        if re.search(
            r"\btomorrow\b",
            normalized,
        ):
            return today + timedelta(days=1)

        # -----------------------------------------------
        # Weekday
        # -----------------------------------------------

        weekdays = {
            "monday": 0,
            "tuesday": 1,
            "wednesday": 2,
            "thursday": 3,
            "friday": 4,
            "saturday": 5,
            "sunday": 6,
        }

        for weekday_name, weekday_number in (
            weekdays.items()
        ):
            if re.search(
                rf"\b{weekday_name}\b",
                normalized,
            ):
                days_ahead = (
                    weekday_number
                    - today.weekday()
                ) % 7

                if days_ahead == 0:
                    days_ahead = 7

                return today + timedelta(
                    days=days_ahead
                )

        # -----------------------------------------------
        # ISO date
        # -----------------------------------------------

        if iso_match := re.search(
            r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b",
            normalized,
        ):
            try:
                return date(
                    int(iso_match[1]),
                    int(iso_match[2]),
                    int(iso_match[3]),
                )
            except ValueError:
                return None

        # -----------------------------------------------
        # MM/DD/YYYY
        # -----------------------------------------------

        if slash_match := re.search(
            r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b",
            normalized,
        ):
            try:
                return date(
                    int(slash_match[3]),
                    int(slash_match[1]),
                    int(slash_match[2]),
                )
            except ValueError:
                return None

        # -----------------------------------------------
        # Month name
        # -----------------------------------------------

        month_pattern = (
            r"\b("
            r"january|february|march|april|may|june|"
            r"july|august|september|october|november|december"
            r")\s+"
            r"(\d{1,2})"
            r"(?:\s*,?\s*(20\d{2}))?"
            r"\b"
        )

        month_match = re.search(
            month_pattern,
            normalized,
        )

        return (
            self._parse_month_date(month_match, today)
            if month_match
            else None
        )

    # ========================================================
    # TIME EXTRACTION
    # ========================================================

    def _extract_time(
        self,
        text: str,
    ) -> Optional[time]:

        normalized = text.lower().strip()

        # 10:30 AM / 10:30 PM
        if match := re.search(
            r"\b(\d{1,2}):(\d{2})\s*"
            r"(am|pm)\b",
            normalized,
        ):
            return self._make_time(
                int(match[1]),
                int(match[2]),
                match[3],
            )

        # 10 AM / 10 PM
        if match := re.search(
            r"\b(\d{1,2})\s*"
            r"(am|pm)\b",
            normalized,
        ):
            return self._make_time(
                int(match[1]),
                0,
                match[2],
            )

        # 24-hour time such as 14:30
        if match := re.search(
            r"\b([01]?\d|2[0-3]):([0-5]\d)\b",
            normalized,
        ):
            try:
                return time(
                    int(match[1]),
                    int(match[2]),
                )
            except ValueError:
                return None

        return None

    @staticmethod
    def _make_time(
        hour: int,
        minute: int,
        meridiem: str,
    ) -> Optional[time]:

        if hour < 1 or hour > 12:
            return None

        if minute < 0 or minute > 59:
            return None

        if meridiem == "am":
            hour = 0 if hour == 12 else hour

        else:
            hour = 12 if hour == 12 else hour + 12

        return time(
            hour=hour,
            minute=minute,
        )

    # ========================================================
    # APPOINTMENT TYPE
    # ========================================================

    def _extract_appointment_type(
        self,
        text: str,
    ) -> Optional[AppointmentType]:

        normalized = text.lower().strip()

        telehealth_terms = (
            "telehealth",
            "telemedicine",
            "virtual appointment",
            "virtual visit",
            "video appointment",
            "video visit",
            "online appointment",
            "online visit",
        )

        if any(
            term in normalized
            for term in telehealth_terms
        ):
            return AppointmentType.TELEHEALTH

        in_person_terms = (
            "in person",
            "in-person",
            "inperson",
            "office visit",
            "clinic visit",
            "visit the clinic",
        )

        if any(
            term in normalized
            for term in in_person_terms
        ):
            return AppointmentType.IN_PERSON

        return None

    # ========================================================
    # REASON EXTRACTION
    # ========================================================

    def _extract_reason(
        self,
        text: str,
    ) -> Optional[str]:

        normalized = text.strip()

        patterns = (
            r"\b(?:because|for|reason is|reason:)\s+(.+)$",
            r"\b(?:i have|i'm having|im having)\s+(.+)$",
            r"\b(?:problem is|issue is)\s+(.+)$",
            r"\b(?:symptoms? are)\s+(.+)$",
        )

        for pattern in patterns:
            if match := re.search(
                pattern,
                normalized,
                flags=re.IGNORECASE,
            ):
                if reason := match[1].strip():
                    return reason[:2000]

        return None

    # ========================================================
    # HELPERS
    # ========================================================

    @staticmethod
    def _clean_text(
        message: str,
    ) -> str:

        text = str(message or "").strip()

        # Normalize whitespace.
        text = re.sub(
            r"\s+",
            " ",
            text,
        )

        return text[:2000]

    @staticmethod
    def _contains_phrase(
        text: str,
        phrase: str,
    ) -> bool:

        escaped = re.escape(
            phrase.lower().strip()
        )

        return re.search(
            rf"(?<!\w){escaped}(?!\w)",
            text,
        ) is not None


# ============================================================
# SINGLETON
# ============================================================

_nlp_engine: Optional[ChatbotNLP] = None


def get_nlp_engine() -> ChatbotNLP:
    """
    Return the shared NLP engine.

    Loading the Transformer once avoids loading a model for
    every request.
    """

    global _nlp_engine

    if _nlp_engine is None:
        _nlp_engine = ChatbotNLP()

    return _nlp_engine


# ============================================================
# CONVENIENCE FUNCTION
# ============================================================

def analyze_message(
    message: str,
) -> ChatbotIntentResult:
    """
    Analyze a chatbot message using the shared NLP engine.
    """

    return get_nlp_engine().analyze(
        message
    )