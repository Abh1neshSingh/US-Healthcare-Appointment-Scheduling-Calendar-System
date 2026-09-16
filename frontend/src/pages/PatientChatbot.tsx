import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import API_URL from "../config";
import "./PatientChatbot.css";

interface PatientChatbotProps {
  patientName?: string;
  insuranceProvider?: string | null;
  insuranceMemberId?: string | null;

  onOpenBooking?: (
    date?: string,
    doctorId?: number,
    startTime?: string,
    appointmentType?: string,
    reason?: string,
  ) => void;
}

interface Doctor {
  id: number;
  name: string;
  specialization: string;
  requires_referral: boolean;
}

interface TimeSlot {
  start_time: string;
  end_time: string;
  status: "available" | "booked" | "break" | "unavailable";
}

interface AvailabilityResponse {
  doctor_id: number;
  doctor_name: string;
  date: string;
  day: string;
  available: boolean;
  total_slots: number;
  available_slots: number;
  booked_slots: number;
  slots: TimeSlot[];
  message?: string;
}

interface ChatMessage {
  id: number;
  sender: "bot" | "patient";
  text: string;
  options?: ChatOption[];
}

interface ChatOption {
  label: string;
  value: string;
}

/* ============================================================
   REAL BACKEND CHATBOT TYPES

   The patient chatbot sends natural-language messages to the
   FastAPI chatbot service. The backend owns NLP, conversation
   state, doctor matching and booking-draft preparation.
   ============================================================ */

interface ChatbotBooking {
  doctor_id?: number | null;
  doctor_name?: string | null;
  specialization?: string | null;
  appointment_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  appointment_type?: string | null;
  reason?: string | null;
}

interface ChatbotApiResponse {
  session_id: string;
  message: string;
  intent?: string;
  confidence?: number;
  mode?: string;
  options?: ChatOption[];
  booking?: ChatbotBooking | null;
  requires_authentication?: boolean;
  redirect_to_booking?: boolean;
  emergency?: boolean;
}

interface ChatbotBookingConfirmationResponse {
  message?: string;
  appointment?: {
    id?: number;
    doctor_name?: string;
    appointment_date?: string;
    start_time?: string;
    end_time?: string;
    status?: string;
    status_label?: string;
    appointment_type?: string;
    reason?: string | null;
  };
}

interface BookingDraft {
  doctor: string;
  doctorId: number | null;
  specialty: string;
  date: string;
  time: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reason: string;
  insurance: string;
  insuranceActive: string;
}

type ChatStep =
  | "welcome"
  | "intent"
  | "doctor"
  | "specialty"
  | "doctorResults"
  | "date"
  | "time"
  | "appointmentType"
  | "reason"
  | "insurance"
  | "insuranceActive"
  | "confirm"
  | "complete";

const makeMessage = (
  id: number,
  text: string,
  options?: ChatOption[],
): ChatMessage => ({
  id,
  sender: "bot",
  text,
  options,
});

