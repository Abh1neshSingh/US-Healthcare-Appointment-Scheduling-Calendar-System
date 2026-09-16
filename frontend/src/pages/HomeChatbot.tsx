import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./HomeChatbot.css";
import API_URL from "../config";

interface ChatMessage {
  id: number;
  role: "bot" | "user";
  text: string;
  options?: ChatbotOption[];
}

interface ChatDoctor {
  id: number;
  name: string;
  specialization?: string | null;
  department?: string | null;
}

interface ChatbotOption {
  label: string;
  value: string;
}

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

interface ChatbotResponse {
  session_id: string;
  message: string;
  intent?: string;
  confidence?: number;
  mode?: string;
  options?: ChatbotOption[];
  booking?: ChatbotBooking | null;
  requires_authentication?: boolean;
  redirect_to_booking?: boolean;
  emergency?: boolean;
}

interface HomeChatbotProps {
  doctors?: ChatDoctor[];
  onBook?: () => void;
}

type ChatStep =
  | "welcome"
  | "symptoms"
  | "duration"
  | "severity"
  | "age"
  | "recommendation"
  | "emergency";

interface SymptomData {
  symptoms: string[];
  duration: string;
  severity: string;
  ageGroup: string;
}

const welcomeOptions: ChatbotOption[] = [
  {
    label: "Find the right doctor",
    value: "Find the right doctor",
  },
  {
    label: "Book an appointment",
    value: "Book an appointment",
  },
  {
    label: "I need emergency help",
    value: "I need emergency help",
  },
];

const authenticationOptions: ChatbotOption[] = [
  {
    label: "Login",
    value: "__AUTH_LOGIN__",
  },
  {
    label: "New patient? Register",
    value: "__AUTH_REGISTER__",
  },
];

const symptomOptions = [
  "Fever",
  "Cough",
  "Headache",
  "Stomach pain",
  "Back pain",
  "Skin problem",
  "Joint pain",
  "Breathing problem",
];

const durationOptions = [
  "Today",
  "2–3 days",
  "About a week",
  "More than a week",
];

const severityOptions = [
  "Mild",
  "Moderate",
  "Severe",
];

const ageOptions = [
  "Child",
  "Teenager",
  "Adult",
  "Older adult",
];

const createMessage = (
  role: "bot" | "user",
  text: string,
  options?: string[] | ChatbotOption[],
): ChatMessage => ({
  id: Date.now() + Math.random(),
  role,
  text,
  options: options?.map((option) =>
    typeof option === "string"
      ? {
          label: option,
          value: option,
        }
      : option,
  ),
});

