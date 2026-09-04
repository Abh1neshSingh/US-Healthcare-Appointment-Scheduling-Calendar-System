import {
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
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
  status:
    | "available"
    | "booked"
    | "break"
    | "unavailable";
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

  // Values received from Day View
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

function AppointmentBooking({
  onBookingSuccess,
  initialDate,
  initialDoctorId,
  initialStartTime,
}: AppointmentBookingProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [selectedDoctor, setSelectedDoctor] =
    useState(
      initialDoctorId !== undefined &&
        initialDoctorId !== null
        ? String(initialDoctorId)
        : ""
    );

  const [selectedDate, setSelectedDate] =
    useState(initialDate || "");

  const [selectedTime, setSelectedTime] =
    useState<TimeSlot | null>(null);

  const [availability, setAvailability] =
    useState<AvailabilityResponse | null>(
      null
    );

  // ==================================================
  // PATIENT / REFERRAL STATE
  // ==================================================

  const [patientProfile, setPatientProfile] =
    useState<PatientProfile | null>(null);

  const [referralStatus, setReferralStatus] =
    useState<ReferralStatus>("idle");

  const [loadingPatientProfile, setLoadingPatientProfile] =
    useState(false);

  const [loadingReferral, setLoadingReferral] =
    useState(false);

  // ==================================================
  // BOOKING STATE
  // ==================================================

  const [loadingDoctors, setLoadingDoctors] =
    useState(false);

  const [
    loadingAvailability,
    setLoadingAvailability,
  ] = useState(false);

  const [booking, setBooking] =
    useState(false);

  const [
    showConfirmation,
    setShowConfirmation,
  ] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  // ==================================================
  // GET PATIENT PROFILE
  // ==================================================

  useEffect(() => {
    const fetchPatientProfile = async () => {
      try {
        setLoadingPatientProfile(true);

        const token =
          localStorage.getItem(
            "access_token"
          );

        const response = await fetch(
          `${API_URL}/users/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to load patient information."
          );
        }

        setPatientProfile(data);
      } catch (error) {
        console.error(
          "Error loading patient profile:",
          error
        );

        setPatientProfile(null);

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load patient information."
        );
      } finally {
        setLoadingPatientProfile(false);
      }
    };

    fetchPatientProfile();
  }, []);

  // ==================================================
  // GET DOCTORS
  // ==================================================

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoadingDoctors(true);
        setError("");

        const token =
          localStorage.getItem(
            "access_token"
          );

        const response = await fetch(
          `${API_URL}/users/doctors`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to load doctors."
          );
        }

        setDoctors(
          Array.isArray(data)
            ? data
            : data.doctors || []
        );
      } catch (error) {
        console.error(
          "Error loading doctors:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load doctors. Please try again."
        );
      } finally {
        setLoadingDoctors(false);
      }
    };

    fetchDoctors();
  }, []);

  // ==================================================
  // APPLY VALUES FROM DAY VIEW
  // ==================================================

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }

    if (
      initialDoctorId !== undefined &&
      initialDoctorId !== null
    ) {
      setSelectedDoctor(
        String(initialDoctorId)
      );
    }
  }, [
    initialDate,
    initialDoctorId,
  ]);

  // ==================================================
  // SELECTED DOCTOR
  // ==================================================

  const selectedDoctorData =
    doctors.find(
      (doctor) =>
        doctor.id === Number(selectedDoctor)
    );

  // ==================================================
  // CHECK REFERRAL
  // ==================================================

  useEffect(() => {
    if (
      !selectedDoctor ||
      !selectedDoctorData
    ) {
      setReferralStatus("idle");
      return;
    }

    // ----------------------------------------------
    // Referral not required
    // ----------------------------------------------

    if (
      !selectedDoctorData.requires_referral
    ) {
      setReferralStatus(
        "not_required"
      );

      return;
    }

    // ----------------------------------------------
    // Wait for patient information
    // ----------------------------------------------

    if (!patientProfile) {
      return;
    }

    // ----------------------------------------------
    // Check insurance
    // ----------------------------------------------

    const hasInsurance =
      Boolean(
        patientProfile.insurance_provider
      ) ||
      Boolean(
        patientProfile.insurance_member_id
      );

    // No insurance → direct booking
    if (!hasInsurance) {
      setReferralStatus(
        "direct_booking"
      );

      return;
    }

    // ----------------------------------------------
    // Patient has insurance
    // Check referral
    // ----------------------------------------------

    const fetchReferral = async () => {
      try {
        setLoadingReferral(true);
        setReferralStatus("checking");
        setError("");

        const token =
          localStorage.getItem(
            "access_token"
          );

        const response = await fetch(
          `${API_URL}/referrals/patient/${patientProfile.patient_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to check referral."
          );
        }

        const referrals: Referral[] =
          Array.isArray(data)
            ? data
            : data.referrals || [];

        // ------------------------------------------
        // Find referral for selected specialist
        // ------------------------------------------

        const specialistReferrals =
          referrals.filter(
            (referral) =>
              referral.specialist_doctor_id ===
              Number(selectedDoctor)
          );

        if (
          specialistReferrals.length === 0
        ) {
          setReferralStatus("missing");
          return;
        }

        // ------------------------------------------
        // Check valid referral for selected date
        // ------------------------------------------

        const validReferral =
          specialistReferrals.find(
            (referral) => {
              const issuedDate =
                referral.issued_date;

              const expiryDate =
                referral.expiry_date;

              const correctDate =
                issuedDate <=
                  selectedDate &&
                (!expiryDate ||
                  expiryDate >=
                    selectedDate);

              return (
                referral.status ===
                  "ACTIVE" &&
                correctDate
              );
            }
          );

        if (!validReferral) {
          setReferralStatus("invalid");
          return;
        }

        // ------------------------------------------
        // Check authorization
        // ------------------------------------------

        if (
          validReferral.authorization_required &&
          validReferral.authorization_status !==
            "APPROVED"
        ) {
          setReferralStatus(
            "authorization_required"
          );

          return;
        }

        // ------------------------------------------
        // Referral verified
        // ------------------------------------------

        setReferralStatus("valid");
      } catch (error) {
        console.error(
          "Error checking referral:",
          error
        );

        setReferralStatus("error");

        setError(
          error instanceof Error
            ? error.message
            : "Unable to check referral."
        );
      } finally {
        setLoadingReferral(false);
      }
    };

    fetchReferral();
  }, [
    selectedDoctor,
    selectedDoctorData,
    patientProfile,
    selectedDate,
  ]);

  // ==================================================
  // DOCTOR CHANGE
  // ==================================================

  const handleDoctorChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    setSelectedDoctor(
      event.target.value
    );

    setAvailability(null);
    setSelectedTime(null);
    setShowConfirmation(false);

    setReferralStatus("idle");

    setError("");
    setSuccess("");
  };

  // ==================================================
  // DATE CHANGE
  // ==================================================

  const handleDateChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setSelectedDate(
      event.target.value
    );

    setAvailability(null);
    setSelectedTime(null);
    setShowConfirmation(false);

    setReferralStatus("idle");

    setError("");
    setSuccess("");
  };

  // ==================================================
  // GET AVAILABILITY
  // ==================================================

  useEffect(() => {
    if (
      !selectedDoctor ||
      !selectedDate
    ) {
      return;
    }

    const fetchAvailability = async () => {
      try {
        setLoadingAvailability(true);

        setAvailability(null);
        setSelectedTime(null);
        setShowConfirmation(false);

        setError("");
        setSuccess("");

        const token =
          localStorage.getItem(
            "access_token"
          );

        const params =
          new URLSearchParams({
            doctor_id:
              selectedDoctor,

            appointment_date:
              selectedDate,
          });

        const response = await fetch(
          `${API_URL}/appointments/availability?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to load availability."
          );
        }

        setAvailability(data);

        // ------------------------------------------
        // Automatically select time from Day View
        // ------------------------------------------

        if (
          initialStartTime &&
          Array.isArray(data.slots)
        ) {
          const matchingSlot =
            data.slots.find(
              (slot: TimeSlot) =>
                slot.start_time ===
                  initialStartTime &&
                slot.status ===
                  "available"
            );

          if (matchingSlot) {
            setSelectedTime(
              matchingSlot
            );
          }
        }
      } catch (error) {
        console.error(
          "Error loading availability:",
          error
        );

        setAvailability(null);

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load availability."
        );
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [
    selectedDoctor,
    selectedDate,
    initialStartTime,
  ]);

  // ==================================================
  // SELECT TIME SLOT
  // ==================================================

  const handleTimeSelect = (
    slot: TimeSlot
  ) => {
    if (
      slot.status !== "available"
    ) {
      return;
    }

    setSelectedTime(slot);

    setShowConfirmation(false);

    setError("");
    setSuccess("");
  };

  // ==================================================
  // CHECK WHETHER BOOKING IS ALLOWED
  // ==================================================

  const canBookAppointment = () => {
    if (!selectedDoctorData) {
      return false;
    }

    // Doctor does not require referral
    if (
      !selectedDoctorData.requires_referral
    ) {
      return true;
    }

    // Patient profile still loading
    if (!patientProfile) {
      return false;
    }

    // Check insurance
    const hasInsurance =
      Boolean(
        patientProfile.insurance_provider
      ) ||
      Boolean(
        patientProfile.insurance_member_id
      );

    // No insurance → direct booking
    if (!hasInsurance) {
      return true;
    }

    // Insurance + referral required
    return (
      referralStatus === "valid"
    );
  };

  // ==================================================
  // OPEN CONFIRMATION
  // ==================================================

  const handleConfirmBooking = () => {
    if (
      !selectedDoctor ||
      !selectedDate ||
      !selectedTime
    ) {
      setError(
        "Please select doctor, date and time."
      );

      return;
    }

    if (
      loadingPatientProfile
    ) {
      setError(
        "Checking patient information. Please wait."
      );

      return;
    }

    if (
      loadingReferral
    ) {
      setError(
        "Checking referral information. Please wait."
      );

      return;
    }

    if (!canBookAppointment()) {
      if (
        referralStatus === "missing"
      ) {
        setError(
          "A referral is required before booking with this specialist."
        );
      } else if (
        referralStatus === "invalid"
      ) {
        setError(
          "No valid referral was found for this specialist."
        );
      } else if (
        referralStatus ===
        "authorization_required"
      ) {
        setError(
          "Prior authorization is required before booking this appointment."
        );
      } else {
        setError(
          "Referral verification is required before booking."
        );
      }

      return;
    }

    setError("");
    setSuccess("");

    setShowConfirmation(true);
  };

  // ==================================================
  // FINAL BOOKING
  // ==================================================

  const handleFinalBooking = async () => {
    if (
      !selectedDoctor ||
      !selectedDate ||
      !selectedTime
    ) {
      return;
    }

    // ----------------------------------------------
    // Frontend verification
    // ----------------------------------------------

    if (!canBookAppointment()) {
      setShowConfirmation(false);

      setError(
        "Referral verification is required before booking this appointment."
      );

      return;
    }

    try {
      setBooking(true);
      setError("");

      const token =
        localStorage.getItem(
          "access_token"
        );

      const response = await fetch(
        `${API_URL}/appointments`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            doctor_id: Number(
              selectedDoctor
            ),

            appointment_date:
              selectedDate,

            start_time:
              selectedTime.start_time,

            end_time:
              selectedTime.end_time,

            appointment_type:
              "IN_PERSON",
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to book appointment."
        );
      }

      // ------------------------------------------
      // Booking successful
      // ------------------------------------------

      setShowConfirmation(false);

      setSuccess(
        "Appointment booked successfully."
      );

      // ------------------------------------------
      // Refresh availability
      // ------------------------------------------

      const params =
        new URLSearchParams({
          doctor_id:
            selectedDoctor,

          appointment_date:
            selectedDate,
        });

      const availabilityResponse =
        await fetch(
          `${API_URL}/appointments/availability?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

      if (
        availabilityResponse.ok
      ) {
        const availabilityData =
          await availabilityResponse.json();

        setAvailability(
          availabilityData
        );
      }

      // Clear selected slot
      setSelectedTime(null);

      // Tell PatientDashboard to refresh
      if (onBookingSuccess) {
        onBookingSuccess();
      }
    } catch (error) {
      console.error(
        "Error booking appointment:",
        error
      );

      setShowConfirmation(false);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to book appointment."
      );
    } finally {
      setBooking(false);
    }
  };

  // ==================================================
  // SLOT DISPLAY STATUS
  // ==================================================

  const getSlotDisplayStatus = (
    slot: TimeSlot
  ) => {
    if (
      slot.status === "booked"
    ) {
      return "booked";
    }

    if (
      slot.status === "break"
    ) {
      return "break";
    }

    if (
      slot.status === "unavailable"
    ) {
      return "unavailable";
    }

    if (
      availability &&
      availability.available_slots <= 3
    ) {
      return "few";
    }

    return "available";
  };

  // ==================================================
  // REFERRAL STATUS MESSAGE
  // ==================================================

  const renderReferralStatus = () => {
    if (
      !selectedDoctorData ||
      !selectedDoctor
    ) {
      return null;
    }

    if (
      !selectedDoctorData.requires_referral
    ) {
      return (
        <div className="booking-message success">
          Referral is not required for this doctor. You can book directly.
        </div>
      );
    }

    if (
      loadingPatientProfile
    ) {
      return (
        <div className="booking-message">
          Checking patient information...
        </div>
      );
    }

    if (
      loadingReferral
    ) {
      return (
        <div className="booking-message">
          Checking referral information...
        </div>
      );
    }

    if (
      referralStatus ===
      "direct_booking"
    ) {
      return (
        <div className="booking-message success">
          No insurance information found. You can book directly.
        </div>
      );
    }

    if (
      referralStatus === "valid"
    ) {
      return (
        <div className="booking-message success">
          ✓ Referral verified. You can continue with the booking.
        </div>
      );
    }

    if (
      referralStatus === "missing"
    ) {
      return (
        <div className="booking-message error">
          A referral is required before booking with this specialist.
        </div>
      );
    }

    if (
      referralStatus === "invalid"
    ) {
      return (
        <div className="booking-message error">
          No valid referral was found for this specialist.
        </div>
      );
    }

    if (
      referralStatus ===
      "authorization_required"
    ) {
      return (
        <div className="booking-message error">
          Prior authorization is required and has not been approved yet.
        </div>
      );
    }

    if (
      referralStatus === "error"
    ) {
      return (
        <div className="booking-message error">
          Unable to verify the referral. Please try again.
        </div>
      );
    }

    return null;
  };

  return (
    <div className="appointment-booking">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="booking-header">

        <div>

          <p className="booking-label">
            BOOK APPOINTMENT
          </p>

          <h2>
            Find an available appointment
          </h2>

          <p>
            Select a doctor, date and
            available time slot for your
            appointment.
          </p>

        </div>

      </div>

      {/* =================================================
          DOCTOR + DATE
      ================================================= */}

      <div className="booking-selection">

        <div className="booking-field">

          <label>
            Select Doctor
          </label>

          <select
            value={selectedDoctor}
            onChange={
              handleDoctorChange
            }
          >

            <option value="">
              {loadingDoctors
                ? "Loading doctors..."
                : "Choose a doctor"}
            </option>

            {doctors.map(
              (doctor) => (

                <option
                  key={doctor.id}
                  value={doctor.id}
                >

                  {doctor.name}

                  {doctor.specialization
                    ? ` - ${doctor.specialization}`
                    : ""}

                  {doctor.requires_referral
                    ? " (Referral Required)"
                    : ""}

                </option>

              )
            )}

          </select>

        </div>

        <div className="booking-field">

          <label>
            Select Date
          </label>

          <input
            type="date"
            value={selectedDate}
            onChange={
              handleDateChange
            }
            min={
              new Date()
                .toISOString()
                .split("T")[0]
            }
          />

        </div>

      </div>

      {/* =================================================
          REFERRAL VERIFICATION
      ================================================= */}

      {renderReferralStatus()}

      {/* =================================================
          MESSAGES
      ================================================= */}

      {error && (
        <div className="booking-message error">
          {error}
        </div>
      )}

      {success && (
        <div className="booking-message success">
          {success}
        </div>
      )}

      {/* =================================================
          AVAILABILITY
      ================================================= */}

      {selectedDoctor &&
        selectedDate && (

          <div className="availability-section">

            {loadingAvailability ? (

              <div className="availability-loading">
                Checking doctor
                availability...
              </div>

            ) : availability ? (

              <>

                {/* ===============================
                    AVAILABILITY HEADER
                =============================== */}

                <div className="availability-header">

                  <div>

                    <h3>
                      Doctor Availability
                    </h3>

                    <p>

                      {
                        availability.doctor_name
                      }

                      {" · "}

                      {
                        availability.date
                      }

                    </p>

                  </div>

                  <div className="availability-status">

                    <span>
                      🟢 Available
                    </span>

                    <span>
                      🟡 Few Slots
                    </span>

                    <span>
                      🔴 Fully Booked
                    </span>

                  </div>

                </div>

                {/* ===============================
                    SUMMARY
                =============================== */}

                <div className="availability-summary">

                  <div>

                    <strong>
                      {
                        availability.total_slots
                      }
                    </strong>

                    <span>
                      Total Slots
                    </span>

                  </div>

                  <div>

                    <strong>
                      {
                        availability.booked_slots
                      }
                    </strong>

                    <span>
                      Booked
                    </span>

                  </div>

                  <div>

                    <strong>
                      {
                        availability.available_slots
                      }
                    </strong>

                    <span>
                      Available
                    </span>

                  </div>

                </div>

                {/* ===============================
                    TIME SLOTS
                =============================== */}

                <div className="time-slots">

                  {availability.slots.map(
                    (slot) => {

                      const displayStatus =
                        getSlotDisplayStatus(
                          slot
                        );

                      return (

                        <button
                          key={`${slot.start_time}-${slot.end_time}`}
                          type="button"
                          disabled={
                            slot.status !==
                            "available"
                          }
                          className={`time-slot ${displayStatus} ${
                            selectedTime?.start_time ===
                            slot.start_time
                              ? "selected"
                              : ""
                          }`}
                          onClick={() =>
                            handleTimeSelect(
                              slot
                            )
                          }
                        >

                          <span>
                            {slot.start_time}
                          </span>

                          <small>

                            {slot.status ===
                            "booked"
                              ? "Booked"
                              : slot.status ===
                                "break"
                              ? "Break"
                              : slot.status ===
                                "unavailable"
                              ? "Unavailable"
                              : displayStatus ===
                                "few"
                              ? "Few slots left"
                              : "Available"}

                          </small>

                        </button>

                      );
                    }
                  )}

                </div>

                {/* ===============================
                    NO AVAILABILITY
                =============================== */}

                {!availability.available && (

                  <div className="no-availability">

                    {
                      availability.message ||
                      "No appointments available on this date."
                    }

                  </div>

                )}

              </>

            ) : null}

          </div>

        )}

      {/* =================================================
          SELECTED APPOINTMENT
      ================================================= */}

      {selectedTime &&
        availability && (

          <div className="selected-appointment">

            <div>

              <span>
                Selected Appointment
              </span>

              <strong>
                {
                  availability.doctor_name
                }
              </strong>

              <p>

                {selectedDate}

                {" · "}

                {
                  selectedTime.start_time
                }

                {" - "}

                {
                  selectedTime.end_time
                }

              </p>

            </div>

            <button
              type="button"
              className="confirm-booking-button"
              onClick={
                handleConfirmBooking
              }
              disabled={
                booking ||
                loadingPatientProfile ||
                loadingReferral
              }
            >
              Confirm Appointment
            </button>

          </div>

        )}

      {/* =================================================
          CONFIRMATION MODAL
      ================================================= */}

      {showConfirmation &&
        selectedTime &&
        availability && (

          <div className="confirmation-overlay">

            <div
              className="confirmation-card"
              role="dialog"
              aria-modal="true"
            >

              <button
                type="button"
                className="confirmation-close"
                onClick={() =>
                  setShowConfirmation(
                    false
                  )
                }
                disabled={booking}
                aria-label="Close confirmation"
              >
                ×
              </button>

              <div className="confirmation-icon">
                ✓
              </div>

              <p className="confirmation-label">
                CONFIRM APPOINTMENT
              </p>

              <h3>
                Review your appointment
              </h3>

              <p className="confirmation-subtitle">
                Please check the details
                before booking your
                appointment.
              </p>

              <div className="confirmation-details">

                <div>

                  <span>
                    Doctor
                  </span>

                  <strong>
                    {
                      availability.doctor_name
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    Date
                  </span>

                  <strong>
                    {selectedDate}
                  </strong>

                </div>

                <div>

                  <span>
                    Time
                  </span>

                  <strong>

                    {
                      selectedTime.start_time
                    }

                    {" - "}

                    {
                      selectedTime.end_time
                    }

                  </strong>

                </div>

                <div>

                  <span>
                    Appointment Type
                  </span>

                  <strong>
                    In Person
                  </strong>

                </div>

                {/* ======================================
                    REFERRAL INFORMATION
                ====================================== */}

                {selectedDoctorData?.requires_referral && (
                  <div>

                    <span>
                      Referral
                    </span>

                    <strong>
                      {referralStatus ===
                      "valid"
                        ? "✓ Verified"
                        : referralStatus ===
                          "direct_booking"
                        ? "Not Required"
                        : "Required"}
                    </strong>

                  </div>
                )}

              </div>

              <div className="confirmation-actions">

                <button
                  type="button"
                  className="confirmation-cancel"
                  onClick={() =>
                    setShowConfirmation(
                      false
                    )
                  }
                  disabled={booking}
                >
                  Go Back
                </button>

                <button
                  type="button"
                  className="confirmation-submit"
                  onClick={
                    handleFinalBooking
                  }
                  disabled={
                    booking ||
                    !canBookAppointment()
                  }
                >
                  {booking
                    ? "Booking..."
                    : "Confirm & Book"}
                </button>

              </div>

            </div>

          </div>

        )}

    </div>
  );
}

export default AppointmentBooking;