const formatDate = (value: string): string => {
  if (!value) {
    return "Not selected";
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (value: string): string => {
  if (!value) {
    return "";
  }

  const [hours, minutes] = value.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return value;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const getToday = (): string => {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

const getNextDate = (days: number): string => {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const getDateFromText = (
  text: string,
): string | null => {
  const normalized = text.trim().toLowerCase();

  if (
    normalized === "today" ||
    normalized.includes("today")
  ) {
    return getToday();
  }

  if (
    normalized === "tomorrow" ||
    normalized.includes("tomorrow")
  ) {
    return getNextDate(1);
  }

  const match = normalized.match(
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  );

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return [
    match[1],
    match[2].padStart(2, "0"),
    match[3].padStart(2, "0"),
  ].join("-");
};

const getGreeting = (name: string): string => {
  const firstName =
    name.trim().split(/\s+/)[0] || "there";

  return `Hi ${firstName}! I can help you book an appointment. What would you like to do?`;
};

const getTimePeriod = (
  value: string,
): "Morning" | "Afternoon" | "Evening" => {
  const hour = Number(value.split(":")[0]);

  if (hour < 12) {
    return "Morning";
  }

  if (hour < 17) {
    return "Afternoon";
  }

  return "Evening";
};

const sortDoctors = (
  doctors: Doctor[],
): Doctor[] => {
  return [...doctors].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
};

function PatientChatbot({
  patientName = "there",
  insuranceProvider,
  insuranceMemberId,
  onOpenBooking,
}: PatientChatbotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const [step, setStep] =
    useState<ChatStep>("welcome");

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [doctors, setDoctors] =
    useState<Doctor[]>([]);

  const [loadingDoctors, setLoadingDoctors] =
    useState(false);

  const [availability, setAvailability] =
    useState<AvailabilityResponse | null>(null);

  const [loadingAvailability, setLoadingAvailability] =
    useState(false);

  const [error, setError] = useState("");

  /* ==========================================================
     BACKEND CHAT SESSION
     ========================================================== */

  const [chatSessionId, setChatSessionId] =
    useState<string | null>(() =>
      sessionStorage.getItem(
        "healthcare_patient_chatbot_session_id",
      ),
    );

  const [chatbotTyping, setChatbotTyping] =
    useState(false);

  const [chatbotConnected, setChatbotConnected] =
    useState(false);

  const messageIdRef = useRef(0);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const token =
    localStorage.getItem("access_token");

  const [draft, setDraft] =
    useState<BookingDraft>({
      doctor: "",
      doctorId: null,
      specialty: "",
      date: "",
      time: "",
      startTime: "",
      endTime: "",
      appointmentType: "",
      reason: "",
      insurance: "",
      insuranceActive: "",
    });

  const hasInsurance = Boolean(
    insuranceProvider?.trim() ||
      insuranceMemberId?.trim(),
  );

  const insuranceSummary = useMemo(() => {
    if (!hasInsurance) {
      return "No insurance is currently on file.";
    }

    if (insuranceProvider) {
      return insuranceMemberId
        ? `${insuranceProvider} · member ending ${insuranceMemberId.slice(-4)}`
        : insuranceProvider;
    }

    return "Insurance information is on file.";
  }, [
    hasInsurance,
    insuranceProvider,
    insuranceMemberId,
  ]);

  const specialties = useMemo(() => {
    const values = doctors
      .map((doctor) =>
        doctor.specialization?.trim(),
      )
      .filter(Boolean);

    return Array.from(new Set(values)).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [doctors]);

  useEffect(() => {
    if (!open) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, open]);

  useEffect(() => {
    if (!open || messages.length > 0) {
      return;
    }

    const initialId = 1;

    messageIdRef.current = initialId;

    setMessages([
      makeMessage(
        initialId,
        getGreeting(patientName),
        [
          {
            label: "Book an appointment",
            value: "book",
          },
          {
            label: "Find a doctor",
            value: "doctor",
          },
          {
            label: "View my appointments",
            value: "appointments",
          },
        ],
      ),
    ]);

    setStep("intent");
  }, [open, messages.length, patientName]);

  const addBotMessage = (
    text: string,
    options?: ChatOption[],
  ) => {
    messageIdRef.current += 1;

    const next =
      messageIdRef.current;

    setMessages((previous) => [
      ...previous,
      makeMessage(next, text, options),
    ]);
  };

  const addPatientMessage = (
    text: string,
  ) => {
    messageIdRef.current += 1;

    const next =
      messageIdRef.current;

    setMessages((previous) => [
      ...previous,
      {
        id: next,
        sender: "patient",
        text,
      },
    ]);
  };

  const resetDraft = () => {
    setDraft({
      doctor: "",
      doctorId: null,
      specialty: "",
      date: "",
      time: "",
      startTime: "",
      endTime: "",
      appointmentType: "",
      reason: "",
      insurance: "",
      insuranceActive: "",
    });
  };

  const resetChat = () => {
    setInput("");
    setMessages([]);
    messageIdRef.current = 0;
    setAvailability(null);
    setError("");

    setChatSessionId(null);
    setChatbotTyping(false);
    setChatbotConnected(false);

    sessionStorage.removeItem(
      "healthcare_patient_chatbot_session_id",
    );

    resetDraft();
    setStep("welcome");
  };

  const fetchDoctors = async () => {
    try {
      setLoadingDoctors(true);
      setError("");

      const response = await fetch(
        `${API_URL}/users/doctors`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to load doctors.",
        );
      }

      const loadedDoctors: Doctor[] =
        Array.isArray(data)
          ? data
          : data.doctors || [];

      setDoctors(
        sortDoctors(loadedDoctors),
      );

      return sortDoctors(loadedDoctors);
    } catch (err) {
      console.error(
        "Chatbot doctor loading error:",
        err,
      );

      const message =
        err instanceof Error
          ? err.message
          : "Unable to load doctors.";

      setError(message);

      addBotMessage(
        "I couldn't load the current doctor list. Please try again.",
        [
          {
            label: "Try again",
            value: "retry_doctors",
          },
        ],
      );

      return [];
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadAvailability = async (
    doctorId: number,
    date: string,
  ) => {
    try {
      setLoadingAvailability(true);
      setAvailability(null);
      setError("");

      const params =
        new URLSearchParams({
          doctor_id: String(doctorId),
          appointment_date: date,
        });

      const response = await fetch(
        `${API_URL}/appointments/availability?${params.toString()}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to load appointment availability.",
        );
      }

      const result =
        data as AvailabilityResponse;

      setAvailability(result);

      return result;
    } catch (err) {
      console.error(
        "Chatbot availability error:",
        err,
      );

      const message =
        err instanceof Error
          ? err.message
          : "Unable to load appointment availability.";

      setError(message);

      addBotMessage(
        "I couldn't check the live schedule right now. Please try again.",
        [
          {
            label: "Try again",
            value: "retry_availability",
          },
        ],
      );

      return null;
    } finally {
      setLoadingAvailability(false);
    }
  };

  const askDoctor = async () => {
    setStep("doctor");
    setError("");

    if (!doctors.length) {
      await fetchDoctors();
    }

    addBotMessage(
      "Which doctor would you like to see? You can type the doctor's name, or choose a specialty.",
      [
        {
          label: "Choose by specialty",
          value: "specialty",
        },
      ],
    );
  };

  const askSpecialty = () => {
    setStep("specialty");
    setError("");

    if (!specialties.length) {
      addBotMessage(
        "I don't have specialty information available right now. You can type a doctor's name instead.",
      );

      setStep("doctor");
      return;
    }

    addBotMessage(
      "Which type of doctor are you looking for?",
      specialties.map(
        (specialty) => ({
          label: specialty,
          value: specialty,
        }),
      ),
    );
  };

  const showDoctorResults = (
    specialty: string,
  ) => {
    const matchingDoctors =
      doctors.filter((doctor) =>
        doctor.specialization
          ?.toLowerCase()
          .includes(
            specialty.toLowerCase(),
          ),
      );

    if (!matchingDoctors.length) {
      addBotMessage(
        `I couldn't find an active doctor for ${specialty}. Please choose another specialty or enter a doctor's name.`,
        [
          {
            label: "Choose another specialty",
            value: "specialty",
          },
          {
            label: "Enter doctor name",
            value: "doctor",
          },
        ],
      );

      setStep("doctorResults");
      return;
    }

    setStep("doctorResults");

    addBotMessage(
      `I found ${matchingDoctors.length} doctor${
        matchingDoctors.length === 1
          ? ""
          : "s"
      } for ${specialty}. Please select one.`,
      matchingDoctors.map(
        (doctor) => ({
          label: `${doctor.name}${
            doctor.specialization
              ? ` · ${doctor.specialization}`
              : ""
          }`,
          value: `doctor:${doctor.id}`,
        }),
      ),
    );
  };

  const showDateOptions = (
    doctor: Doctor,
  ) => {
    setStep("date");
    setError("");

    addBotMessage(
      `${doctor.name} is selected. What date would you like?`,
      [
        {
          label: "Today",
          value: getToday(),
        },
        {
          label: "Tomorrow",
          value: getNextDate(1),
        },
        {
          label: "Choose another date",
          value: "custom",
        },
      ],
    );
  };

  const selectDoctor = (
    doctor: Doctor,
  ) => {
    const nextDraft = {
      ...draft,
      doctor: doctor.name,
      doctorId: doctor.id,
      specialty:
        doctor.specialization || "",
      date: "",
      time: "",
      startTime: "",
      endTime: "",
    };

    setDraft(nextDraft);
    setAvailability(null);

    showDateOptions(doctor);
  };

  const showTimeOptions = (
    result: AvailabilityResponse,
  ) => {
    const availableSlots =
      result.slots.filter(
        (slot) =>
          slot.status === "available",
      );

    if (!availableSlots.length) {
      addBotMessage(
        result.message ||
          "There are no available appointments for this doctor on that date. Please choose another date.",
        [
          {
            label: "Choose another date",
            value: "custom",
          },
        ],
      );

      setStep("date");
      return;
    }

    const periods: Array<
      "Morning" | "Afternoon" | "Evening"
    > = [
      "Morning",
      "Afternoon",
      "Evening",
    ];

    const options: ChatOption[] =
      [];

    for (const period of periods) {
      const periodSlots =
        availableSlots.filter(
          (slot) =>
            getTimePeriod(
              slot.start_time,
            ) === period,
        );

      if (periodSlots.length) {
        options.push({
          label: `${period} (${periodSlots.length} available)`,
          value: `period:${period}`,
        });
      }
    }

    options.push(
      ...availableSlots.map(
        (slot) => ({
          label: `${formatTime(
            slot.start_time,
          )} – ${formatTime(
            slot.end_time,
          )}`,
          value: `slot:${slot.start_time}|${slot.end_time}`,
        }),
      ),
    );

    addBotMessage(
      `I found ${availableSlots.length} available slot${
        availableSlots.length === 1
          ? ""
          : "s"
      } for ${formatDate(
        result.date,
      )}. Choose a time.`,
      options,
    );

    setStep("time");
  };

  const askAppointmentType = (
    nextDraft: BookingDraft,
  ) => {
    setDraft(nextDraft);
    setStep("appointmentType");

    addBotMessage(
      "What type of appointment would you like?",
      [
        {
          label: "In person",
          value: "IN_PERSON",
        },
        {
          label: "Telehealth",
          value: "TELEHEALTH",
        },
      ],
    );
  };

  const askInsurance = (
    nextDraft: BookingDraft,
  ) => {
    setDraft(nextDraft);
    setStep("insurance");

    addBotMessage(
      `Your current profile shows: ${insuranceSummary}. Would you like to use this insurance information?`,
      [
        {
          label: "Yes, use my insurance",
          value: "use_profile",
        },
        {
          label: "I don't have insurance",
          value: "none",
        },
      ],
    );
  };

  const askConfirmation = (
    nextDraft: BookingDraft,
  ) => {
    setDraft(nextDraft);
    setStep("confirm");

    addBotMessage(
      "Please review your appointment details before continuing. The final booking will still use the existing secure booking flow and live server checks.",
      [
        {
          label: "Confirm and continue",
          value: "confirm",
        },
        {
          label: "Change details",
          value: "change",
        },
      ],
    );
  };

  const showChangeOptions = () => {
    addBotMessage(
      "Sure. Which part would you like to change?",
      [
        {
          label: "Doctor",
          value: "change_doctor",
        },
        {
          label: "Date",
          value: "change_date",
        },
        {
          label: "Time",
          value: "change_time",
        },
        {
          label: "Appointment type",
          value: "change_type",
        },
        {
          label: "Reason",
          value: "change_reason",
        },
        {
          label: "Insurance",
          value: "change_insurance",
        },
      ],
    );
  };

  const handlePeriodSelection = (
    period: "Morning" | "Afternoon" | "Evening",
  ) => {
    if (!availability) {
      return;
    }

    const slots =
      availability.slots.filter(
        (slot) =>
          slot.status === "available" &&
          getTimePeriod(
            slot.start_time,
          ) === period,
      );

    if (!slots.length) {
      addBotMessage(
        `There are no available ${period.toLowerCase()} slots for this date.`,
      );
      return;
    }

    addBotMessage(
      `Here are the available ${period.toLowerCase()} times:`,
      slots.map((slot) => ({
        label: `${formatTime(
          slot.start_time,
        )} – ${formatTime(
          slot.end_time,
        )}`,
        value: `slot:${slot.start_time}|${slot.end_time}`,
      })),
    );

    setStep("time");
  };

  /* ==========================================================
     REAL CONVERSATIONAL BACKEND

     This is the active interaction path. The old detailed
     frontend flow remains below as a compatibility/reference
     path so existing doctor, availability and UI code is not
     deleted or shortened.
     ========================================================== */

  const sendMessageToBackend = async (
    message: string,
  ): Promise<void> => {
    const cleanMessage = message.trim();

    if (!cleanMessage || chatbotTyping) {
      return;
    }

    const currentToken =
      localStorage.getItem("access_token");

    if (!currentToken) {
      addBotMessage(
        "Your patient session has expired. Please log in again to continue.",
      );
      return;
    }

    addPatientMessage(cleanMessage);
    setInput("");
    setError("");
    setChatbotTyping(true);

    try {
      const response = await fetch(
        `${API_URL}/chatbot/patient`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({
            message: cleanMessage,
            session_id: chatSessionId,
          }),
        },
      );

      let data: ChatbotApiResponse | { detail?: string };

      try {
        data = await response.json();
      } catch {
        data = {
          detail:
            "The appointment assistant returned an invalid response.",
        };
      }

      if (response.status === 401) {
        sessionStorage.removeItem(
          "healthcare_patient_chatbot_session_id",
        );
        setChatSessionId(null);
        setChatbotConnected(false);
        addBotMessage(
          "Your patient login has expired. Please log in again to continue.",
        );
        return;
      }

      if (!response.ok) {
        const detail =
          "detail" in data
            ? data.detail
            : undefined;

        throw new Error(
          detail ||
            "I could not process that message right now.",
        );
      }

      const chatbotResponse =
        data as ChatbotApiResponse;

      setChatbotConnected(true);

      if (chatbotResponse.session_id) {
        setChatSessionId(
          chatbotResponse.session_id,
        );

        sessionStorage.setItem(
          "healthcare_patient_chatbot_session_id",
          chatbotResponse.session_id,
        );
      }

      /* --------------------------------------------------------
         Merge backend booking draft into the existing frontend
         draft. Existing insurance/referral information is kept.
         -------------------------------------------------------- */

      const { booking } =
        chatbotResponse;

      if (booking) {
        setDraft((current) => ({
          ...current,
          doctor:
            booking.doctor_name ||
            current.doctor,
          doctorId:
            booking.doctor_id ??
            current.doctorId,
          specialty:
            booking.specialization ||
            current.specialty,
          date:
            booking.appointment_date ||
            current.date,
          time:
            booking.start_time
              ? `${formatTime(
                  booking.start_time,
                )}${
                  booking.end_time
                    ? ` – ${formatTime(
                        booking.end_time,
                      )}`
                    : ""
                }`
              : current.time,
          startTime:
            booking.start_time ||
            current.startTime,
          endTime:
            booking.end_time ||
            current.endTime,
          appointmentType:
            booking.appointment_type ||
            current.appointmentType,
          reason:
            booking.reason ||
            current.reason,
        }));

        if (booking.doctor_id) {
          setStep("doctorResults");
        }

        if (booking.appointment_date) {
          setStep("date");
        }

        if (
          booking.start_time &&
          booking.end_time
        ) {
          setStep("time");
        }

        if (booking.appointment_type) {
          setStep("appointmentType");
        }

        if (
          booking.reason &&
          booking.appointment_type
        ) {
          setStep("confirm");
        }
      }

      /* --------------------------------------------------------
         Backend response is the actual chatbot reply.
         Suggestions are optional quick actions, not an MCQ flow.
         -------------------------------------------------------- */

      addBotMessage(
        chatbotResponse.message,
        chatbotResponse.options,
      );

      /* --------------------------------------------------------
         Existing secure booking handoff.

         When the backend explicitly requests a booking handoff,
         the existing AppointmentBooking component remains
         available. Final direct chatbot confirmation uses the
         dedicated /chatbot/patient/book endpoint, which delegates
         to the existing appointment creation and server-side
         validation rules.
         -------------------------------------------------------- */

      if (
        chatbotResponse.redirect_to_booking &&
        booking
      ) {
        setStep("complete");

        window.setTimeout(() => {
          onOpenBooking?.(
            booking.appointment_date ||
              undefined,
            booking.doctor_id ||
              undefined,
            booking.start_time ||
              undefined,
            booking.appointment_type ||
              undefined,
            booking.reason ||
              undefined,
          );
        }, 450);
      }

      if (
        chatbotResponse.requires_authentication
      ) {
        setStep("intent");
      }
    } catch (err) {
      console.error(
        "Patient chatbot backend error:",
        err,
      );

      setChatbotConnected(false);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the appointment assistant.",
      );

      addBotMessage(
        "I am having trouble connecting to the appointment assistant. Please try sending your message again.",
      );
    } finally {
      setChatbotTyping(false);

      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
        });
      }, 50);
    }
  };

  /* ----------------------------------------------------------
     Quick suggestion buttons also use natural language.
     ---------------------------------------------------------- */

  const confirmChatbotBooking = async (
    sessionId: string,
  ): Promise<void> => {
    const currentToken =
      localStorage.getItem("access_token");

    if (!currentToken) {
      addBotMessage(
        "Your patient login has expired. Please log in again to continue.",
      );
      return;
    }

    setChatbotTyping(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/chatbot/patient/book`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
          }),
        },
      );

      let data:
        | ChatbotBookingConfirmationResponse
        | { detail?: string };

      try {
        data = await response.json();
      } catch {
        data = {
          detail:
            "The appointment booking service returned an invalid response.",
        };
      }

      if (response.status === 401) {
        sessionStorage.removeItem(
          "healthcare_patient_chatbot_session_id",
        );
        setChatSessionId(null);
        setChatbotConnected(false);
        addBotMessage(
          "Your patient login has expired. Please log in again to continue.",
        );
        return;
      }

      if (!response.ok) {
        const detail =
          "detail" in data
            ? data.detail
            : undefined;

        throw new Error(
          detail ||
            "I could not complete the appointment booking.",
        );
      }

      const result =
        data as ChatbotBookingConfirmationResponse;

      const { appointment } =
        result;

      setStep("complete");

      addBotMessage(
        result.message ||
          `Your appointment has been booked successfully${
            appointment?.doctor_name
              ? ` with ${appointment.doctor_name}`
              : ""
          }${
            appointment?.appointment_date
              ? ` for ${formatDate(
                  appointment.appointment_date,
                )}`
              : ""
          }${
            appointment?.start_time &&
            appointment?.end_time
              ? ` at ${formatTime(
                  appointment.start_time,
                )} – ${formatTime(
                  appointment.end_time,
                )}`
              : ""
          }.`,
      );

      if (appointment) {
        setDraft((current) => ({
          ...current,
          doctor:
            appointment.doctor_name ||
            current.doctor,
          date:
            appointment.appointment_date ||
            current.date,
          startTime:
            appointment.start_time ||
            current.startTime,
          endTime:
            appointment.end_time ||
            current.endTime,
          time:
            appointment.start_time
              ? `${formatTime(
                  appointment.start_time,
                )}${
                  appointment.end_time
                    ? ` – ${formatTime(
                        appointment.end_time,
                      )}`
                    : ""
                }`
              : current.time,
          appointmentType:
            appointment.appointment_type ||
            current.appointmentType,
          reason:
            appointment.reason ||
            current.reason,
        }));
      }
    } catch (err) {
      console.error(
        "Patient chatbot booking error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete the appointment booking.",
      );

      addBotMessage(
        err instanceof Error
          ? err.message
          : "I could not complete the appointment booking. Please try again.",
      );
    } finally {
      setChatbotTyping(false);

      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
        });
      }, 50);
    }
  };

  const handleOption = (
    option: ChatOption,
  ) => {
    const isConfirmOption =
      option.value === "confirm" ||
      option.label
        .trim()
        .toLowerCase() ===
        "confirm and continue";

    if (isConfirmOption) {
      if (!chatSessionId) {
        addBotMessage(
          "I couldn't find the current booking session. Please start the appointment conversation again.",
        );
        return;
      }

      addPatientMessage(
        option.label,
      );

      void confirmChatbotBooking(
        chatSessionId,
      );
      return;
    }

    void sendMessageToBackend(
      option.label,
    );
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const value = input.trim();

    if (!value || chatbotTyping) {
      return;
    }

    void sendMessageToBackend(
      value,
    );
  };

  const handleLegacyOption = (
    option: ChatOption,
  ) => {
    addPatientMessage(option.label);

    if (
      option.value === "retry_doctors"
    ) {
      void fetchDoctors();
      return;
    }

    if (
      option.value ===
      "retry_availability"
    ) {
      if (
        draft.doctorId &&
        draft.date
      ) {
        void loadAvailability(
          draft.doctorId,
          draft.date,
        ).then((result) => {
          if (result) {
            showTimeOptions(result);
          }
        });
      }
      return;
    }

    if (step === "intent") {
      if (
        option.value === "book" ||
        option.value === "doctor"
      ) {
        void askDoctor();
        return;
      }

      if (
        option.value ===
        "appointments"
      ) {
        addBotMessage(
          "Your existing appointments are already available in your Patient Dashboard calendar. I can help you book a new appointment from here.",
          [
            {
              label: "Book an appointment",
              value: "book",
            },
          ],
        );
        return;
      }
    }

    if (
      step === "doctor" &&
      option.value === "specialty"
    ) {
      askSpecialty();
      return;
    }

    if (
      step === "doctor" &&
      option.value === "doctor"
    ) {
      setStep("doctor");
      addBotMessage(
        "Please type the doctor's name.",
      );
      return;
    }

    if (step === "specialty") {
      if (
        option.value ===
        "specialty"
      ) {
        askSpecialty();
        return;
      }

      const specialty =
        option.value;

      const nextDraft = {
        ...draft,
        specialty,
        doctor: "",
        doctorId: null,
        date: "",
        time: "",
        startTime: "",
        endTime: "",
      };

      setDraft(nextDraft);

      showDoctorResults(
        specialty,
      );
      return;
    }

    if (
      step === "doctorResults"
    ) {
      if (
        option.value ===
        "specialty"
      ) {
        askSpecialty();
        return;
      }

      if (
        option.value ===
        "doctor"
      ) {
        setStep("doctor");

        addBotMessage(
          "Please type the doctor's name.",
        );

        return;
      }

      if (
        option.value.startsWith(
          "doctor:",
        )
      ) {
        const doctorId =
          Number(
            option.value.split(
              ":",
            )[1],
          );

        const doctor =
          doctors.find(
            (item) =>
              item.id === doctorId,
          );

        if (doctor) {
          selectDoctor(doctor);
        }

        return;
      }
    }

    if (step === "date") {
      if (
        option.value ===
        "custom"
      ) {
        addBotMessage(
          "Please type the date in YYYY-MM-DD format.",
        );
        return;
      }

      if (
        !draft.doctorId
      ) {
        addBotMessage(
          "Please select a doctor first.",
        );
        setStep("doctor");
        return;
      }

      const nextDate =
        option.value;

      const nextDraft = {
        ...draft,
        date: nextDate,
        time: "",
        startTime: "",
        endTime: "",
      };

      setDraft(nextDraft);

      void loadAvailability(
        draft.doctorId,
        nextDate,
      ).then((result) => {
        if (result) {
          showTimeOptions(result);
        }
      });

      return;
    }

    if (step === "time") {
      if (
        option.value.startsWith(
          "period:",
        )
      ) {
        const period =
          option.value.replace(
            "period:",
            "",
          ) as
            | "Morning"
            | "Afternoon"
            | "Evening";

        handlePeriodSelection(
          period,
        );

        return;
      }

      if (
        option.value.startsWith(
          "slot:",
        )
      ) {
        const value =
          option.value.replace(
            "slot:",
            "",
          );

        const [startTime, endTime] =
          value.split("|");

        const selectedSlot =
          availability?.slots.find(
            (slot) =>
              slot.start_time ===
                startTime &&
              slot.end_time ===
                endTime &&
              slot.status ===
                "available",
          );

        if (!selectedSlot) {
          addBotMessage(
            "That appointment slot is no longer available. I'll refresh the live schedule.",
          );

          if (
            draft.doctorId &&
            draft.date
          ) {
            void loadAvailability(
              draft.doctorId,
              draft.date,
            ).then((result) => {
              if (result) {
                showTimeOptions(
                  result,
                );
              }
            });
          }

          return;
        }

        const nextDraft = {
          ...draft,
          time: `${formatTime(
            startTime,
          )} – ${formatTime(
            endTime,
          )}`,
          startTime,
          endTime,
        };

        askAppointmentType(
          nextDraft,
        );

        return;
      }
    }

    if (
      step ===
      "appointmentType"
    ) {
      const nextDraft = {
        ...draft,
        appointmentType:
          option.value,
      };

      setDraft(nextDraft);

      addBotMessage(
        "What is the main reason for this appointment? You can describe it naturally.",
      );

      setStep("reason");
      return;
    }

    if (step === "insurance") {
      if (
        option.value ===
        "use_profile"
      ) {
        const nextDraft = {
          ...draft,
          insurance:
            insuranceProvider ||
            "Insurance on file",
        };

        setStep("insuranceActive");
        setDraft(nextDraft);

        addBotMessage(
          "Is your insurance currently active?",
          [
            {
              label:
                "Yes, it is active",
              value: "active",
            },
            {
              label:
                "No, it is not active",
              value: "inactive",
            },
          ],
        );

        return;
      }

      if (
        option.value === "none"
      ) {
        askConfirmation({
          ...draft,
          insurance:
            "No insurance",
          insuranceActive:
            "Not applicable",
        });

        return;
      }
    }

    if (
      step ===
      "insuranceActive"
    ) {
      askConfirmation({
        ...draft,
        insuranceActive:
          option.value === "active"
            ? "Active"
            : "Inactive",
      });

      return;
    }

    if (step === "confirm") {
      if (
        option.value === "change"
      ) {
        showChangeOptions();
        return;
      }

      if (
        option.value === "confirm"
      ) {
        setStep("complete");

        addBotMessage(
          "Perfect. I'm opening the existing secure appointment booking flow with your selected doctor, exact available time, appointment type, and reason. The existing server-side insurance/referral checks will remain in control of the final booking.",
        );

        window.setTimeout(() => {
          onOpenBooking?.(
            draft.date || undefined,
            draft.doctorId ||
              undefined,
            draft.startTime ||
              undefined,
            draft.appointmentType ||
              undefined,
            draft.reason ||
              undefined,
          );
        }, 350);

        return;
      }
    }

    if (
      option.value ===
      "change_doctor"
    ) {
      void askDoctor();
      return;
    }

    if (
      option.value ===
      "change_date"
    ) {
      if (draft.doctorId) {
        showDateOptions(
          doctors.find(
            (doctor) =>
              doctor.id ===
              draft.doctorId,
          ) || {
            id: draft.doctorId,
            name:
              draft.doctor ||
              "Selected doctor",
            specialization:
              draft.specialty,
            requires_referral:
              false,
          },
        );
      } else {
        void askDoctor();
      }

      return;
    }

    if (
      option.value ===
      "change_time"
    ) {
      if (
        draft.doctorId &&
        draft.date
      ) {
        setStep("time");

        if (availability) {
          showTimeOptions(
            availability,
          );
        } else {
          void loadAvailability(
            draft.doctorId,
            draft.date,
          ).then((result) => {
            if (result) {
              showTimeOptions(
                result,
              );
            }
          });
        }
      } else {
        addBotMessage(
          "Please select your doctor and date first.",
        );
      }

      return;
    }

    if (
      option.value ===
      "change_type"
    ) {
      setStep(
        "appointmentType",
      );

      addBotMessage(
        "What type of appointment would you like?",
        [
          {
            label: "In person",
            value: "IN_PERSON",
          },
          {
            label: "Telehealth",
            value: "TELEHEALTH",
          },
        ],
      );

      return;
    }

    if (
      option.value ===
      "change_reason"
    ) {
      setStep("reason");

      addBotMessage(
        "Please describe the reason for the appointment again.",
      );

      return;
    }

    if (
      option.value ===
      "change_insurance"
    ) {
      askInsurance(draft);
    }
  };

  const handleLegacySubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const value =
      input.trim();

    if (!value) {
      return;
    }

    addPatientMessage(value);
    setInput("");

    if (step === "doctor") {
      const normalized =
        value.toLowerCase();

      if (
        normalized.includes(
          "don't know",
        ) ||
        normalized ===
          "not sure"
      ) {
        askSpecialty();
        return;
      }

      const matchingDoctors =
        doctors.filter(
          (doctor) =>
            doctor.name
              .toLowerCase()
              .includes(normalized),
        );

      if (
        matchingDoctors.length ===
        1
      ) {
        selectDoctor(
          matchingDoctors[0],
        );
        return;
      }

      if (
        matchingDoctors.length >
        1
      ) {
        setStep(
          "doctorResults",
        );

        addBotMessage(
          `I found ${matchingDoctors.length} matching doctors. Please select one.`,
          matchingDoctors.map(
            (doctor) => ({
              label: `${doctor.name}${
                doctor.specialization
                  ? ` · ${doctor.specialization}`
                  : ""
              }`,
              value: `doctor:${doctor.id}`,
            }),
          ),
        );

        return;
      }

      if (
        !doctors.length
      ) {
        void fetchDoctors().then(
          (loadedDoctors) => {
            const match =
              loadedDoctors.find(
                (doctor) =>
                  doctor.name
                    .toLowerCase()
                    .includes(
                      normalized,
                    ),
              );

            if (match) {
              selectDoctor(match);
              return;
            }

            addBotMessage(
              "I couldn't find that doctor in the current active doctor list. Please try another name or choose a specialty.",
              [
                {
                  label:
                    "Choose by specialty",
                  value:
                    "specialty",
                },
              ],
            );
          },
        );

        return;
      }

      addBotMessage(
        "I couldn't find that doctor in the current active doctor list. Please check the name or choose a specialty.",
        [
          {
            label:
              "Choose by specialty",
            value: "specialty",
          },
        ],
      );

      return;
    }

    if (
      step ===
      "specialty"
    ) {
      showDoctorResults(
        value,
      );
      return;
    }

    if (
      step === "date"
    ) {
      const parsedDate =
        getDateFromText(
          value,
        );

      if (!parsedDate) {
        addBotMessage(
          "I couldn't understand that date. Please use YYYY-MM-DD, or type today or tomorrow.",
        );
        return;
      }

      if (
        parsedDate <
        getToday()
      ) {
        addBotMessage(
          "That date has already passed. Please choose today or a future date.",
        );
        return;
      }

      if (
        !draft.doctorId
      ) {
        addBotMessage(
          "Please select a doctor before choosing a date.",
        );
        setStep("doctor");
        return;
      }

      setDraft({
        ...draft,
        date: parsedDate,
        time: "",
        startTime: "",
        endTime: "",
      });

      void loadAvailability(
        draft.doctorId,
        parsedDate,
      ).then((result) => {
        if (result) {
          showTimeOptions(
            result,
          );
        }
      });

      return;
    }

    if (
      step === "reason"
    ) {
      if (
        value.length < 2
      ) {
        addBotMessage(
          "Please provide a little more detail about the reason for the appointment.",
        );
        return;
      }

      const nextDraft = {
        ...draft,
        reason: value,
      };

      askInsurance(
        nextDraft,
      );

      return;
    }

    if (
      step === "intent"
    ) {
      const normalized =
        value.toLowerCase();

      if (
        normalized.includes(
          "appointment",
        ) ||
        normalized.includes(
          "book",
        ) ||
        normalized.includes(
          "schedule",
        ) ||
        normalized.includes(
          "doctor",
        )
      ) {
        void askDoctor();
        return;
      }

      if (
        normalized.includes(
          "my appointment",
        ) ||
        normalized.includes(
          "appointments",
        )
      ) {
        addBotMessage(
          "Your existing appointments are available in your Patient Dashboard calendar. I can also help you book a new one.",
          [
            {
              label:
                "Book an appointment",
              value: "book",
            },
          ],
        );
        return;
      }

      addBotMessage(
        "I can help you book an appointment, find a doctor, or review your existing appointments. What would you like to do?",
        [
          {
            label:
              "Book an appointment",
            value: "book",
          },
          {
            label:
              "Find a doctor",
            value: "doctor",
          },
          {
            label:
              "View my appointments",
            value:
              "appointments",
          },
        ],
      );

      return;
    }

    if (
      step === "insurance"
    ) {
      addBotMessage(
        "Please choose one of the insurance options above so I can continue.",
        [
          {
            label:
              "Yes, use my insurance",
            value:
              "use_profile",
          },
          {
            label:
              "I don't have insurance",
            value: "none",
          },
        ],
      );

      return;
    }

    if (
      step ===
      "insuranceActive"
    ) {
      addBotMessage(
        "Please tell me whether your insurance is currently active.",
        [
          {
            label:
              "Yes, it is active",
            value: "active",
          },
          {
            label:
              "No, it is not active",
            value: "inactive",
          },
        ],
      );

      return;
    }

    if (
      step === "confirm"
    ) {
      addBotMessage(
        "Please use the confirmation buttons above to continue.",
        [
          {
            label:
              "Confirm and continue",
            value:
              "confirm",
          },
          {
            label:
              "Change details",
            value: "change",
          },
        ],
      );

      return;
    }

    addBotMessage(
      "I can continue helping with your appointment. Please choose one of the available options.",
    );
  };

  /* Keep the original detailed frontend flow available without
     activating it as the primary conversational path. */
  void handleLegacyOption;
  void handleLegacySubmit;

  const showSummary =
    step === "confirm" ||
    step === "complete";

  return (
    <>
      {!open && (
        <button
          type="button"
          className="patient-chatbot-launcher"
          onClick={() =>
            setOpen(true)
          }
          aria-label="Open appointment assistant"
        >
          <span className="patient-chatbot-launcher-icon">
            ✦
          </span>

          <span>
            <strong>
              Appointment Assistant
            </strong>

            <small>
              Book with chat
            </small>
          </span>
        </button>
      )}

      {open && (
        <section
          className="patient-chatbot"
          aria-label="Patient appointment assistant"
        >
          <header className="patient-chatbot-header">
            <div className="patient-chatbot-brand">
              <div className="patient-chatbot-avatar">
                ✦
              </div>

              <div>
                <strong>
                  Appointment Assistant
                </strong>

                <span>
                  Patient Portal
                </span>
              </div>
            </div>

            <div className="patient-chatbot-header-actions">
              <button
                type="button"
                onClick={
                  resetChat
                }
                title="Start over"
              >
                ↻
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                title="Close"
              >
                ×
              </button>
            </div>
          </header>

          <div className="patient-chatbot-security">
            <span>●</span>
            Secure patient conversation

            <span className="patient-chatbot-connection-status">
              {chatbotTyping
                ? "Assistant is thinking…"
                : chatbotConnected
                ? "Connected"
                : "Ready"}
            </span>
          </div>

          {error && (
            <div
              className="patient-chatbot-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="patient-chatbot-body">
            {messages.map(
              (message) => (
                <div
                  className={`patient-chat-message ${
                    message.sender ===
                    "patient"
                      ? "patient-message"
                      : "bot-message"
                  }`}
                  key={message.id}
                >
                  <div className="patient-chat-bubble">
                    {message.text}
                  </div>

                  {message.options &&
                    message.sender ===
                      "bot" && (
                      <div className="patient-chat-options">
                        {message.options.map(
                          (
                            option,
                          ) => (
                            <button
                              type="button"
                              key={
                                option.value
                              }
                              onClick={() =>
                                handleOption(
                                  option,
                                )
                              }
                              disabled={
                                loadingDoctors ||
                                loadingAvailability
                              }
                            >
                              {option.label}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                </div>
              ),
            )}

            {(loadingDoctors ||
              loadingAvailability) && (
              <div className="patient-chat-message bot-message">
                <div className="patient-chat-bubble">
                  {loadingDoctors
                    ? "Loading the current doctor list…"
                    : "Checking live appointment availability…"}
                </div>
              </div>
            )}

            {chatbotTyping && (
              <div className="patient-chat-message bot-message patient-chatbot-typing-message">
                <div className="patient-chat-bubble patient-chatbot-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div
              ref={messagesEndRef}
            />

            {showSummary && (
              <div className="patient-chat-summary">
                <div className="patient-chat-summary-title">
                  Appointment summary
                </div>

                <div className="patient-chat-summary-row">
                  <span>
                    Doctor
                  </span>

                  <strong>
                    {draft.doctor ||
                      draft.specialty ||
                      "Not selected"}
                  </strong>
                </div>

                <div className="patient-chat-summary-row">
                  <span>
                    Date
                  </span>

                  <strong>
                    {draft.date
                      ? formatDate(
                          draft.date,
                        )
                      : "Not selected"}
                  </strong>
                </div>

                <div className="patient-chat-summary-row">
                  <span>
                    Time
                  </span>

                  <strong>
                    {draft.startTime
                      ? `${formatTime(
                          draft.startTime,
                        )} – ${formatTime(
                          draft.endTime,
                        )}`
                      : "Not selected"}
                  </strong>
                </div>

                <div className="patient-chat-summary-row">
                  <span>
                    Appointment type
                  </span>

                  <strong>
                    {draft.appointmentType ===
                    "TELEHEALTH"
                      ? "Telehealth"
                      : draft.appointmentType ===
                        "IN_PERSON"
                      ? "In person"
                      : "Not selected"}
                  </strong>
                </div>

                <div className="patient-chat-summary-row">
                  <span>
                    Reason
                  </span>

                  <strong>
                    {draft.reason ||
                      "Not provided"}
                  </strong>
                </div>

                <div className="patient-chat-summary-row">
                  <span>
                    Insurance
                  </span>

                  <strong>
                    {draft.insurance ||
                      "Not selected"}
                  </strong>
                </div>

                <div className="patient-chat-summary-row">
                  <span>
                    Insurance status
                  </span>

                  <strong>
                    {draft.insuranceActive ||
                      "Not selected"}
                  </strong>
                </div>
              </div>
            )}
          </div>

          <form
            className="patient-chatbot-input"
            onSubmit={
              handleSubmit
            }
          >
            <input
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value,
                )
              }
              placeholder={
                step === "date"
                  ? "YYYY-MM-DD, today, or tomorrow"
                  : "Type your message..."
              }
              aria-label="Chat message"
              disabled={
                loadingDoctors ||
                loadingAvailability
              }
            />

            <button
              type="submit"
              disabled={
                !input.trim() ||
                chatbotTyping ||
                loadingDoctors ||
                loadingAvailability
              }
              aria-label="Send message"
            >
              →
            </button>
          </form>

          <footer className="patient-chatbot-footer">
            <span>
              Healthcare+ Patient Assistant
            </span>

            <small>
              For appointment assistance only
            </small>
          </footer>
        </section>
      )}
    </>
  );
}

export default PatientChatbot;