const HomeChatbot: React.FC<HomeChatbotProps> = ({
  doctors = [],
  onBook,
}) => {
  const navigate = useNavigate();

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "bot",
      text:
        "Hi! I'm the HealthCare+ Care Assistant. I can help you find the right type of doctor based on what you're experiencing and help you start an appointment.",
      options: welcomeOptions,
    },
  ]);

  const [input, setInput] = useState("");

  const [typing, setTyping] = useState(false);

  const [step, setStep] = useState<ChatStep>("welcome");

  const [selectedSymptoms, setSelectedSymptoms] =
    useState<string[]>([]);

  const [symptomData, setSymptomData] =
    useState<SymptomData>({
      symptoms: [],
      duration: "",
      severity: "",
      ageGroup: "",
    });

  const [recommendedSpecialty, setRecommendedSpecialty] =
    useState("");

  /*
   * The public Home chatbot now keeps a backend conversation
   * session. The session belongs only to this browser tab and
   * is used by the FastAPI chatbot service to retain context.
   */
  const [sessionId, setSessionId] =
    useState<string | null>(() =>
      sessionStorage.getItem(
        "healthcare_home_chatbot_session_id",
      ),
    );

  const [backendConnected, setBackendConnected] =
    useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, typing]);

  const addBotMessage = (
    text: string,
    options?: string[] | ChatbotOption[],
  ) => {
    setTyping(true);

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        createMessage("bot", text, options),
      ]);

      setTyping(false);
    }, 450);
  };

  const addUserMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      createMessage("user", text),
    ]);
  };

  const resetChat = () => {
    setMessages([
      {
        id: 1,
        role: "bot",
        text:
          "Hi! I'm the HealthCare+ Care Assistant. I can help you find the right type of doctor based on what you're experiencing and help you start an appointment.",
        options: welcomeOptions,
      },
    ]);

    setInput("");
    setTyping(false);
    setStep("welcome");

    setSelectedSymptoms([]);

    setSymptomData({
      symptoms: [],
      duration: "",
      severity: "",
      ageGroup: "",
    });

    setRecommendedSpecialty("");

    sessionStorage.removeItem(
      "healthcare_home_chatbot_session_id",
    );

    setSessionId(null);
  };

  const openBooking = (
    addConversationMessage = true,
  ) => {
    /*
     * The Home chatbot is a public assistant. Booking is a
     * patient-only action, so the visitor should always make
     * an explicit account choice instead of being redirected
     * automatically.
     *
     * Existing patient:
     *     Login → Patient Dashboard → booking
     *
     * New patient:
     *     Register → create patient account → Login
     */
    if (addConversationMessage) {
      addBotMessage(
        "To book an appointment securely, please sign in to your existing patient account or create a new patient account.",
        authenticationOptions,
      );
      return;
    }

    addBotMessage(
      "To book an appointment securely, please sign in to your existing patient account or create a new patient account.",
      authenticationOptions,
    );
  };

  const showEmergency = (
    addConversationMessage = true,
  ) => {
    if (addConversationMessage) {
      addUserMessage("I need emergency help");
    }

    setStep("emergency");

    addBotMessage(
      "If you have a life-threatening emergency, severe trouble breathing, severe chest pain or pressure, sudden weakness, difficulty speaking, uncontrolled bleeding, or another serious emergency, please call 911 or go to the nearest emergency department now.",
    );
  };

  const startDoctorFinder = (
    addConversationMessage = true,
  ) => {
    if (addConversationMessage) {
      addUserMessage("Find the right doctor");
    }

    setStep("symptoms");

    addBotMessage(
      "Sure. What are you experiencing? Select one or more symptoms below, or type your symptoms in your own words.",
      symptomOptions,
    );
  };

  const getSpecialtyRecommendation = (
    symptoms: string[],
  ): string => {
    const text = symptoms.join(" ").toLowerCase();

    if (
      text.includes("chest") ||
      text.includes("heart") ||
      text.includes("palpitation")
    ) {
      return "Cardiology";
    }

    if (
      text.includes("breathing") ||
      text.includes("shortness of breath") ||
      text.includes("wheezing") ||
      text.includes("asthma")
    ) {
      return "Pulmonology";
    }

    if (
      text.includes("skin") ||
      text.includes("rash") ||
      text.includes("acne") ||
      text.includes("itch") ||
      text.includes("eczema")
    ) {
      return "Dermatology";
    }

    if (
      text.includes("joint") ||
      text.includes("knee") ||
      text.includes("shoulder") ||
      text.includes("bone") ||
      text.includes("back") ||
      text.includes("muscle")
    ) {
      return "Orthopedics";
    }

    if (
      text.includes("stomach") ||
      text.includes("abdomen") ||
      text.includes("abdominal") ||
      text.includes("digestion") ||
      text.includes("acid") ||
      text.includes("constipation") ||
      text.includes("diarrhea")
    ) {
      return "Gastroenterology";
    }

    if (
      text.includes("headache") ||
      text.includes("migraine") ||
      text.includes("dizziness") ||
      text.includes("seizure") ||
      text.includes("nerve")
    ) {
      return "Neurology";
    }

    if (
      text.includes("fever") ||
      text.includes("cough") ||
      text.includes("cold") ||
      text.includes("flu") ||
      text.includes("sore throat") ||
      text.includes("infection")
    ) {
      return "Primary Care";
    }

    return "Primary Care";
  };

  const finishSymptomStep = () => {
    if (selectedSymptoms.length === 0) {
      addBotMessage(
        "Please select at least one symptom or type what you're experiencing.",
        symptomOptions,
      );

      return;
    }

    const symptoms = [...selectedSymptoms];

    setSymptomData((current) => ({
      ...current,
      symptoms,
    }));

    setStep("duration");

    addBotMessage(
      "Thanks. How long have you had these symptoms?",
      durationOptions,
    );
  };

  const getBackendOptionValue = (
    option: ChatbotOption,
  ): string => {
    const value = option.value.trim();

    /*
     * Backend option values are intentionally used for
     * deterministic selections. Natural-language shortcuts
     * continue to use their visible label so the NLP layer can
     * handle them normally.
     */
    if (
      /^\\d+$/.test(value) ||
      /^\\d{2}:\\d{2}$/.test(value) ||
      /^\\d{4}-\\d{2}-\\d{2}$/.test(value) ||
      value === "IN_PERSON" ||
      value === "TELEHEALTH"
    ) {
      return value;
    }

    return option.label;
  };

  const handleAuthenticationOption = (
    option: ChatbotOption,
  ): boolean => {
    if (option.value === "__AUTH_LOGIN__") {
      navigate("/login");
      return true;
    }

    if (option.value === "__AUTH_REGISTER__") {
      navigate("/register");
      return true;
    }

    return false;
  };

  const handleOption = (
    option: ChatbotOption,
  ) => {
    if (typing) {
      return;
    }

    if (handleAuthenticationOption(option)) {
      return;
    }

    /*
     * A top-level "Book an appointment" action starts an
     * authentication decision, not a doctor-finder conversation.
     * Handle it before sending the previous Home session to the
     * backend. This prevents stale doctor-finder state from
     * changing the booking flow.
     */
    if (
      step === "welcome" &&
      option.label === "Book an appointment"
    ) {
      addUserMessage("Book an appointment");
      openBooking(false);
      return;
    }

    /*
     * Buttons are now shortcuts, not a questionnaire state
     * machine. Their text is sent to the same real chatbot
     * backend as typed messages.
     */
    void (async () => {
      const handledByBackend =
        await sendMessageToBackend(
          getBackendOptionValue(option),
          option.label,
        );

      if (!handledByBackend) {
        /*
         * Preserve the original button behavior if the
         * backend cannot be reached.
         */
        if (
          step === "welcome"
        ) {
          if (
            option.label ===
            "Find the right doctor"
          ) {
            startDoctorFinder(false);
            return;
          }

          if (
            option.label ===
            "Book an appointment"
          ) {
            openBooking(false);
            return;
          }

          if (
            option.label ===
            "I need emergency help"
          ) {
            showEmergency(false);
            return;
          }
        }

        if (
          step === "symptoms"
        ) {
          if (
            option.label ===
            "Continue"
          ) {
            finishSymptomStep();
            return;
          }

          if (
            symptomOptions.includes(
              option.label,
            )
          ) {
            const alreadySelected =
              selectedSymptoms.includes(
                option.label,
              );

            const updatedSymptoms =
              alreadySelected
                ? selectedSymptoms.filter(
                    (item) =>
                      item !==
                      option.label,
                  )
                : [
                    ...selectedSymptoms,
                    option.label,
                  ];

            setSelectedSymptoms(
              updatedSymptoms,
            );

            setSymptomData(
              (current) => ({
                ...current,
                symptoms:
                  updatedSymptoms,
              }),
            );

            addBotMessage(
              alreadySelected
                ? `"${option.label}" has been removed. Select another symptom or continue.`
                : `"${option.label}" has been added. Select another symptom if needed, or continue.`,
              [
                ...symptomOptions.filter(
                  (item) =>
                    !updatedSymptoms.includes(
                      item,
                    ),
                ),
                "Continue",
              ],
            );
          }

          return;
        }

        if (
          step === "duration" &&
          durationOptions.includes(
            option.label,
          )
        ) {
          setSymptomData(
            (current) => ({
              ...current,
              duration:
                option.label,
            }),
          );

          setStep(
            "severity",
          );

          addBotMessage(
            "How would you describe the severity of your symptoms right now?",
            severityOptions,
          );

          return;
        }

        if (
          step === "severity" &&
          severityOptions.includes(
            option.label,
          )
        ) {
          setSymptomData(
            (current) => ({
              ...current,
              severity:
                option.label,
            }),
          );

          setStep("age");

          addBotMessage(
            "One last question: which age group is the patient in?",
            ageOptions,
          );

          return;
        }

        if (
          step === "age" &&
          ageOptions.includes(
            option.label,
          )
        ) {
          const finalData =
            {
              ...symptomData,
              ageGroup:
                option.label,
            };

          setSymptomData(
            finalData,
          );

          const specialty =
            getSpecialtyRecommendation(
              finalData.symptoms,
            );

          setRecommendedSpecialty(
            specialty,
          );

          setStep(
            "recommendation",
          );

          addBotMessage(
            `Based on the information you shared, ${specialty} may be an appropriate place to start. This is guidance, not a diagnosis.`,
            [
              "Book an appointment",
              "Show matching doctors",
              "Start over",
            ],
          );

          return;
        }

        if (
          step ===
          "recommendation"
        ) {
          if (
            option.label ===
            "Book an appointment"
          ) {
            openBooking(false);
            return;
          }

          if (
            option.label ===
            "Show matching doctors"
          ) {
            showMatchingDoctors();
            return;
          }

          if (
            option.label ===
            "Start over"
          ) {
            resetChat();
          }
        }
      }
    })();
  };


  const showMatchingDoctors = () => {
    if (!recommendedSpecialty) {
      return;
    }

    const matches = doctors.filter((doctor) => {
      const value = [
        doctor.specialization,
        doctor.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return value.includes(
        recommendedSpecialty.toLowerCase(),
      );
    });

    if (matches.length === 0) {
      addBotMessage(
        `I don't currently see a provider with an exact ${recommendedSpecialty} match in the live directory. You can still continue to the appointment booking flow.`,
        [
          "Book an appointment",
          "Start over",
        ],
      );

      return;
    }

    const doctorList = matches
      .slice(0, 5)
      .map((doctor) => {
        const specialty =
          doctor.specialization ||
          doctor.department ||
          recommendedSpecialty;

        return `${doctor.name} — ${specialty}`;
      })
      .join("\n");

    addBotMessage(
      `Here are the matching providers I found:\n\n${doctorList}`,
      [
        "Book an appointment",
        "Start over",
      ],
    );
  };

  /*
   * ============================================================
   * REAL HOME CHATBOT BACKEND
   * ============================================================
   *
   * The original guided conversation remains below as a local
   * fallback so the public assistant does not become unusable
   * if the backend is temporarily unavailable.
   *
   * Normal operation:
   *
   * HomeChatbot
   *     ↓
   * POST /chatbot/home
   *     ↓
   * FastAPI router
   *     ↓
   * chatbot/service.py
   *     ↓
   * nlp.py + Transformer
   *     ↓
   * conversation.py
   *     ↓
   * response
   *
   * The Home chatbot never creates an appointment itself.
   * If the backend asks to start booking, the existing
   * application booking flow is opened through onBook().
   */
  const sendMessageToBackend = async (
    message: string,
    displayMessage?: string,
  ): Promise<boolean> => {
    const cleanMessage = message.trim();

    if (!cleanMessage || typing) {
      return true;
    }

    addUserMessage(
      displayMessage?.trim() || cleanMessage,
    );

    setTyping(true);

    try {
      const response = await fetch(
        `${API_URL}/chatbot/home`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: cleanMessage,
            session_id: sessionId,
          }),
        },
      );

      let data:
        | ChatbotResponse
        | { detail?: string };

      try {
        data = await response.json();
      } catch {
        data = {
          detail:
            "The chatbot returned an invalid response.",
        };
      }

      if (!response.ok) {
        const detail =
          "detail" in data
            ? data.detail
            : undefined;

        throw new Error(
          detail ||
            "The healthcare assistant could not process the request.",
        );
      }

      const chatbotResponse =
        data as ChatbotResponse;

      setBackendConnected(true);

      if (chatbotResponse.session_id) {
        setSessionId(
          chatbotResponse.session_id,
        );

        sessionStorage.setItem(
          "healthcare_home_chatbot_session_id",
          chatbotResponse.session_id,
        );
      }

      /*
       * Replace the artificial local typing delay with the
       * actual backend response.
       */
      setMessages((current) => [
        ...current,
        createMessage(
          "bot",
          chatbotResponse.message ||
            "I can help you find a doctor or start an appointment.",
          chatbotResponse.options ?? [],
        ),
      ]);

      setTyping(false);

      /*
       * Booking from the public Home chatbot requires an explicit
       * account choice. Never redirect automatically.
       *
       * The visitor chooses:
       *     Login
       *     New patient? Register
       *
       * The secure patient booking flow starts after the account
       * step. Existing appointment creation remains unchanged.
       */
      if (
        chatbotResponse.requires_authentication
      ) {
        setMessages((current) => [
          ...current,
          createMessage(
            "bot",
            "To book an appointment securely, please sign in to your existing patient account or create a new patient account.",
            authenticationOptions,
          ),
        ]);

        return true;
      }

      if (
        chatbotResponse.redirect_to_booking
      ) {
        if (onBook) {
          onBook();
        } else {
          navigate("/login");
        }
      }

      return true;
    } catch (error) {
      console.error(
        "Home chatbot backend error:",
        error,
      );

      setBackendConnected(false);
      setTyping(false);

      return false;
    }
  };

  /*
   * Local fallback for temporary backend/network failures.
   * This keeps the existing doctor-finder behavior intact
   * without making it the normal chatbot path.
   */
  const runLocalMessage = (
    value: string,
  ) => {
    if (step === "welcome") {
      const lower = value.toLowerCase();

      if (
        lower.includes("emergency") ||
        lower.includes("911") ||
        lower.includes("chest pain") ||
        lower.includes("can't breathe") ||
        lower.includes("cannot breathe")
      ) {
        setStep("emergency");

        addBotMessage(
          "If you have a life-threatening emergency, please call 911 or go to the nearest emergency department now.",
        );

        return;
      }

      if (
        lower.includes("appointment") ||
        lower.includes("book")
      ) {
        addBotMessage(
          "To book an appointment securely, please sign in to your existing patient account or create a new patient account.",
          authenticationOptions,
        );

        return;
      }

      setStep("symptoms");

      addBotMessage(
        "I can help you find an appropriate type of doctor. What symptoms are you experiencing?",
        symptomOptions,
      );

      return;
    }

    if (step === "symptoms") {
      const updated =
        selectedSymptoms.includes(value)
          ? selectedSymptoms
          : [
              ...selectedSymptoms,
              value,
            ];

      setSelectedSymptoms(updated);

      setSymptomData((current) => ({
        ...current,
        symptoms: updated,
      }));

      addBotMessage(
        "Got it. You can add another symptom or continue.",
        [
          ...symptomOptions.filter(
            (item) =>
              !updated.includes(item),
          ),
          "Continue",
        ],
      );

      return;
    }

    if (step === "duration") {
      const matchedDuration =
        durationOptions.find(
          (item) =>
            item.toLowerCase() ===
            value.toLowerCase(),
        );

      if (matchedDuration) {
        setSymptomData((current) => ({
          ...current,
          duration: matchedDuration,
        }));

        setStep("severity");

        addBotMessage(
          "How would you describe the severity of your symptoms right now?",
          severityOptions,
        );

        return;
      }

      setSymptomData((current) => ({
        ...current,
        duration: value,
      }));

      setStep("severity");

      addBotMessage(
        "Thanks. How would you describe the severity of your symptoms right now?",
        severityOptions,
      );

      return;
    }

    if (step === "severity") {
      const matchedSeverity =
        severityOptions.find(
          (item) =>
            item.toLowerCase() ===
            value.toLowerCase(),
        );

      const severity =
        matchedSeverity || value;

      setSymptomData((current) => ({
        ...current,
        severity,
      }));

      setStep("age");

      addBotMessage(
        "One last question: which age group is the patient in?",
        ageOptions,
      );

      return;
    }

    if (step === "age") {
      const finalData: SymptomData = {
        ...symptomData,
        ageGroup: value,
      };

      setSymptomData(finalData);

      const specialty =
        getSpecialtyRecommendation(
          finalData.symptoms,
        );

      setRecommendedSpecialty(
        specialty,
      );

      setStep("recommendation");

      addBotMessage(
        `Based on the information you shared, ${specialty} may be an appropriate place to start. This is guidance, not a diagnosis.`,
        [
          "Book an appointment",
          "Show matching doctors",
          "Start over",
        ],
      );

      return;
    }

    if (step === "recommendation") {
      const lower =
        value.toLowerCase();

      if (
        lower.includes("book") ||
        lower.includes("appointment")
      ) {
        addBotMessage(
          "To book an appointment securely, please sign in to your existing patient account or create a new patient account.",
          authenticationOptions,
        );

        return;
      }

      if (
        lower.includes("show") ||
        lower.includes("doctor")
      ) {
        showMatchingDoctors();

        return;
      }

      if (
        lower.includes("start") ||
        lower.includes("again")
      ) {
        resetChat();
      }
    }
  };

  const submitMessage = () => {
    const value = input.trim();

    if (!value || typing) {
      return;
    }

    setInput("");

    /*
     * Normal path: send every free-text message to the real
     * in-house chatbot backend. The backend owns intent,
     * entity extraction and conversation state.
     */
    void (async () => {
      const handledByBackend =
        await sendMessageToBackend(
          value,
        );

      /*
       * Only use the original local flow when the API is
       * unavailable. This preserves the application's
       * existing behavior during development/offline cases.
       */
      if (!handledByBackend) {
        runLocalMessage(value);
      }
    })();
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          className="home-chatbot-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open HealthCare+ Care Assistant"
        >
          <span className="home-chatbot-launcher-icon">
            ✦
          </span>

          <span className="home-chatbot-launcher-copy">
            <strong>Care Assistant</strong>
            <small>How can we help?</small>
          </span>

          <span className="home-chatbot-launcher-dot" />
        </button>
      )}

      {open && (
        <section
          className="home-chatbot"
          aria-label="HealthCare+ Care Assistant"
        >
          <header className="home-chatbot-header">
            <div className="home-chatbot-header-icon">
              +
            </div>

            <div className="home-chatbot-header-content">
              <strong>
                HealthCare+ Assistant
              </strong>

              <span>
                In-house healthcare assistant
              </span>
            </div>

            <div className="home-chatbot-header-actions">
              <button
                type="button"
                onClick={resetChat}
                aria-label="Restart conversation"
                title="Restart"
              >
                ↻
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                title="Close"
              >
                ×
              </button>
            </div>
          </header>

          <div className="home-chatbot-notice">
            <span>●</span>

            <p>
              This assistant provides guidance, not a
              diagnosis.
            </p>

            <span
              className={`home-chatbot-connection ${
                backendConnected
                  ? "connected"
                  : "ready"
              }`}
              title={
                backendConnected
                  ? "Connected to the in-house chatbot"
                  : "Ready"
              }
            >
              <i />
              {backendConnected
                ? "Assistant online"
                : "Ready"}
            </span>
          </div>

          <div className="home-chatbot-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`home-chatbot-message-row ${
                  message.role === "user"
                    ? "user"
                    : "bot"
                }`}
              >
                {message.role === "bot" && (
                  <span className="home-chatbot-avatar">
                    +
                  </span>
                )}

                <div className="home-chatbot-message">
                  <p>{message.text}</p>

                  {message.options &&
                    message.options.length > 0 && (
                      <div className="home-chatbot-options">
                        {message.options.map(
                          (option) => (
                            <button
                              key={`${option.value}-${option.label}`}
                              type="button"
                              disabled={typing}
                              onClick={() =>
                                handleOption(
                                  option,
                                )
                              }
                            >
                              {option.label}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="home-chatbot-message-row bot">
                <span className="home-chatbot-avatar">
                  +
                </span>

                <div className="home-chatbot-message home-chatbot-typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <footer className="home-chatbot-input-area">
            <div className="home-chatbot-input">
              <input
                type="text"
                value={input}
                disabled={typing}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitMessage();
                  }
                }}
                placeholder={
                  step === "symptoms"
                    ? "Describe your symptoms..."
                    : "Type your message..."
                }
                aria-label="Message"
              />

              <button
                type="button"
                disabled={
                  typing ||
                  input.trim().length === 0
                }
                onClick={submitMessage}
                aria-label="Send message"
              >
                →
              </button>
            </div>

            <small>
              HealthCare+ secure scheduling workflow
            </small>
          </footer>
        </section>
      )}
    </>
  );
};

export default HomeChatbot;