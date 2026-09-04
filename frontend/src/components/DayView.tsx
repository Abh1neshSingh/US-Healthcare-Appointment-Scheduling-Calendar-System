import {
  useEffect,
  useMemo,
  useState,
} from "react";

import API_URL from "../config";

import "./DayView.css";

export interface DayViewAppointment {
  id: number;
  doctor_id: number;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  appointment_type: string;
  reason?: string | null;
  notes?: string | null;
}

interface Doctor {
  id: number;
  name: string;
  specialization: string;
  requires_referral?: boolean;
}

interface PatientProfile {
  id: number;
  patient_id: number;
  name: string;
  email: string;
  date_of_birth?: string | null;
  phone?: string | null;
  insurance_provider?: string | null;
  insurance_member_id?: string | null;
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

interface DayViewAppointmentProps {
  selectedDate: string;
  appointments: DayViewAppointment[];
  loading: boolean;

  onDateChange: (
    date: string
  ) => void;

  onBook: (
    date: string,
    doctorId?: number,
    startTime?: string
  ) => void;

  onAppointmentClick: (
    appointment: DayViewAppointment
  ) => void;

  formatTime: (
    time: string
  ) => string;

  onClose: () => void;
}

// ==================================================
// TODAY DATE
// ==================================================

function getTodayDate(): string {
  const today = new Date();

  const year =
    today.getFullYear();

  const month = String(
    today.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    today.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ==================================================
// DATE DISPLAY
// ==================================================

function formatDateForDisplay(
  date: string
): string {
  const dateObject = new Date(
    `${date}T00:00:00`
  );

  return dateObject.toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );
}

// ==================================================
// DOB DISPLAY
// ==================================================

function formatDateOfBirth(
  date?: string | null
): string {
  if (!date) {
    return "Not available";
  }

  const dateObject = new Date(
    `${date}T00:00:00`
  );

  return dateObject.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

// ==================================================
// DAY VIEW
// ==================================================

function DayView({
  selectedDate,
  appointments,
  loading,
  onDateChange,
  onBook,
  onAppointmentClick,
  formatTime,
  onClose,
}: DayViewAppointmentProps) {

  // ==================================================
  // DAY DATE
  // ==================================================

  const todayDate =
    getTodayDate();

  /*
   * Day View is intentionally fixed
   * to the current date.
   *
   * Month and Week views handle
   * date navigation.
   */
  const dayDate =
    todayDate;

  // ==================================================
  // STATE
  // ==================================================

  const [doctors, setDoctors] =
    useState<Doctor[]>([]);

  const [
    selectedDoctorId,
    setSelectedDoctorId,
  ] = useState<number | null>(
    null
  );

  const [
    availability,
    setAvailability,
  ] =
    useState<AvailabilityResponse | null>(
      null
    );

  const [
    selectedSlot,
    setSelectedSlot,
  ] =
    useState<TimeSlot | null>(
      null
    );

  const [
    patientProfile,
    setPatientProfile,
  ] =
    useState<PatientProfile | null>(
      null
    );

  const [
    loadingDoctors,
    setLoadingDoctors,
  ] = useState(false);

  const [
    loadingPatient,
    setLoadingPatient,
  ] = useState(false);

  const [
    loadingAvailability,
    setLoadingAvailability,
  ] = useState(false);

  const [
    doctorsError,
    setDoctorsError,
  ] = useState("");

  const [
    availabilityError,
    setAvailabilityError,
  ] = useState("");

  // ==================================================
  // LOAD PATIENT
  // ==================================================

  useEffect(() => {
    const fetchPatient =
      async () => {
        try {
          setLoadingPatient(true);

          const token =
            localStorage.getItem(
              "access_token"
            );

          const response =
            await fetch(
              `${API_URL}/users/me`,
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
                "Unable to load patient information."
            );
          }

          setPatientProfile(
            data
          );
        } catch (error) {
          console.error(
            "Error loading patient profile:",
            error
          );
        } finally {
          setLoadingPatient(
            false
          );
        }
      };

    fetchPatient();
  }, []);

  // ==================================================
  // LOAD DOCTORS
  // ==================================================

  useEffect(() => {
    const fetchDoctors =
      async () => {
        try {
          setLoadingDoctors(
            true
          );

          setDoctorsError("");

          const token =
            localStorage.getItem(
              "access_token"
            );

          const response =
            await fetch(
              `${API_URL}/users/doctors`,
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
                "Unable to load doctors."
            );
          }

          const doctorList: Doctor[] =
            Array.isArray(data)
              ? data
              : data.doctors || [];

          setDoctors(
            doctorList
          );

          if (
            doctorList.length >
            0
          ) {
            setSelectedDoctorId(
              doctorList[0].id
            );
          }
        } catch (error) {
          console.error(
            "Error loading doctors:",
            error
          );

          setDoctorsError(
            error instanceof Error
              ? error.message
              : "Unable to load doctors."
          );
        } finally {
          setLoadingDoctors(
            false
          );
        }
      };

    fetchDoctors();
  }, []);

  // ==================================================
  // LOAD SELECTED DOCTOR AVAILABILITY
  // ==================================================

  useEffect(() => {
    if (
      selectedDoctorId ===
        null ||
      !dayDate
    ) {
      return;
    }

    let cancelled =
      false;

    const fetchAvailability =
      async () => {
        try {
          setLoadingAvailability(
            true
          );

          setAvailabilityError(
            ""
          );

          setSelectedSlot(
            null
          );

          const token =
            localStorage.getItem(
              "access_token"
            );

          const params =
            new URLSearchParams({
              doctor_id:
                String(
                  selectedDoctorId
                ),
              appointment_date:
                dayDate,
            });

          const response =
            await fetch(
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

          if (!cancelled) {
            setAvailability(
              data
            );
          }
        } catch (error) {
          console.error(
            "Error loading doctor availability:",
            error
          );

          if (!cancelled) {
            setAvailability(
              null
            );

            setAvailabilityError(
              error instanceof Error
                ? error.message
                : "Unable to load availability."
            );
          }
        } finally {
          if (!cancelled) {
            setLoadingAvailability(
              false
            );
          }
        }
      };

    fetchAvailability();

    return () => {
      cancelled = true;
    };
  }, [
    selectedDoctorId,
    dayDate,
  ]);

  // ==================================================
  // SELECTED DOCTOR
  // ==================================================

  const selectedDoctor =
    useMemo(() => {
      if (
        selectedDoctorId ===
        null
      ) {
        return null;
      }

      return (
        doctors.find(
          (doctor) =>
            doctor.id ===
            selectedDoctorId
        ) || null
      );
    }, [
      doctors,
      selectedDoctorId,
    ]);

  // ==================================================
  // PATIENT APPOINTMENTS TODAY
  // ==================================================

  const patientAppointments =
    useMemo(() => {
      return appointments.filter(
        (appointment) =>
          appointment.appointment_date ===
          dayDate
      );
    }, [
      appointments,
      dayDate,
    ]);

  // ==================================================
  // APPOINTMENT LOOKUP
  // ==================================================

  const getAppointmentForSlot =
    (
      doctorId: number,
      startTime: string
    ) => {
      return patientAppointments.find(
        (appointment) =>
          appointment.doctor_id ===
            doctorId &&
          appointment.start_time ===
            startTime
      );
    };

  // ==================================================
  // SUMMARY
  // ==================================================

  const summary = useMemo(() => {
    if (!availability) {
      return {
        available: 0,
        booked: 0,
        total: 0,
      };
    }

    return {
      available:
        availability.available_slots,

      booked:
        availability.booked_slots,

      total:
        availability.total_slots,
    };
  }, [availability]);

  // ==================================================
  // DOCTOR CHANGE
  // ==================================================

  const handleDoctorChange =
    (
      doctorId: number
    ) => {
      setSelectedDoctorId(
        doctorId
      );

      setSelectedSlot(
        null
      );

      setAvailability(
        null
      );

      setAvailabilityError(
        ""
      );
    };

  // ==================================================
  // SLOT CLICK
  // ==================================================

  const handleSlotClick =
    (
      slot: TimeSlot
    ) => {
      if (
        slot.status !==
        "available"
      ) {
        return;
      }

      setSelectedSlot(
        slot
      );
    };

  // ==================================================
  // BOOK SELECTED SLOT
  // ==================================================

  const handleBook = () => {
    if (
      !selectedDoctorId ||
      !selectedSlot
    ) {
      return;
    }

    onBook(
      dayDate,
      selectedDoctorId,
      selectedSlot.start_time
    );
  };

  // ==================================================
  // KEEP PARENT DATE IN SYNC
  // ==================================================

  useEffect(() => {
    if (
      selectedDate !==
      dayDate
    ) {
      onDateChange(
        dayDate
      );
    }
  }, [
    selectedDate,
    dayDate,
    onDateChange,
  ]);

  // ==================================================
  // ESCAPE KEY
  // ==================================================

  useEffect(() => {
    const handleKeyDown =
      (
        event: KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          onClose();
        }
      };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [onClose]);

  // ==================================================
  // LOADING
  // ==================================================

  if (
    loading ||
    loadingDoctors ||
    loadingPatient
  ) {
    return (
      <div className="day-booking-overlay">

        <div
          className="day-booking-modal day-booking-loading-modal"
          role="dialog"
          aria-modal="true"
        >

          <button
            type="button"
            className="day-booking-close"
            onClick={onClose}
            aria-label="Close day view"
          >
            ×
          </button>

          <div className="day-view-loading">

            <div className="day-view-spinner" />

            <h3>
              Loading today's
              appointments
            </h3>

            <p>
              Checking patient,
              doctors and available
              appointment times...
            </p>

          </div>

        </div>

      </div>
    );
  }

  // ==================================================
  // DOCTOR ERROR
  // ==================================================

  if (doctorsError) {
    return (
      <div className="day-booking-overlay">

        <div
          className="day-booking-modal"
          role="dialog"
          aria-modal="true"
        >

          <div className="day-booking-header">

            <div>

              <span className="day-booking-eyebrow">
                TODAY
              </span>

              <h2>
                {formatDateForDisplay(
                  dayDate
                )}
              </h2>

            </div>

            <button
              type="button"
              className="day-booking-close"
              onClick={onClose}
              aria-label="Close day view"
            >
              ×
            </button>

          </div>

          <div className="day-view-error">

            <div className="day-view-error-icon">
              !
            </div>

            <h3>
              Unable to load doctors
            </h3>

            <p>
              {doctorsError}
            </p>

          </div>

        </div>

      </div>
    );
  }

  // ==================================================
  // MAIN VIEW
  // ==================================================

  return (
    <div
      className="day-booking-overlay"
      role="presentation"
    >

      {/* ==================================================
          MODAL
      ================================================== */}

      <div
        className="day-booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-booking-title"
      >

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="day-booking-header">

          <div className="day-booking-header-left">

            <div className="day-booking-date-icon">
              ◷
            </div>

            <div>

              <span className="day-booking-eyebrow">
                TODAY'S APPOINTMENTS
              </span>

              <h2 id="day-booking-title">
                {formatDateForDisplay(
                  dayDate
                )}
              </h2>

              <p>
                View availability
                and book an
                appointment for
                today.
              </p>

            </div>

          </div>

          <button
            type="button"
            className="day-booking-close"
            onClick={onClose}
            aria-label="Close day view"
          >
            ×
          </button>

        </div>

        {/* ==================================================
            PATIENT
        ================================================== */}

        <section className="day-patient-section">

          <div className="day-section-heading">

            <span>
              PATIENT
            </span>

            <small>
              Your appointment
              information
            </small>

          </div>

          <div className="day-patient-card">

            <div className="day-patient-avatar">

              {patientProfile?.name
                ? patientProfile.name
                    .split(" ")
                    .map(
                      (part) =>
                        part[0]
                    )
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : "PT"}

            </div>

            <div className="day-patient-main">

              <strong>
                {patientProfile?.name ||
                  "Patient"}
              </strong>

              <span>
                {patientProfile?.email ||
                  "Email not available"}
              </span>

            </div>

            <div className="day-patient-info">

              <div>

                <span>
                  DOB
                </span>

                <strong>
                  {formatDateOfBirth(
                    patientProfile?.date_of_birth
                  )}
                </strong>

              </div>

              <div>

                <span>
                  Phone
                </span>

                <strong>
                  {patientProfile?.phone ||
                    "Not available"}
                </strong>

              </div>

              <div>

                <span>
                  Insurance
                </span>

                <strong>
                  {patientProfile?.insurance_provider ||
                    "Self Pay"}
                </strong>

              </div>

            </div>

          </div>

        </section>

        {/* ==================================================
            DOCTOR SELECT
        ================================================== */}

        <section className="day-doctor-section">

          <div className="day-section-heading">

            <span>
              SELECT DOCTOR
            </span>

            <small>
              Choose a doctor to
              see today's available
              times
            </small>

          </div>

          <div className="day-doctor-select-wrapper">

            <div className="day-doctor-select-icon">
              +
            </div>

            <select
              className="day-doctor-select"
              value={
                selectedDoctorId ??
                ""
              }
              onChange={(
                event
              ) =>
                handleDoctorChange(
                  Number(
                    event.target.value
                  )
                )
              }
            >

              <option value="">
                Choose a doctor
              </option>

              {doctors.map(
                (doctor) => (
                  <option
                    key={doctor.id}
                    value={doctor.id}
                  >
                    {doctor.name}

                    {doctor.specialization
                      ? ` — ${doctor.specialization}`
                      : ""}

                    {doctor.requires_referral
                      ? " — Referral Required"
                      : ""}
                  </option>
                )
              )}

            </select>

          </div>

        </section>

        {/* ==================================================
            SELECTED DOCTOR
        ================================================== */}

        {selectedDoctor && (
          <div className="day-selected-doctor">

            <div className="day-selected-doctor-avatar">

              {selectedDoctor.name
                .split(" ")
                .map(
                  (part) =>
                    part[0]
                )
                .slice(0, 2)
                .join("")
                .toUpperCase()}

            </div>

            <div className="day-selected-doctor-info">

              <span>
                SELECTED DOCTOR
              </span>

              <strong>
                {selectedDoctor.name}
              </strong>

              <small>
                {selectedDoctor.specialization ||
                  "General Practice"}
              </small>

            </div>

            <div className="day-selected-doctor-stats">

              <div>

                <strong>
                  {summary.available}
                </strong>

                <span>
                  Available
                </span>

              </div>

              <div>

                <strong>
                  {summary.booked}
                </strong>

                <span>
                  Booked
                </span>

              </div>

            </div>

          </div>
        )}

        {/* ==================================================
            SLOTS
        ================================================== */}

        <section className="day-slots-section">

          <div className="day-slots-heading">

            <div>

              <span>
                TODAY'S APPOINTMENT
                SLOTS
              </span>

              <h3>
                Choose an available
                time
              </h3>

            </div>

            <div className="day-slot-legend">

              <span>
                <i className="day-legend-dot available" />
                Available
              </span>

              <span>
                <i className="day-legend-dot booked" />
                Booked
              </span>

              <span>
                <i className="day-legend-dot break" />
                Break
              </span>

            </div>

          </div>

          {loadingAvailability ? (

            <div className="day-slots-loading">

              <div className="day-view-spinner" />

              <span>
                Checking available
                times...
              </span>

            </div>

          ) : availabilityError ? (

            <div className="day-slots-error">

              <strong>
                Unable to load
                availability
              </strong>

              <span>
                {availabilityError}
              </span>

            </div>

          ) : !availability ? (

            <div className="day-slots-empty">

              <strong>
                Select a doctor
              </strong>

              <span>
                Choose a doctor
                above to see
                today's appointment
                times.
              </span>

            </div>

          ) : availability.slots
              .length === 0 ? (

            <div className="day-slots-empty">

              <strong>
                No appointment
                slots
              </strong>

              <span>
                This doctor has no
                scheduled
                appointments
                available today.
              </span>

            </div>

          ) : (

            <div className="day-slot-grid">

              {availability.slots.map(
                (slot) => {

                  const appointment =
                    getAppointmentForSlot(
                      selectedDoctorId!,
                      slot.start_time
                    );

                  const isSelected =
                    selectedSlot?.start_time ===
                      slot.start_time &&
                    selectedSlot?.end_time ===
                      slot.end_time;

                  return (
                    <button
                      key={`${selectedDoctorId}-${slot.start_time}-${slot.end_time}`}
                      type="button"
                      className={`day-time-slot ${slot.status} ${
                        isSelected
                          ? "selected"
                          : ""
                      }`}
                      disabled={
                        slot.status !==
                        "available"
                      }
                      onClick={() =>
                        handleSlotClick(
                          slot
                        )
                      }
                    >

                      <span className="day-time-slot-time">
                        {formatTime(
                          slot.start_time
                        )}
                      </span>

                      <span className="day-time-slot-end">
                        {formatTime(
                          slot.end_time
                        )}
                      </span>

                      <span className="day-time-slot-status">

                        {slot.status ===
                          "available" && (
                          <>
                            {isSelected
                              ? "✓ Selected"
                              : "Available"}
                          </>
                        )}

                        {slot.status ===
                          "booked" && (
                          <>
                            {appointment
                              ? "Your appointment"
                              : "Booked"}
                          </>
                        )}

                        {slot.status ===
                          "break" &&
                          "Break"}

                        {slot.status ===
                          "unavailable" &&
                          "Unavailable"}

                      </span>

                    </button>
                  );
                }
              )}

            </div>

          )}

        </section>

        {/* ==================================================
            SELECTED SLOT
        ================================================== */}

        {selectedSlot && (
          <div className="day-selected-slot">

            <div className="day-selected-slot-icon">
              ✓
            </div>

            <div className="day-selected-slot-info">

              <span>
                SELECTED APPOINTMENT
              </span>

              <strong>
                {selectedDoctor?.name}
              </strong>

              <small>
                {formatDateForDisplay(
                  dayDate
                )}

                {" · "}

                {formatTime(
                  selectedSlot.start_time
                )}

                {" - "}

                {formatTime(
                  selectedSlot.end_time
                )}
              </small>

            </div>

            <button
              type="button"
              className="day-book-button"
              onClick={
                handleBook
              }
            >
              Book Appointment
            </button>

          </div>
        )}

        {/* ==================================================
            EXISTING APPOINTMENTS
        ================================================== */}

        {patientAppointments.length >
          0 && (

          <section className="day-existing-appointments">

            <div className="day-section-heading">

              <span>
                YOUR APPOINTMENTS TODAY
              </span>

              <small>
                Already scheduled
                appointments
              </small>

            </div>

            <div className="day-existing-list">

              {patientAppointments.map(
                (appointment) => (
                  <button
                    key={
                      appointment.id
                    }
                    type="button"
                    className="day-existing-card"
                    onClick={() =>
                      onAppointmentClick(
                        appointment
                      )
                    }
                  >

                    <div className="day-existing-time">

                      <strong>
                        {formatTime(
                          appointment.start_time
                        )}
                      </strong>

                      <span>
                        {formatTime(
                          appointment.end_time
                        )}
                      </span>

                    </div>

                    <div className="day-existing-details">

                      <strong>
                        {
                          appointment.doctor_name
                        }
                      </strong>

                      <span>
                        {
                          appointment.appointment_type
                        }
                      </span>

                    </div>

                    <span className="day-existing-status">
                      {
                        appointment.status
                      }
                    </span>

                    <span className="day-existing-arrow">
                      →
                    </span>

                  </button>
                )
              )}

            </div>

          </section>

        )}

      </div>

    </div>
  );
}

export default DayView;