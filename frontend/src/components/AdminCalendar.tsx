import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import API_URL from "../config";
import "./AdminCalendar.css";

type CalendarView = "month" | "week" | "day";

interface CalendarDoctor {
  id: number;
  name: string;
  specialization?: string | null;
  department?: string | null;
  profile_photo?: string | null;
  requires_referral?: boolean;
  timezone?: string | null;
}

interface CalendarSlot {
  start_time: string;
  end_time: string;
  status:
    | "available"
    | "booked"
    | "break"
    | "not_available";
}

interface CalendarDay {
  date: string;
  day: string;
  available_slots: number;
  booked_slots: number;
  break_slots: number;
  not_available_slots: number;
  doctors: Record<
    string,
    Record<string, CalendarSlot>
  >;
}

interface PublicCalendarResponse {
  start_date: string;
  end_date: string;
  doctors: CalendarDoctor[];
  days: Record<string, CalendarDay>;
  time_slots: string[];
  server_time?: string;
}

interface StaffAppointment {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_email?: string | null;
  doctor_id: number;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  status_label?: string | null;
  appointment_type?: string | null;
  reason?: string | null;
  notes?: string | null;
}

interface Patient {
  id: number;
  user_id?: number;
  name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  insurance_provider?: string | null;
  insurance_member_id?: string | null;
}

interface AdminCalendarProps {
  onBookingSuccess?: () => void;
}

interface SelectedSlot {
  doctorId: number;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
}

const ACTIVE_STATUSES = new Set([
  "SCHEDULED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
]);

const getLocalDateString = (
  date: Date = new Date(),
): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value: string): Date =>
  new Date(`${value}T00:00:00`);

const formatDateString = (date: Date): string =>
  getLocalDateString(date);

const getCalendarRange = (value: string) => {
  const selectedDate = parseLocalDate(value);

  const firstDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1,
  );

  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 41);

  return {
    startDate: formatDateString(start),
    endDate: formatDateString(end),
  };
};

