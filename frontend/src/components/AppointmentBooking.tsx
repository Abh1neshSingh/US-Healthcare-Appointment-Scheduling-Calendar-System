import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import API_URL from "../config";
import "./AppointmentBooking.css";

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

interface PatientProfile {
  id: number;
  patient_id: number;
  name: string;
  email: string;
  role: string;
  insurance_provider?: string | null;
  insurance_member_id?: string | null;
  pcp_doctor_id?: number | null;
}

interface Referral {
  id: number;
  patient_id: number;
  referring_doctor_id: number;
  specialist_doctor_id: number;
  referral_number?: string | null;
  status: string;
  issued_date: string;
  expiry_date?: string | null;
  reason?: string | null;
  authorization_required: boolean;
  authorization_status: string;
  notes?: string | null;
  created_at?: string;
}

interface AppointmentBookingProps {
  onBookingSuccess?: () => void;
  initialDate?: string;
  initialDoctorId?: number | null;
  initialStartTime?: string;
}

type ReferralStatus =
  | "idle"
  | "checking"
  | "not_required"
  | "direct_booking"
  | "valid"
  | "missing"
  | "invalid"
  | "authorization_required"
  | "error";

type BookingStep = "selection" | "coverage" | "review";

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value: string) => {
  if (!value) return "Select a date";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
};

