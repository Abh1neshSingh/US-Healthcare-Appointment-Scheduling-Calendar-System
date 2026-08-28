import { useEffect, useState } from "react";
import "./AppointmentBooking.css";

interface Doctor {
  id: number;
  name: string;
  specialization: string;
}

interface TimeSlot {
  start_time: string;
  end_time: string;
  status: "available" | "booked";
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

interface AppointmentBookingProps {
  onBookingSuccess?: () => void;
}

function AppointmentBooking({
  onBookingSuccess,
}: AppointmentBookingProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);
  const [availability, setAvailability] =
    useState<AvailabilityResponse | null>(null);

  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [booking, setBooking] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --------------------------------------------------
  // Get doctors
  // --------------------------------------------------
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoadingDoctors(true);
        setError("");

        const token = localStorage.getItem("access_token");

        const response = await fetch(
          "https://ushcs.onrender.com/users/doctors",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Unable to load doctors."
          );
        }

        setDoctors(
          Array.isArray(data)
            ? data
            : data.doctors || []
        );
      } catch (error) {
        console.error(error);

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

  // --------------------------------------------------
  // Doctor change
  // --------------------------------------------------
  const handleDoctorChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setSelectedDoctor(event.target.value);
    setAvailability(null);
    setSelectedTime(null);
    setShowConfirmation(false);
    setError("");
    setSuccess("");
  };

  // --------------------------------------------------
  // Date change
  // --------------------------------------------------
  const handleDateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSelectedDate(event.target.value);
    setAvailability(null);
    setSelectedTime(null);
    setShowConfirmation(false);
    setError("");
    setSuccess("");
  };

  // --------------------------------------------------
  // Get availability
  // --------------------------------------------------
  useEffect(() => {
    if (!selectedDoctor || !selectedDate) {
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

        const token = localStorage.getItem("access_token");

        const params = new URLSearchParams({
          doctor_id: selectedDoctor,
          appointment_date: selectedDate,
        });

        const response = await fetch(
          `https://ushcs.onrender.com/appointments/availability?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Unable to load availability."
          );
        }

        setAvailability(data);
      } catch (error) {
        console.error(error);

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
  }, [selectedDoctor, selectedDate]);

  // --------------------------------------------------
  // Select time slot
  // --------------------------------------------------
  const handleTimeSelect = (slot: TimeSlot) => {
    if (slot.status === "booked") {
      return;
    }

    setSelectedTime(slot);
    setShowConfirmation(false);
    setError("");
    setSuccess("");
  };

  // --------------------------------------------------
  // Open confirmation screen
  // --------------------------------------------------
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

    setError("");
    setSuccess("");
    setShowConfirmation(true);
  };

  // --------------------------------------------------
  // Final booking
  // --------------------------------------------------
  const handleFinalBooking = async () => {
    if (
      !selectedDoctor ||
      !selectedDate ||
      !selectedTime
    ) {
      return;
    }

    try {
      setBooking(true);
      setError("");

      const token = localStorage.getItem("access_token");

      const response = await fetch(
        "https://ushcs.onrender.com/appointments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            doctor_id: Number(selectedDoctor),
            appointment_date: selectedDate,
            start_time: selectedTime.start_time,
            end_time: selectedTime.end_time,
            appointment_type: "IN_PERSON",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to book appointment."
        );
      }

      // Booking successful
      setShowConfirmation(false);
      setSuccess(
        "Appointment booked successfully."
      );

      // Refresh availability so the booked slot
      // immediately becomes unavailable.
      const params = new URLSearchParams({
        doctor_id: selectedDoctor,
        appointment_date: selectedDate,
      });

      const availabilityResponse = await fetch(
        `https://ushcs.onrender.com/appointments/availability?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (availabilityResponse.ok) {
        const availabilityData =
          await availabilityResponse.json();

        setAvailability(availabilityData);
      }

      // Clear selected slot
      setSelectedTime(null);

      // Tell PatientDashboard to refresh appointments
      if (onBookingSuccess) {
        onBookingSuccess();
      }
    } catch (error) {
      console.error(error);

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

  // --------------------------------------------------
  // Slot display status
  // --------------------------------------------------
  const getSlotDisplayStatus = (
    slot: TimeSlot
  ) => {
    if (slot.status === "booked") {
      return "booked";
    }

    if (
      availability &&
      availability.available_slots <= 3
    ) {
      return "few";
    }

    return "available";
  };

  return (
    <div className="appointment-booking">

      {/* Header */}
      <div className="booking-header">
        <div>
          <p className="booking-label">
            BOOK APPOINTMENT
          </p>

          <h2>
            Find an available appointment
          </h2>

          <p>
            Select a doctor, date and available time
            slot for your appointment.
          </p>
        </div>
      </div>

      {/* Doctor + Date */}
      <div className="booking-selection">

        <div className="booking-field">
          <label>Select Doctor</label>

          <select
            value={selectedDoctor}
            onChange={handleDoctorChange}
          >
            <option value="">
              {loadingDoctors
                ? "Loading doctors..."
                : "Choose a doctor"}
            </option>

            {doctors.map((doctor) => (
              <option
                key={doctor.id}
                value={doctor.id}
              >
                {doctor.name}

                {doctor.specialization
                  ? ` - ${doctor.specialization}`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="booking-field">
          <label>Select Date</label>

          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            min={
              new Date()
                .toISOString()
                .split("T")[0]
            }
          />
        </div>

      </div>

      {/* Messages */}
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

      {/* Availability */}
      {selectedDoctor && selectedDate && (
        <div className="availability-section">

          {loadingAvailability ? (
            <div className="availability-loading">
              Checking doctor availability...
            </div>
          ) : availability ? (
            <>

              {/* Availability header */}
              <div className="availability-header">

                <div>
                  <h3>
                    Doctor Availability
                  </h3>

                  <p>
                    {availability.doctor_name}
                    {" · "}
                    {availability.date}
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

              {/* Summary */}
              <div className="availability-summary">

                <div>
                  <strong>
                    {availability.total_slots}
                  </strong>

                  <span>
                    Total Slots
                  </span>
                </div>

                <div>
                  <strong>
                    {availability.booked_slots}
                  </strong>

                  <span>
                    Booked
                  </span>
                </div>

                <div>
                  <strong>
                    {availability.available_slots}
                  </strong>

                  <span>
                    Available
                  </span>
                </div>

              </div>

              {/* Time slots */}
              <div className="time-slots">

                {availability.slots.map(
                  (slot) => {

                    const displayStatus =
                      getSlotDisplayStatus(slot);

                    return (
                      <button
                        key={`${slot.start_time}-${slot.end_time}`}
                        type="button"
                        disabled={
                          slot.status === "booked"
                        }
                        className={`time-slot ${displayStatus} ${
                          selectedTime?.start_time ===
                          slot.start_time
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          handleTimeSelect(slot)
                        }
                      >

                        <span>
                          {slot.start_time}
                        </span>

                        <small>
                          {slot.status ===
                          "booked"
                            ? "Fully booked"
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

              {/* No availability */}
              {!availability.available && (
                <div className="no-availability">
                  {availability.message ||
                    "No appointments available on this date."}
                </div>
              )}

            </>
          ) : null}

        </div>
      )}

      {/* Selected appointment */}
      {selectedTime && availability && (
        <div className="selected-appointment">

          <div>
            <span>
              Selected Appointment
            </span>

            <strong>
              {availability.doctor_name}
            </strong>

            <p>
              {selectedDate}
              {" · "}
              {selectedTime.start_time}
              {" - "}
              {selectedTime.end_time}
            </p>
          </div>

          <button
            type="button"
            className="confirm-booking-button"
            onClick={handleConfirmBooking}
            disabled={booking}
          >
            Confirm Appointment
          </button>

        </div>
      )}

      {/* Confirmation Modal */}
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
                  setShowConfirmation(false)
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
                Please check the details before
                booking your appointment.
              </p>

              <div className="confirmation-details">

                <div>
                  <span>Doctor</span>
                  <strong>
                    {availability.doctor_name}
                  </strong>
                </div>

                <div>
                  <span>Date</span>
                  <strong>
                    {selectedDate}
                  </strong>
                </div>

                <div>
                  <span>Time</span>
                  <strong>
                    {selectedTime.start_time}
                    {" - "}
                    {selectedTime.end_time}
                  </strong>
                </div>

                <div>
                  <span>Appointment Type</span>
                  <strong>
                    In Person
                  </strong>
                </div>

              </div>

              <div className="confirmation-actions">

                <button
                  type="button"
                  className="confirmation-cancel"
                  onClick={() =>
                    setShowConfirmation(false)
                  }
                  disabled={booking}
                >
                  Go Back
                </button>

                <button
                  type="button"
                  className="confirmation-submit"
                  onClick={handleFinalBooking}
                  disabled={booking}
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