const formatTime = (value: string): string => {
  const [hours, minutes] = value.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return value;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(
    2,
    "0",
  )} ${suffix}`;
};

const formatMonth = (value: string): string =>
  parseLocalDate(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

const formatLongDate = (value: string): string =>
  parseLocalDate(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const getStatusLabel = (
  appointment: StaffAppointment,
): string => {
  if (appointment.status_label) {
    return appointment.status_label;
  }

  const status = appointment.status.toUpperCase();

  const labels: Record<string, string> = {
    SCHEDULED: "Waiting",
    CONFIRMED: "Confirmed",
    CHECKED_IN: "Attended",
    IN_PROGRESS: "With Doctor",
    COMPLETED: "Completed",
    NO_SHOW: "Not Attended",
    CANCELLED: "Cancelled",
  };

  return labels[status] || status;
};

const getStatusClass = (
  status: string,
): string => {
  const normalized = status.toUpperCase();

  if (normalized === "COMPLETED") {
    return "completed";
  }

  if (normalized === "CANCELLED") {
    return "cancelled";
  }

  if (normalized === "NO_SHOW") {
    return "no-show";
  }

  if (normalized === "CHECKED_IN") {
    return "attended";
  }

  if (normalized === "IN_PROGRESS") {
    return "in-progress";
  }

  return "waiting";
};

const getInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "P";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const AdminCalendar: React.FC<
  AdminCalendarProps
> = ({ onBookingSuccess }) => {
  const today = getLocalDateString();

  const [selectedDate, setSelectedDate] =
    useState(today);

  const [view, setView] =
    useState<CalendarView>("month");

  const [calendarData, setCalendarData] =
    useState<PublicCalendarResponse | null>(null);

  const [appointments, setAppointments] =
    useState<StaffAppointment[]>([]);

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [selectedDoctorId, setSelectedDoctorId] =
    useState<number | null>(null);

  const [selectedSlot, setSelectedSlot] =
    useState<SelectedSlot | null>(null);

  const [selectedPatientId, setSelectedPatientId] =
    useState<number | null>(null);

  const [patientSearch, setPatientSearch] =
    useState("");

  const [appointmentType, setAppointmentType] =
    useState("IN_PERSON");

  const [reason, setReason] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loadingCalendar, setLoadingCalendar] =
    useState(true);

  const [loadingPatients, setLoadingPatients] =
    useState(false);

  const [booking, setBooking] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const baseUrl = (
    API_URL || "http://localhost:8000"
  ).replace(/\/+$/, "");

  const token =
    localStorage.getItem("access_token");

  const request = useCallback(
    async (
      path: string,
      options: RequestInit = {},
    ) => {
      const headers = new Headers(
        options.headers,
      );

      headers.set(
        "Accept",
        "application/json",
      );

      if (token) {
        headers.set(
          "Authorization",
          `Bearer ${token}`,
        );
      }

      if (options.body) {
        headers.set(
          "Content-Type",
          "application/json",
        );
      }

      return fetch(
        `${baseUrl}${path}`,
        {
          ...options,
          headers,
        },
      );
    },
    [baseUrl, token],
  );

  const fetchCalendar = useCallback(
    async (
      dateString: string,
      signal?: AbortSignal,
      background = false,
    ) => {
      try {
        if (!background) {
          setLoadingCalendar(true);
          setError("");
        }

        const {
          startDate,
          endDate,
        } = getCalendarRange(dateString);

        const params = new URLSearchParams({
          start_date: startDate,
          end_date: endDate,
        });

        const response = await fetch(
          `${baseUrl}/public/calendar?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal,
          },
        );

        if (!response.ok) {
          let detail = "";

          try {
            const payload =
              await response.json();

            detail =
              typeof payload?.detail ===
              "string"
                ? payload.detail
                : "";
          } catch {
            // Keep the fallback message.
          }

          throw new Error(
            detail ||
              "Unable to load the appointment calendar.",
          );
        }

        const data =
          (await response.json()) as PublicCalendarResponse;

        setCalendarData(data);
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Admin calendar error:",
          err,
        );

        if (
          !signal?.aborted &&
          !background
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the appointment calendar.",
          );
        }
      } finally {
        if (
          !signal?.aborted &&
          !background
        ) {
          setLoadingCalendar(false);
        }
      }
    },
    [baseUrl],
  );

  const fetchAppointments = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response =
          await request(
            "/appointments/staff",
            {
              signal,
            },
          );

        if (!response.ok) {
          throw new Error(
            "Unable to load existing appointments.",
          );
        }

        const data =
          (await response.json()) as {
            appointments?: StaffAppointment[];
          };

        setAppointments(
          Array.isArray(data.appointments)
            ? data.appointments
            : [],
        );
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Staff appointments error:",
          err,
        );
      }
    },
    [request],
  );

  const fetchPatients = useCallback(
    async () => {
      try {
        setLoadingPatients(true);

        const response =
          await request("/users/patients");

        if (!response.ok) {
          let detail = "";

          try {
            const payload =
              await response.json();

            detail =
              typeof payload?.detail ===
              "string"
                ? payload.detail
                : "";
          } catch {
            // Keep fallback.
          }

          throw new Error(
            detail ||
              "Unable to load patients.",
          );
        }

        const data =
          (await response.json()) as {
            patients?: Patient[];
          };

        setPatients(
          Array.isArray(data.patients)
            ? data.patients
            : [],
        );
      } catch (err) {
        console.error(
          "Patient directory error:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load patients.",
        );
      } finally {
        setLoadingPatients(false);
      }
    },
    [request],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void fetchCalendar(
      selectedDate,
      controller.signal,
    );

    void fetchAppointments(
      controller.signal,
    );

    return () =>
      controller.abort();
  }, [
    selectedDate,
    fetchCalendar,
    fetchAppointments,
  ]);

  useEffect(() => {
    void fetchPatients();
  }, [fetchPatients]);

  /*
   * Keep the calendar synchronized with patient-side
   * bookings/cancellations without refreshing the page.
   */
  useEffect(() => {
    const intervalId =
      window.setInterval(() => {
        void fetchCalendar(
          selectedDate,
          undefined,
          true,
        );

        void fetchAppointments();
      }, 30_000);

    return () =>
      window.clearInterval(
        intervalId,
      );
  }, [
    selectedDate,
    fetchCalendar,
    fetchAppointments,
  ]);

  const doctors = useMemo(
    () => calendarData?.doctors || [],
    [calendarData],
  );

  const monthAppointments = useMemo(() => {
    if (!calendarData) {
      return [];
    }

    return appointments.filter(
      (appointment) =>
        appointment.appointment_date >=
          calendarData.start_date &&
        appointment.appointment_date <=
          calendarData.end_date &&
        ACTIVE_STATUSES.has(
          appointment.status.toUpperCase(),
        ),
    );
  }, [appointments, calendarData]);

  const selectedDateAppointments =
    useMemo(
      () =>
        monthAppointments
          .filter(
            (appointment) =>
              appointment.appointment_date ===
              selectedDate,
          )
          .sort((a, b) =>
            a.start_time.localeCompare(
              b.start_time,
            ),
          ),
      [
        monthAppointments,
        selectedDate,
      ],
    );

  const selectedDoctor =
    useMemo(
      () =>
        doctors.find(
          (doctor) =>
            doctor.id ===
            selectedDoctorId,
        ) || null,
      [doctors, selectedDoctorId],
    );

  const selectedDoctorSlots =
    useMemo(() => {
      if (
        !calendarData ||
        !selectedDoctorId
      ) {
        return [];
      }

      const day =
        calendarData.days[
          selectedDate
        ];

      if (!day) {
        return [];
      }

      const doctorSlots =
        day.doctors[
          String(selectedDoctorId)
        ];

      if (!doctorSlots) {
        return [];
      }

      return Object.values(
        doctorSlots,
      ).sort((a, b) =>
        a.start_time.localeCompare(
          b.start_time,
        ),
      );
    }, [
      calendarData,
      selectedDate,
      selectedDoctorId,
    ]);

  const filteredPatients =
    useMemo(() => {
      const query =
        patientSearch.trim().toLowerCase();

      if (!query) {
        return patients.slice(0, 8);
      }

      return patients
        .filter((patient) =>
          [
            patient.name,
            patient.email,
            patient.phone,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query),
            ),
        )
        .slice(0, 8);
    }, [
      patients,
      patientSearch,
    ]);

  const calendarDays = useMemo(() => {
    if (!calendarData) {
      return [];
    }

    const start =
      parseLocalDate(
        calendarData.start_date,
      );

    return Array.from(
      { length: 42 },
      (_, index) =>
        formatDateString(
          new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() +
              index,
          ),
        ),
    );
  }, [calendarData]);

  const navigateMonth = (
    direction: number,
  ) => {
    const current =
      parseLocalDate(selectedDate);

    current.setMonth(
      current.getMonth() +
        direction,
    );

    setSelectedDate(
      formatDateString(
        current,
      ),
    );
    setSelectedSlot(null);
    setSuccess("");
  };

  const goToday = () => {
    setSelectedDate(today);
    setSelectedSlot(null);
    setSuccess("");
  };

  const handleDateSelect = (
    date: string,
  ) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSuccess("");
    setError("");
  };

  const openSlot = (
    doctor: CalendarDoctor,
    slot: CalendarSlot,
  ) => {
    if (
      slot.status !== "available"
    ) {
      return;
    }

    setSelectedDoctorId(
      doctor.id,
    );

    setSelectedSlot({
      doctorId: doctor.id,
      doctorName: doctor.name,
      date: selectedDate,
      startTime: slot.start_time,
      endTime: slot.end_time,
    });

    setSelectedPatientId(null);
    setPatientSearch("");
    setSuccess("");
    setError("");
  };

  const submitBooking = async () => {
    if (!selectedSlot) {
      setError(
        "Please select an available time slot.",
      );
      return;
    }

    if (!selectedPatientId) {
      setError(
        "Please select a patient before booking.",
      );
      return;
    }

    try {
      setBooking(true);
      setError("");
      setSuccess("");

      const response =
        await request(
          "/appointments/staff-book",
          {
            method: "POST",
            body: JSON.stringify({
              patient_id:
                selectedPatientId,
              doctor_id:
                selectedSlot.doctorId,
              appointment_date:
                selectedSlot.date,
              start_time:
                selectedSlot.startTime,
              end_time:
                selectedSlot.endTime,
              appointment_type:
                appointmentType,
              reason:
                reason.trim() || null,
              notes:
                notes.trim() || null,
            }),
          },
        );

      const data =
        (await response.json().catch(
          () => ({}),
        )) as {
          detail?: string;
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to book the appointment.",
        );
      }

      setSuccess(
        data.message ||
          "Appointment booked successfully.",
      );

      setSelectedSlot(null);
      setSelectedPatientId(null);
      setPatientSearch("");
      setReason("");
      setNotes("");

      await Promise.all([
        fetchCalendar(selectedDate),
        fetchAppointments(),
      ]);

      onBookingSuccess?.();
    } catch (err) {
      console.error(
        "Staff appointment booking error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to book the appointment.",
      );

      /*
       * Re-fetch after any booking conflict so a slot that
       * another user just occupied immediately becomes booked.
       */
      await Promise.all([
        fetchCalendar(
          selectedDate,
          undefined,
          true,
        ),
        fetchAppointments(),
      ]);
    } finally {
      setBooking(false);
    }
  };

  const getDateAppointments = (
    date: string,
  ) =>
    monthAppointments.filter(
      (appointment) =>
        appointment.appointment_date ===
        date,
    );

  return (
    <section className="admin-calendar">
      <div className="admin-calendar-header">
        <div>
          <span className="admin-calendar-eyebrow">
            APPOINTMENT SCHEDULING
          </span>

          <h2>Calendar</h2>

          <p>
            View existing patient appointments and
            book appointments for walk-in patients.
          </p>
        </div>

        <div className="admin-calendar-header-actions">
          <button
            type="button"
            className="admin-calendar-secondary"
            onClick={goToday}
          >
            Today
          </button>

          <div className="admin-calendar-view-switch">
            {(
              [
                ["month", "Month"],
                ["week", "Week"],
                ["day", "Day"],
              ] as const
            ).map(
              ([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={
                    view === value
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setView(value)
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="admin-calendar-alert error">
          <span>!</span>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="admin-calendar-alert success">
          <span>✓</span>
          <p>{success}</p>
          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            ×
          </button>
        </div>
      )}

      <div className="admin-calendar-layout">
        <div className="admin-calendar-main">
          <div className="admin-calendar-toolbar">
            <div className="admin-calendar-month-nav">
              <button
                type="button"
                onClick={() =>
                  navigateMonth(-1)
                }
                aria-label="Previous month"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={() =>
                  navigateMonth(1)
                }
                aria-label="Next month"
              >
                ›
              </button>

              <strong>
                {formatMonth(
                  selectedDate,
                )}
              </strong>
            </div>

            <div className="admin-calendar-live-state">
              <span className="live-dot" />
              Live availability
            </div>
          </div>

          {loadingCalendar &&
          !calendarData ? (
            <div className="admin-calendar-loading">
              Loading calendar...
            </div>
          ) : (
            <>
              <div className="admin-calendar-weekdays">
                {[
                  "Sun",
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                ].map(
                  (day) => (
                    <span key={day}>
                      {day}
                    </span>
                  ),
                )}
              </div>

              <div className="admin-calendar-grid">
                {calendarDays.map(
                  (date) => {
                    const dateObject =
                      parseLocalDate(
                        date,
                      );

                    const isCurrentMonth =
                      dateObject.getMonth() ===
                      parseLocalDate(
                        selectedDate,
                      ).getMonth();

                    const isToday =
                      date === today;

                    const isSelected =
                      date ===
                      selectedDate;

                    const dayAppointments =
                      getDateAppointments(
                        date,
                      );

                    return (
                      <button
                        type="button"
                        key={date}
                        className={[
                          "admin-calendar-day",
                          !isCurrentMonth
                            ? "outside-month"
                            : "",
                          isToday
                            ? "today"
                            : "",
                          isSelected
                            ? "selected"
                            : "",
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(" ")}
                        onClick={() =>
                          handleDateSelect(
                            date,
                          )
                        }
                      >
                        <span className="admin-calendar-day-number">
                          {dateObject.getDate()}
                        </span>

                        <div className="admin-calendar-day-events">
                          {dayAppointments
                            .slice(
                              0,
                              3,
                            )
                            .map(
                              (
                                appointment,
                              ) => (
                                <span
                                  key={
                                    appointment.id
                                  }
                                  className={`admin-calendar-event ${getStatusClass(
                                    appointment.status,
                                  )}`}
                                  title={`${appointment.patient_name} · ${appointment.doctor_name} · ${formatTime(
                                    appointment.start_time,
                                  )}`}
                                >
                                  <b>
                                    {formatTime(
                                      appointment.start_time,
                                    )}
                                  </b>

                                  <span>
                                    {
                                      appointment.patient_name
                                    }
                                  </span>
                                </span>
                              ),
                            )}

                          {dayAppointments.length >
                            3 && (
                            <span className="admin-calendar-more">
                              +
                              {dayAppointments.length -
                                3}{" "}
                              more
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </>
          )}
        </div>

        <aside className="admin-calendar-side">
          <div className="admin-calendar-side-header">
            <div>
              <span>
                SELECTED DATE
              </span>

              <h3>
                {formatLongDate(
                  selectedDate,
                )}
              </h3>
            </div>
          </div>

          <div className="admin-calendar-date-summary">
            <div>
              <strong>
                {
                  selectedDateAppointments.length
                }
              </strong>
              <span>
                Existing appointments
              </span>
            </div>

            <div>
              <strong>
                {doctors.length}
              </strong>
              <span>
                Active providers
              </span>
            </div>
          </div>

          <div className="admin-calendar-section">
            <label htmlFor="admin-calendar-doctor">
              Doctor
            </label>

            <select
              id="admin-calendar-doctor"
              value={
                selectedDoctorId
                  ? String(
                      selectedDoctorId,
                    )
                  : ""
              }
              onChange={(event) => {
                const value =
                  Number(
                    event.target.value,
                  );

                setSelectedDoctorId(
                  value || null,
                );
                setSelectedSlot(
                  null,
                );
                setError("");
              }}
            >
              <option value="">
                Select doctor
              </option>

              {doctors.map(
                (doctor) => (
                  <option
                    key={doctor.id}
                    value={doctor.id}
                  >
                    {doctor.name}
                    {doctor.specialization
                      ? ` · ${doctor.specialization}`
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>

          {selectedDoctor && (
            <div className="admin-calendar-doctor-card">
              <div className="admin-calendar-doctor-avatar">
                {getInitials(
                  selectedDoctor.name,
                )}
              </div>

              <div>
                <strong>
                  {selectedDoctor.name}
                </strong>

                <span>
                  {selectedDoctor.specialization ||
                    selectedDoctor.department ||
                    "Healthcare provider"}
                </span>
              </div>
            </div>
          )}

          <div className="admin-calendar-section">
            <div className="admin-calendar-section-title">
              <label>
                Available slots
              </label>

              {selectedDoctorSlots.length >
                0 && (
                <span>
                  {
                    selectedDoctorSlots.filter(
                      (slot) =>
                        slot.status ===
                        "available",
                    ).length
                  }{" "}
                  free
                </span>
              )}
            </div>

            {!selectedDoctor ? (
              <div className="admin-calendar-empty">
                Select a doctor to see the
                dynamically generated slots.
              </div>
            ) : selectedDoctorSlots.length ===
              0 ? (
              <div className="admin-calendar-empty">
                No schedule is available for this
                doctor on the selected date.
              </div>
            ) : (
              <div className="admin-calendar-slots">
                {selectedDoctorSlots.map(
                  (slot) => (
                    <button
                      type="button"
                      key={`${slot.start_time}-${slot.end_time}`}
                      disabled={
                        slot.status !==
                        "available"
                      }
                      className={[
                        "admin-calendar-slot",
                        slot.status,
                        selectedSlot?.startTime ===
                          slot.start_time &&
                        selectedSlot?.doctorId ===
                          selectedDoctorId
                          ? "selected"
                          : "",
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(" ")}
                      onClick={() => {
                        if (!selectedDoctor) {
                          return;
                        }

                        openSlot(
                          selectedDoctor,
                          slot,
                        );
                      }}
                    >
                      <span>
                        {formatTime(
                          slot.start_time,
                        )}
                      </span>

                      <small>
                        {slot.status ===
                        "available"
                          ? "Available"
                          : slot.status ===
                              "booked"
                            ? "Booked"
                            : "Unavailable"}
                      </small>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {selectedDateAppointments.length >
            0 && (
            <div className="admin-calendar-section">
              <div className="admin-calendar-section-title">
                <label>
                  Existing appointments
                </label>
              </div>

              <div className="admin-calendar-existing-list">
                {selectedDateAppointments.map(
                  (appointment) => (
                    <div
                      className="admin-calendar-existing"
                      key={
                        appointment.id
                      }
                    >
                      <div className="admin-calendar-existing-time">
                        {formatTime(
                          appointment.start_time,
                        )}
                      </div>

                      <div className="admin-calendar-existing-info">
                        <strong>
                          {
                            appointment.patient_name
                          }
                        </strong>

                        <span>
                          {
                            appointment.doctor_name
                          }
                        </span>
                      </div>

                      <span
                        className={`admin-calendar-status ${getStatusClass(
                          appointment.status,
                        )}`}
                      >
                        {getStatusLabel(
                          appointment,
                        )}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {selectedSlot && (
            <div className="admin-calendar-booking-panel">
              <div className="admin-calendar-booking-heading">
                <div>
                  <span>
                    WALK-IN BOOKING
                  </span>

                  <h3>
                    {formatTime(
                      selectedSlot.startTime,
                    )}{" "}
                    –{" "}
                    {formatTime(
                      selectedSlot.endTime,
                    )}
                  </h3>

                  <p>
                    {selectedSlot.doctorName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedSlot(
                      null,
                    )
                  }
                  aria-label="Close booking panel"
                >
                  ×
                </button>
              </div>

              <div className="admin-calendar-booking-field">
                <label>
                  Patient
                </label>

                <input
                  type="search"
                  value={patientSearch}
                  onChange={(event) => {
                    setPatientSearch(
                      event.target.value,
                    );
                    setSelectedPatientId(
                      null,
                    );
                  }}
                  placeholder="Search patient by name, email or phone"
                />

                {loadingPatients ? (
                  <div className="admin-calendar-patient-results">
                    Loading patients...
                  </div>
                ) : filteredPatients.length >
                  0 ? (
                  <div className="admin-calendar-patient-results">
                    {filteredPatients.map(
                      (patient) => (
                        <button
                          type="button"
                          key={
                            patient.id
                          }
                          className={
                            selectedPatientId ===
                            patient.id
                              ? "selected"
                              : ""
                          }
                          onClick={() => {
                            setSelectedPatientId(
                              patient.id,
                            );
                            setPatientSearch(
                              patient.name,
                            );
                          }}
                        >
                          <span className="admin-calendar-patient-avatar">
                            {getInitials(
                              patient.name,
                            )}
                          </span>

                          <span>
                            <strong>
                              {
                                patient.name
                              }
                            </strong>

                            <small>
                              {
                                patient.email
                              }
                              {patient.phone
                                ? ` · ${patient.phone}`
                                : ""}
                            </small>
                          </span>

                          {selectedPatientId ===
                            patient.id && (
                            <b>
                              ✓
                            </b>
                          )}
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="admin-calendar-patient-results empty">
                    No matching patient found.
                  </div>
                )}
              </div>

              <div className="admin-calendar-booking-row">
                <div className="admin-calendar-booking-field">
                  <label>
                    Appointment type
                  </label>

                  <select
                    value={
                      appointmentType
                    }
                    onChange={(
                      event,
                    ) =>
                      setAppointmentType(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="IN_PERSON">
                      In Person
                    </option>
                    <option value="TELEHEALTH">
                      Telehealth
                    </option>
                  </select>
                </div>

                <div className="admin-calendar-booking-field">
                  <label>
                    Reason
                  </label>

                  <input
                    value={reason}
                    onChange={(
                      event,
                    ) =>
                      setReason(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="admin-calendar-booking-field">
                <label>
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(
                    event,
                  ) =>
                    setNotes(
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="Optional front-desk notes"
                />
              </div>

              <button
                type="button"
                className="admin-calendar-book-button"
                disabled={
                  booking ||
                  !selectedPatientId
                }
                onClick={
                  submitBooking
                }
              >
                {booking
                  ? "Booking..."
                  : "Book Appointment"}
              </button>

              <p className="admin-calendar-booking-note">
                The server validates the selected
                doctor/date/time again before creating
                the appointment, so an occupied slot
                cannot be double-booked.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default AdminCalendar;