const formatTime = (value: string) => {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const maskMemberId = (value?: string | null) => {
  if (!value) return "Not provided";
  if (value.length <= 4) return value;
  return `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const getInitialStep = (
  initialDate?: string,
  initialDoctorId?: number | null,
  initialStartTime?: string
): BookingStep => {
  return initialDate && initialDoctorId && initialStartTime
    ? "coverage"
    : "selection";
};

function AppointmentBooking({
  onBookingSuccess,
  initialDate,
  initialDoctorId,
  initialStartTime,
}: AppointmentBookingProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState(
    initialDoctorId !== undefined && initialDoctorId !== null
      ? String(initialDoctorId)
      : ""
  );
  const [selectedDate, setSelectedDate] = useState(initialDate || getToday());
  const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);
  const [availability, setAvailability] =
    useState<AvailabilityResponse | null>(null);
  const [patientProfile, setPatientProfile] =
    useState<PatientProfile | null>(null);

  const [referralStatus, setReferralStatus] =
    useState<ReferralStatus>("idle");
  const [loadingPatientProfile, setLoadingPatientProfile] = useState(false);
  const [loadingReferral, setLoadingReferral] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [booking, setBooking] = useState(false);

  const [step, setStep] = useState<BookingStep>(
    getInitialStep(initialDate, initialDoctorId, initialStartTime)
  );
  const [insuranceActive, setInsuranceActive] = useState<boolean | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [showAllSlots, setShowAllSlots] = useState(false);

  const token = localStorage.getItem("access_token");
  const today = getToday();

  const selectedDoctorData = useMemo(
    () =>
      doctors.find((doctor) => doctor.id === Number(selectedDoctor)) || null,
    [doctors, selectedDoctor]
  );

  const hasInsurance = Boolean(
    patientProfile?.insurance_provider || patientProfile?.insurance_member_id
  );

  const coverageReady =
    !hasInsurance || insuranceActive !== null;

  const canBookAppointment = () => {
    if (!selectedDoctorData) return false;
    if (!selectedDoctorData.requires_referral) return true;
    if (!patientProfile) return false;
    if (!hasInsurance) return true;
    return referralStatus === "valid";
  };

  const eligibilityState = useMemo(() => {
    if (!selectedDoctorData) {
      return {
        tone: "neutral",
        title: "Choose a doctor",
        detail: "Select a doctor to review booking requirements.",
      };
    }

    if (loadingPatientProfile || loadingReferral) {
      return {
        tone: "loading",
        title: "Checking booking requirements",
        detail: "Reviewing your patient profile and coverage requirements.",
      };
    }

    if (!canBookAppointment()) {
      if (referralStatus === "missing") {
        return {
          tone: "warning",
          title: "Additional documentation required",
          detail: "This specialist requires an active referral before booking.",
        };
      }
      if (referralStatus === "invalid") {
        return {
          tone: "warning",
          title: "Coverage requirement needs attention",
          detail: "No active referral was found for the selected specialist and date.",
        };
      }
      if (referralStatus === "authorization_required") {
        return {
          tone: "warning",
          title: "Authorization pending",
          detail: "Prior authorization must be approved before this appointment can be booked.",
        };
      }
      if (referralStatus === "error") {
        return {
          tone: "danger",
          title: "Unable to complete the check",
          detail: "Please try again before continuing.",
        };
      }
    }

    return {
      tone: "ready",
      title: "Ready to continue",
      detail: hasInsurance
        ? "Your coverage details are available for review."
        : "No insurance is on file. You can continue with the booking.",
    };
  }, [
    selectedDoctorData,
    loadingPatientProfile,
    loadingReferral,
    referralStatus,
    patientProfile,
    hasInsurance,
  ]);

  const fetchPatientProfile = async () => {
    try {
      setLoadingPatientProfile(true);
      const response = await fetch(`${API_URL}/users/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load patient information.");
      setPatientProfile(data);
    } catch (err) {
      console.error("Error loading patient profile:", err);
      setPatientProfile(null);
      setError(err instanceof Error ? err.message : "Unable to load patient information.");
    } finally {
      setLoadingPatientProfile(false);
    }
  };

  useEffect(() => {
    void fetchPatientProfile();
  }, []);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoadingDoctors(true);
        const response = await fetch(`${API_URL}/users/doctors`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to load doctors.");
        setDoctors(Array.isArray(data) ? data : data.doctors || []);
      } catch (err) {
        console.error("Error loading doctors:", err);
        setError(err instanceof Error ? err.message : "Unable to load doctors. Please try again.");
      } finally {
        setLoadingDoctors(false);
      }
    };
    void fetchDoctors();
  }, []);

  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
    if (initialDoctorId !== undefined && initialDoctorId !== null) {
      setSelectedDoctor(String(initialDoctorId));
    }
    if (initialDate && initialDoctorId && initialStartTime) {
      setStep("coverage");
    }
  }, [initialDate, initialDoctorId, initialStartTime]);

  useEffect(() => {
    if (!selectedDoctor || !selectedDoctorData) {
      setReferralStatus("idle");
      return;
    }

    if (!selectedDoctorData.requires_referral) {
      setReferralStatus("not_required");
      return;
    }

    if (!patientProfile) return;

    if (!hasInsurance) {
      setReferralStatus("direct_booking");
      return;
    }

    const fetchReferral = async () => {
      try {
        setLoadingReferral(true);
        setReferralStatus("checking");
        const response = await fetch(
          `${API_URL}/referrals/patient/${patientProfile.patient_id}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to check booking requirements.");

        const referrals: Referral[] = Array.isArray(data)
          ? data
          : data.referrals || [];

        const specialistReferrals = referrals.filter(
          (referral) =>
            referral.specialist_doctor_id === Number(selectedDoctor)
        );

        if (!specialistReferrals.length) {
          setReferralStatus("missing");
          return;
        }

        const validReferral = specialistReferrals.find((referral) => {
          const issued = referral.issued_date;
          const expiry = referral.expiry_date;
          const dateValid =
            issued <= selectedDate && (!expiry || expiry >= selectedDate);
          return referral.status === "ACTIVE" && dateValid;
        });

        if (!validReferral) {
          setReferralStatus("invalid");
          return;
        }

        if (
          validReferral.authorization_required &&
          validReferral.authorization_status !== "APPROVED"
        ) {
          setReferralStatus("authorization_required");
          return;
        }

        setReferralStatus("valid");
      } catch (err) {
        console.error("Error checking booking requirements:", err);
        setReferralStatus("error");
        setError(err instanceof Error ? err.message : "Unable to verify booking requirements.");
      } finally {
        setLoadingReferral(false);
      }
    };

    void fetchReferral();
  }, [selectedDoctor, selectedDoctorData, patientProfile, selectedDate, hasInsurance]);

  const loadAvailability = async () => {
    if (!selectedDoctor || !selectedDate) return;

    try {
      setLoadingAvailability(true);
      setAvailability(null);
      setSelectedTime(null);
      setShowAllSlots(false);
      setError("");
      setSuccess("");

      const params = new URLSearchParams({
        doctor_id: selectedDoctor,
        appointment_date: selectedDate,
      });

      const response = await fetch(
        `${API_URL}/appointments/availability?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load availability.");
      }

      setAvailability(data);
      setLastUpdated(new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }));

      if (initialStartTime && Array.isArray(data.slots)) {
        const matchingSlot = data.slots.find(
          (slot: TimeSlot) =>
            slot.start_time === initialStartTime &&
            slot.status === "available"
        );
        if (matchingSlot) setSelectedTime(matchingSlot);
      }
    } catch (err) {
      console.error("Error loading availability:", err);
      setAvailability(null);
      setError(err instanceof Error ? err.message : "Unable to load availability.");
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    void loadAvailability();
  }, [selectedDoctor, selectedDate]);

  useEffect(() => {
    if (step !== "selection" || !selectedDoctor || !selectedDate) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadAvailability();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [step, selectedDoctor, selectedDate]);

  const handleDoctorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedDoctor(event.target.value);
    setAvailability(null);
    setSelectedTime(null);
    setShowAllSlots(false);
    setInsuranceActive(null);
    setStep("selection");
    setError("");
    setSuccess("");
  };

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(event.target.value);
    setAvailability(null);
    setSelectedTime(null);
    setShowAllSlots(false);
    setInsuranceActive(null);
    setStep("selection");
    setError("");
    setSuccess("");
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    if (slot.status !== "available") return;
    setSelectedTime(slot);
    setInsuranceActive(null);
    setStep("coverage");
    setError("");
    setSuccess("");
  };

  const getSlotDisplayStatus = (slot: TimeSlot) => {
    if (slot.status === "booked") return "booked";
    if (slot.status === "break") return "break";
    if (slot.status === "unavailable") return "unavailable";
    if (availability && availability.available_slots <= 3) return "few";
    return "available";
  };

  const handleContinueToReview = () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      setError("Please select a doctor, date and available time.");
      return;
    }

    if (loadingPatientProfile || loadingReferral) {
      setError("Please wait while we finish checking your booking information.");
      return;
    }

    if (!coverageReady) {
      setError("Please confirm whether your insurance is currently active.");
      return;
    }

    if (!canBookAppointment()) {
      setError(eligibilityState.detail);
      return;
    }

    setError("");
    setStep("review");
  };

  const handleFinalBooking = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) return;

    if (!canBookAppointment()) {
      setShowConfirmation(false);
      setError(eligibilityState.detail);
      setStep("coverage");
      return;
    }

    try {
      setBooking(true);
      setError("");

      const response = await fetch(`${API_URL}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          doctor_id: Number(selectedDoctor),
          appointment_date: selectedDate,
          start_time: selectedTime.start_time,
          end_time: selectedTime.end_time,
          appointment_type: "IN_PERSON",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to book appointment.");

      setShowConfirmation(false);
      setSuccess("Appointment booked successfully.");
      setStep("selection");
      setSelectedTime(null);
      setInsuranceActive(null);

      await loadAvailability();

      if (onBookingSuccess) onBookingSuccess();
    } catch (err) {
      console.error("Error booking appointment:", err);
      setShowConfirmation(false);
      setError(err instanceof Error ? err.message : "Unable to book appointment.");
    } finally {
      setBooking(false);
    }
  };

  const openConfirmation = () => {
    if (!selectedTime || !availability) return;
    setError("");
    setShowConfirmation(true);
  };

  const doctorLabel = selectedDoctorData
    ? `${selectedDoctorData.name}${selectedDoctorData.specialization ? ` · ${selectedDoctorData.specialization}` : ""}`
    : "Choose a doctor";

  const selectedTimeLabel = selectedTime
    ? `${formatTime(selectedTime.start_time)} – ${formatTime(selectedTime.end_time)}`
    : "Select an available time";

  const appointmentDuration = selectedTime
    ? Math.max(
        0,
        (Number(selectedTime.end_time.split(":")[0]) * 60 +
          Number(selectedTime.end_time.split(":")[1])) -
          (Number(selectedTime.start_time.split(":")[0]) * 60 +
            Number(selectedTime.start_time.split(":")[1]))
      )
    : 0;

  const availabilityRate =
    availability && availability.total_slots > 0
      ? Math.round(
          (availability.available_slots / availability.total_slots) * 100
        )
      : 0;

  const visibleSlots = availability
    ? showAllSlots
      ? availability.slots
      : availability.slots.slice(0, 12)
    : [];

  const hiddenSlotCount = availability
    ? Math.max(0, availability.slots.length - visibleSlots.length)
    : 0;

  const goBackToSelection = () => {
    setShowConfirmation(false);
    setStep("selection");
    setError("");
  };

  const goBackToCoverage = () => {
    setShowConfirmation(false);
    setStep("coverage");
    setError("");
  };

  return (
    <div className="appointment-booking">
      <div className="booking-header">
        <div>
          <div className="booking-eyebrow">
            <span className="booking-eyebrow-dot" />
            BOOK APPOINTMENT
          </div>
          <h2>Find the right time for your care</h2>
          <p>
            Choose your doctor, review live availability, confirm your coverage
            details, and securely submit the appointment request.
          </p>
        </div>
        <div className="booking-secure-badge">
          <span>✓</span>
          Patient portal
        </div>
      </div>

      <div className="booking-progress" aria-label="Booking progress">
        {[
          ["selection", "01", "Choose"],
          ["coverage", "02", "Coverage"],
          ["review", "03", "Review"],
        ].map(([key, number, label], index) => {
          const order: BookingStep[] = ["selection", "coverage", "review"];
          const activeIndex = order.indexOf(step);
          const itemIndex = order.indexOf(key as BookingStep);
          const complete = itemIndex < activeIndex;
          const active = itemIndex === activeIndex;

          return (
            <div className="booking-progress-item" key={key}>
              <div className={`booking-progress-node ${active ? "active" : ""} ${complete ? "complete" : ""}`}>
                {complete ? "✓" : number}
              </div>
              <span className={active ? "active" : ""}>{label}</span>
              {index < 2 && <i />}
            </div>
          );
        })}
      </div>

      {step === "selection" && (
        <>
      <section className="booking-selection-panel">
        <div className="booking-section-heading">
          <div>
            <span className="booking-section-kicker">STEP 01</span>
            <h3>Appointment details</h3>
            <p>Start with the clinician and date that work for you.</p>
          </div>
          {availability && (
            <button
              type="button"
              className="booking-refresh"
              onClick={() => void loadAvailability()}
              disabled={loadingAvailability}
            >
              ↻ {loadingAvailability ? "Checking" : "Refresh"}
            </button>
          )}
        </div>

        <div className="booking-selection">
          <div className="booking-field">
            <label htmlFor="booking-doctor">Select doctor</label>
            <div className="booking-input-shell">
              <span className="booking-input-icon">DR</span>
              <select
                id="booking-doctor"
                value={selectedDoctor}
                onChange={handleDoctorChange}
                disabled={loadingDoctors}
              >
                <option value="">
                  {loadingDoctors ? "Loading doctors..." : "Choose a doctor"}
                </option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                    {doctor.specialization ? ` — ${doctor.specialization}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="booking-field">
            <label htmlFor="booking-date">Appointment date</label>
            <div className="booking-input-shell">
              <span className="booking-input-icon">DATE</span>
              <input
                id="booking-date"
                type="date"
                value={selectedDate}
                min={today}
                onChange={handleDateChange}
              />
            </div>
          </div>
        </div>

        <div className="booking-context-strip">
          <div>
            <span>Selected clinician</span>
            <strong>{doctorLabel}</strong>
          </div>
          <div>
            <span>Appointment date</span>
            <strong>{formatDate(selectedDate)}</strong>
          </div>
          <div>
            <span>Booking type</span>
            <strong>In-person visit</strong>
          </div>
        </div>
      </section>

        </>
      )}

      {error && (
        <div className="booking-alert error" role="alert">
          <span className="booking-alert-icon">!</span>
          <div>
            <strong>We need your attention</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="booking-alert success" role="status">
          <span className="booking-alert-icon">✓</span>
          <div>
            <strong>Appointment confirmed</strong>
            <p>{success}</p>
          </div>
        </div>
      )}

      {step === "selection" && (
        <>
      {selectedDoctor && selectedDate && (
        <section className="availability-section">
          <div className="availability-header">
            <div>
              <span className="booking-section-kicker">LIVE SCHEDULE</span>
              <h3>{availability?.doctor_name || selectedDoctorData?.name || "Doctor availability"}</h3>
              <p>
                {formatDate(selectedDate)}
                {lastUpdated ? ` · Updated ${lastUpdated}` : ""}
              </p>
            </div>
            <div className="availability-live">
              <span className="live-pulse" />
              Live availability
            </div>
          </div>

          {loadingAvailability ? (
            <div className="availability-loading-card">
              <div className="loading-spinner" />
              <div>
                <strong>Checking the live schedule</strong>
                <span>Looking for open appointment times.</span>
              </div>
            </div>
          ) : availability ? (
            <>
              <div className="availability-summary">
                <div>
                  <span>Total slots</span>
                  <strong>{availability.total_slots}</strong>
                </div>
                <div>
                  <span>Booked</span>
                  <strong>{availability.booked_slots}</strong>
                </div>
                <div className="available-stat">
                  <span>Available</span>
                  <strong>{availability.available_slots}</strong>
                </div>
              </div>

              <div className="slot-heading">
                <div>
                  <strong>Select a time</strong>
                  <span>Only currently available times can be selected.</span>
                </div>
                <div className="slot-legend">
                  <span><i className="dot available" /> Available</span>
                  <span><i className="dot booked" /> Booked</span>
                  <span><i className="dot blocked" /> Unavailable</span>
                </div>
              </div>

              <div className="time-slots">
                {visibleSlots.map((slot) => {
                  const displayStatus = getSlotDisplayStatus(slot);
                  const selected =
                    selectedTime?.start_time === slot.start_time &&
                    selectedTime?.end_time === slot.end_time;

                  return (
                    <button
                      key={`${slot.start_time}-${slot.end_time}`}
                      type="button"
                      disabled={slot.status !== "available"}
                      className={`time-slot ${displayStatus} ${selected ? "selected" : ""}`}
                      onClick={() => handleTimeSelect(slot)}
                      aria-pressed={selected}
                    >
                      <span>{formatTime(slot.start_time)}</span>
                      <small>
                        {slot.status === "booked"
                          ? "Booked"
                          : slot.status === "break"
                            ? "Break"
                            : slot.status === "unavailable"
                              ? "Unavailable"
                              : displayStatus === "few"
                                ? "Few openings"
                                : "Available"}
                      </small>
                      {selected && <b>✓</b>}
                    </button>
                  );
                })}
              </div>

              {availability.slots.length > 12 && (
                <div className="slot-expander">
                  <button
                    type="button"
                    className="slot-expander-button"
                    onClick={() => setShowAllSlots((value) => !value)}
                  >
                    {showAllSlots
                      ? "Show fewer times"
                      : `Show ${hiddenSlotCount} more time${hiddenSlotCount === 1 ? "" : "s"}`}
                    <span>{showAllSlots ? "↑" : "↓"}</span>
                  </button>
                </div>
              )}

              {!availability.available && (
                <div className="no-availability">
                  <strong>No appointment openings on this date</strong>
                  <span>
                    {availability.message || "Try another date to find an available appointment."}
                  </span>
                </div>
              )}
            </>
          ) : null}
        </section>
      )}

      {selectedTime && availability && (
        <section className="selected-appointment">
          <div className="selected-appointment-main">
            <div className="selected-check">✓</div>
            <div>
              <span>Selected appointment</span>
              <strong>{availability.doctor_name}</strong>
              <p>
                {formatDate(selectedDate)} · {formatTime(selectedTime.start_time)} – {formatTime(selectedTime.end_time)}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="confirm-booking-button"
            onClick={handleContinueToReview}
            disabled={loadingPatientProfile || loadingReferral || booking}
          >
            Continue to coverage
            <span>→</span>
          </button>
        </section>
      )}
        </>
      )}

      {selectedTime && availability && step !== "selection" && (
        <section className="booking-step-context">
          <div className="booking-step-context-main">
            <div className="booking-context-avatar">
              {availability.doctor_name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <span>APPOINTMENT SELECTED</span>
              <strong>{availability.doctor_name}</strong>
              <p>
                {formatDate(selectedDate)} · {selectedTimeLabel}
                {appointmentDuration ? ` · ${appointmentDuration} min` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="booking-edit-selection"
            onClick={goBackToSelection}
            disabled={booking}
          >
            Edit selection
          </button>
        </section>
      )}

      {selectedTime && availability && step === "coverage" && (
        <section className="coverage-panel active">
          <div className="coverage-header">
            <div>
              <span className="booking-section-kicker">STEP 02</span>
              <h3>Coverage & patient confirmation</h3>
              <p>Review the information we have before you continue.</p>
            </div>
            <div className={`eligibility-pill ${eligibilityState.tone}`}>
              <span />
              {eligibilityState.title}
            </div>
          </div>

          <div className="coverage-grid">
            <div className="coverage-card">
              <span className="coverage-card-label">INSURANCE ON FILE</span>
              {loadingPatientProfile ? (
                <div className="coverage-loading">Loading patient profile…</div>
              ) : hasInsurance ? (
                <>
                  <strong>{patientProfile?.insurance_provider}</strong>
                  <div className="member-row">
                    <span>Member ID</span>
                    <b>{maskMemberId(patientProfile?.insurance_member_id)}</b>
                  </div>
                  <small>Member ID is masked for privacy.</small>
                </>
              ) : (
                <>
                  <strong>Self-pay / no insurance on file</strong>
                  <small>No payer information has been added to your patient profile.</small>
                </>
              )}
            </div>

            <div className="coverage-card">
              <span className="coverage-card-label">PATIENT CONFIRMATION</span>
              <strong>Is your insurance currently active?</strong>
              <p>
                This is your confirmation only. It does not replace a real-time
                payer eligibility check.
              </p>
              <div className="coverage-choice-group">
                <button
                  type="button"
                  className={insuranceActive === true ? "selected" : ""}
                  onClick={() => setInsuranceActive(true)}
                >
                  <span>✓</span>
                  Yes, active
                </button>
                <button
                  type="button"
                  className={insuranceActive === false ? "selected" : ""}
                  onClick={() => setInsuranceActive(false)}
                >
                  <span>?</span>
                  Not sure
                </button>
              </div>
            </div>

            <div className="coverage-card booking-schedule-card">
              <span className="coverage-card-label">SCHEDULE CHECK</span>
              <strong>{availability.available_slots} openings remain</strong>
              <div className="schedule-meter">
                <span style={{ width: `${availabilityRate}%` }} />
              </div>
              <div className="schedule-meta">
                <span>{availabilityRate}% of listed slots available</span>
                <b>{lastUpdated ? `Updated ${lastUpdated}` : "Live schedule"}</b>
              </div>
              <small>
                The appointment slot is checked again by the server when you book.
              </small>
            </div>
          </div>

          <div className={`eligibility-detail ${eligibilityState.tone}`}>
            <div className="eligibility-detail-icon">
              {eligibilityState.tone === "ready" ? "✓" : eligibilityState.tone === "loading" ? "…" : "!"}
            </div>
            <div>
              <strong>{eligibilityState.title}</strong>
              <p>{eligibilityState.detail}</p>
            </div>
          </div>

          <div className="coverage-trust-note">
            <span>⌁</span>
            <p>
              Your member ID is masked in this booking screen. Patient confirmation
              is stored only as part of this booking session and is not a payer
              eligibility response.
            </p>
          </div>

          <div className="coverage-actions">
            <button
              type="button"
              className="secondary-booking-button"
              onClick={goBackToSelection}
            >
              ← Change selection
            </button>
            <button
              type="button"
              className="primary-booking-button"
              onClick={() => {
                handleContinueToReview();
              }}
              disabled={!coverageReady || loadingPatientProfile || loadingReferral || !canBookAppointment()}
            >
              Review appointment
              <span>→</span>
            </button>
          </div>
        </section>
      )}

      {selectedTime && availability && step === "review" && (
        <section className="review-panel">
          <div className="review-header">
            <div>
              <span className="booking-section-kicker">STEP 03</span>
              <h3>Review appointment</h3>
              <p>Everything looks ready. Confirm the details before booking.</p>
            </div>
            <span className="review-ready">READY TO BOOK</span>
          </div>

          <div className="review-patient-strip">
            <div>
              <span>PATIENT</span>
              <strong>{patientProfile?.name || "Current patient"}</strong>
            </div>
            <div>
              <span>CONTACT</span>
              <strong>{patientProfile?.email || "Patient portal"}</strong>
            </div>
            <div>
              <span>APPOINTMENT LENGTH</span>
              <strong>{appointmentDuration ? `${appointmentDuration} minutes` : "Standard visit"}</strong>
            </div>
          </div>

          <div className="review-layout">
            <div className="review-main-card">
              <div className="review-doctor">
                <div className="doctor-avatar">
                  {availability.doctor_name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <span>CARE PROVIDER</span>
                  <strong>{availability.doctor_name}</strong>
                  <small>{selectedDoctorData?.specialization || "Healthcare provider"}</small>
                </div>
              </div>

              <div className="review-details-grid">
                <div>
                  <span>Date</span>
                  <strong>{formatDate(selectedDate)}</strong>
                </div>
                <div>
                  <span>Time</span>
                  <strong>{formatTime(selectedTime.start_time)} – {formatTime(selectedTime.end_time)}</strong>
                </div>
                <div>
                  <span>Visit type</span>
                  <strong>In-person</strong>
                </div>
                <div>
                  <span>Coverage</span>
                  <strong>
                    {hasInsurance
                      ? patientProfile?.insurance_provider || "Insurance on file"
                      : "Self-pay / uninsured"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="review-side-card">
              <span className="booking-section-kicker">BEFORE YOU BOOK</span>
              <h4>Final confirmation</h4>
              <ul>
                <li><span>✓</span> Time is currently available.</li>
                <li><span>✓</span> Patient information is loaded.</li>
                <li><span>✓</span> Booking requirements have been checked.</li>
              </ul>
              <p>
                Final booking is subject to the server confirming that the slot
                is still available.
              </p>
            </div>
          </div>

          <div className="review-actions">
            <button
              type="button"
              className="secondary-booking-button"
              onClick={goBackToCoverage}
              disabled={booking}
            >
              ← Back
            </button>
            <button
              type="button"
              className="primary-booking-button"
              onClick={openConfirmation}
              disabled={booking || !canBookAppointment()}
            >
              Continue to confirmation
              <span>→</span>
            </button>
          </div>
        </section>
      )}

      {showConfirmation && selectedTime && availability && (
        <div className="confirmation-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !booking) {
            setShowConfirmation(false);
          }
        }}>
          <div className="confirmation-card" role="dialog" aria-modal="true" aria-labelledby="booking-confirm-title">
            <button
              type="button"
              className="confirmation-close"
              onClick={() => setShowConfirmation(false)}
              disabled={booking}
              aria-label="Close confirmation"
            >
              ×
            </button>

            <div className="confirmation-top">
              <div className="confirmation-icon">✓</div>
              <span className="confirmation-kicker">FINAL CHECK</span>
              <h3 id="booking-confirm-title">Ready to book?</h3>
              <p>Confirm the appointment details below. The slot will be submitted to the scheduling system.</p>
            </div>

            <div className="confirmation-summary">
              <div className="confirmation-summary-primary">
                <span>APPOINTMENT</span>
                <strong>{availability.doctor_name}</strong>
                <p>{formatDate(selectedDate)}</p>
                <b>{formatTime(selectedTime.start_time)} – {formatTime(selectedTime.end_time)}</b>
              </div>
              <div className="confirmation-summary-grid">
                <div>
                  <span>Patient</span>
                  <strong>{patientProfile?.name || "Current patient"}</strong>
                </div>
                <div>
                  <span>Visit</span>
                  <strong>In-person</strong>
                </div>
                <div>
                  <span>Coverage</span>
                  <strong>{hasInsurance ? patientProfile?.insurance_provider : "Self-pay"}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>Ready to submit</strong>
                </div>
              </div>
            </div>

            <div className="confirmation-note">
              <span>i</span>
              <p>
                Your appointment will only be created after the scheduling
                server confirms the slot is still available.
              </p>
            </div>

            <div className="confirmation-next-steps">
              <div>
                <span>01</span>
                <p>Submit appointment request</p>
              </div>
              <div>
                <span>02</span>
                <p>Server re-checks the selected slot</p>
              </div>
              <div>
                <span>03</span>
                <p>Appointment is created in your account</p>
              </div>
            </div>

            <div className="confirmation-actions">
              <button
                type="button"
                className="confirmation-cancel"
                onClick={() => setShowConfirmation(false)}
                disabled={booking}
              >
                Go back
              </button>
              <button
                type="button"
                className="confirmation-submit"
                onClick={() => void handleFinalBooking()}
                disabled={booking || !canBookAppointment()}
              >
                {booking ? (
                  <>
                    <span className="button-spinner" />
                    Booking…
                  </>
                ) : (
                  <>Confirm & Book <span>→</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppointmentBooking;
