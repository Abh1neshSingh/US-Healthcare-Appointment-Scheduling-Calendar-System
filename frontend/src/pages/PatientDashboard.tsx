import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppointmentBooking from "../components/AppointmentBooking";
import "./PatientDashboard.css";

interface Appointment {
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

interface AppointmentResponse {
  count: number;
  appointments: Appointment[];
}

function PatientDashboard() {
  const navigate = useNavigate();

  const [showBooking, setShowBooking] = useState(false);
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] =
    useState(true);

  const [currentMonth, setCurrentMonth] = useState(
    new Date(2026, 7, 1)
  );

  // ==================================================
  // LOAD PATIENT APPOINTMENTS
  // ==================================================

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);

      const token = localStorage.getItem("access_token");

      const response = await fetch(
        "https://ushcs.onrender.com/appointments/my",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load appointments."
        );
      }

      const data: AppointmentResponse =
        await response.json();

      setAppointments(data.appointments || []);
    } catch (error) {
      console.error(
        "Error loading appointments:",
        error
      );

      setAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Load appointments when dashboard opens
  useEffect(() => {
    fetchAppointments();
  }, []);

  // ==================================================
  // LOGOUT
  // ==================================================

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/login");
  };

  // ==================================================
  // BOOKING MODAL
  // ==================================================

  const openBooking = () => {
    setShowBooking(true);
  };

  const closeBooking = () => {
    setShowBooking(false);
  };

  const openAllAppointments = () => {
    setShowAllAppointments(true);
  };

  const closeAllAppointments = () => {
    setShowAllAppointments(false);
  };

  const handleBookingSuccess = async () => {
    // Close booking modal
    setShowBooking(false);

    // Refresh dashboard data
    await fetchAppointments();
  };

  // ==================================================
  // DATE HELPERS
  // ==================================================

  const formatTime = (time: string) => {
    const [hours, minutes] = time
      .split(":")
      .map(Number);

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(
      `${dateString}T00:00:00`
    );

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // ==================================================
  // UPCOMING APPOINTMENTS
  // ==================================================

  const upcomingAppointments = useMemo(() => {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return appointments
      .filter((appointment) => {
        const appointmentDate = new Date(
          `${appointment.appointment_date}T00:00:00`
        );

        return (
          appointmentDate >= today &&
          appointment.status !== "CANCELLED"
        );
      })
      .sort((a, b) => {
        const first =
          `${a.appointment_date}T${a.start_time}`;

        const second =
          `${b.appointment_date}T${b.start_time}`;

        return first.localeCompare(second);
      });
  }, [appointments]);

  // ==================================================
  // STATS
  // ==================================================

  const upcomingCount =
    upcomingAppointments.length;

  const completedCount = appointments.filter(
    (appointment) =>
      appointment.status === "COMPLETED"
  ).length;

  const doctorsConsulted = new Set(
    appointments
      .filter(
        (appointment) =>
          appointment.status === "COMPLETED"
      )
      .map(
        (appointment) =>
          appointment.doctor_id
      )
  ).size;

  // ==================================================
  // CALENDAR
  // ==================================================

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    ).getDay();

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const daysInPreviousMonth =
      new Date(
        year,
        month,
        0
      ).getDate();

    const days = [];

    // Previous month's days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(
          year,
          month - 1,
          daysInPreviousMonth - i
        ),
        currentMonth: false,
      });
    }

    // Current month's days
    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      days.push({
        date: new Date(
          year,
          month,
          day
        ),
        currentMonth: true,
      });
    }

    // Next month's days
    let nextDay = 1;

    while (days.length < 42) {
      days.push({
        date: new Date(
          year,
          month + 1,
          nextDay
        ),
        currentMonth: false,
      });

      nextDay++;
    }

    return days;
  }, [currentMonth]);

  const monthTitle =
    currentMonth.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      }
    );

  // ==================================================
  // CALENDAR NAVIGATION
  // ==================================================

  const goToPreviousMonth = () => {
    setCurrentMonth(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() - 1,
          1
        )
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + 1,
          1
        )
    );
  };

  const goToToday = () => {
    const today = new Date();

    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );
  };

  // ==================================================
  // CALENDAR DATE KEY
  // ==================================================

  const getDateKey = (date: Date) => {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getAppointmentsForDate = (
    date: Date
  ) => {
    const dateKey = getDateKey(date);

    return appointments.filter(
      (appointment) =>
        appointment.appointment_date ===
        dateKey
    );
  };

  // ==================================================
  // THIS WEEK
  // ==================================================

  const thisWeekAppointments =
    useMemo(() => {
      const today = new Date();

      today.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(today);

      endOfWeek.setDate(
        today.getDate() + 7
      );

      return upcomingAppointments.filter(
        (appointment) => {
          const appointmentDate =
            new Date(
              `${appointment.appointment_date}T00:00:00`
            );

          return (
            appointmentDate >= today &&
            appointmentDate < endOfWeek
          );
        }
      );
    }, [upcomingAppointments]);

  return (
    <div className="patient-dashboard">

      {/* ================= SIDEBAR ================= */}

      <aside className="patient-sidebar">

        <div className="sidebar-brand">
          <div className="brand-icon">
            ♥
          </div>

          <div>
            <h2>HealthCare</h2>
            <span>
              Appointment System
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">

          <button
            className="nav-item active"
          >
            <span>⌂</span>
            Dashboard
          </button>

          <div className="nav-section-title">
            APPOINTMENTS
          </div>

          <button
            className="nav-item"
            onClick={() =>
              navigate(
                "/patient/doctors"
              )
            }
          >
            <span>♙</span>
            Find Doctor
          </button>

          <button
            className="nav-item"
            onClick={openBooking}
          >
            <span>▣</span>
            My Appointments
          </button>

          <button
            className="nav-item"
            onClick={goToToday}
          >
            <span>□</span>
            Calendar
          </button>

          <div className="sidebar-divider" />

          <div className="nav-section-title">
            ACCOUNT
          </div>

          <button className="nav-item">
            <span>♙</span>
            Profile
          </button>

          <button className="nav-item">
            <span>▤</span>
            Medical Records
          </button>

          <button className="nav-item">
            <span>⚙</span>
            Settings
          </button>

          <button className="nav-item">
            <span>?</span>
            Help & Support
          </button>

        </nav>

        {/* ================= USER ================= */}

        <div className="sidebar-user">

          <div className="user-info">

            <div className="user-avatar">
              JD
            </div>

            <div>
              <strong>
                John Doe
              </strong>

              <span>
                patient@example.com
              </span>
            </div>

          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            ↪ Logout
          </button>

        </div>

      </aside>

      {/* ================= MAIN ================= */}

      <main className="patient-main">

        {/* ================= HEADER ================= */}

        <header className="dashboard-header">

          <div>

            <p className="dashboard-label">
              PATIENT DASHBOARD
            </p>

            <h1>
              Good morning, John! 👋
            </h1>

            <p className="dashboard-subtitle">
              Here's your healthcare overview
              for today.
            </p>

          </div>

          <div className="header-actions">

            <button className="notification-button">
              ♧

              <span className="notification-count">
                0
              </span>
            </button>

            <div className="header-avatar">
              JD
            </div>

          </div>

        </header>

        {/* ================= STATS ================= */}

        <section className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon blue">
              ▣
            </div>

            <div className="stat-content">

              <span>
                Upcoming Appointments
              </span>

              <strong>
                {upcomingCount}
              </strong>

              <small>
                Total upcoming
              </small>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon green">
              ✓
            </div>

            <div className="stat-content">

              <span>
                Completed Appointments
              </span>

              <strong>
                {completedCount}
              </strong>

              <small>
                Total completed
              </small>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon purple">
              ♙
            </div>

            <div className="stat-content">

              <span>
                Doctors Consulted
              </span>

              <strong>
                {doctorsConsulted}
              </strong>

              <small>
                Total
              </small>

            </div>

          </div>

          <div className="stat-card">

            <div className="stat-icon orange">
              ▤
            </div>

            <div className="stat-content">

              <span>
                Health Records
              </span>

              <strong>
                0
              </strong>

              <small>
                Documents
              </small>

            </div>

          </div>

        </section>

        {/* ================= CONTENT GRID ================= */}

        <section className="dashboard-content-grid">

          {/* ================= CALENDAR ================= */}

          <div className="calendar-card">

            <div className="section-header">

              <h2>
                Calendar
              </h2>

              <div className="calendar-header-actions">

                <button
                  className="book-calendar-button"
                  onClick={openBooking}
                >
                  + Book Appointment
                </button>

                <button
                  className="today-button"
                  onClick={goToToday}
                >
                  Today
                </button>

              </div>

            </div>

            <div className="calendar-toolbar">

              <div className="calendar-navigation">

                <button
                  onClick={
                    goToPreviousMonth
                  }
                >
                  ‹
                </button>

                <button
                  onClick={
                    goToNextMonth
                  }
                >
                  ›
                </button>

              </div>

              <strong>
                {monthTitle}
              </strong>

              <div className="calendar-view">

                <button className="selected">
                  Month
                </button>

                <button>
                  Week
                </button>

                <button>
                  Day
                </button>

              </div>

            </div>

            {/* ================= WEEK DAYS ================= */}

            <div className="calendar-weekdays">

              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>

            </div>

            {/* ================= CALENDAR ================= */}

            <div className="calendar-grid">

              {calendarDays.map(
                (calendarDay, index) => {

                  const dayAppointments =
                    getAppointmentsForDate(
                      calendarDay.date
                    );

                  return (
                    <div
                      key={index}
                      className={`calendar-day ${
                        calendarDay.currentMonth
                          ? ""
                          : "muted"
                      } ${
                        dayAppointments.length
                          ? "has-appointment"
                          : ""
                      }`}
                    >

                      <span className="calendar-day-number">
                        {calendarDay.date.getDate()}
                      </span>

                      {dayAppointments.length >
                        0 && (
                        <div className="calendar-appointments">

                          {dayAppointments
                            .slice(0, 2)
                            .map(
                              (
                                appointment
                              ) => (
                                <div
                                  key={
                                    appointment.id
                                  }
                                  className="calendar-appointment"
                                >
                                  <strong>
                                    {formatTime(
                                      appointment.start_time
                                    )}
                                  </strong>

                                  <span>
                                    {
                                      appointment.doctor_name
                                    }
                                  </span>
                                </div>
                              )
                            )}

                          {dayAppointments.length >
                            2 && (
                            <small>
                              +
                              {dayAppointments.length -
                                2}{" "}
                              more
                            </small>
                          )}

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>

            {/* ================= CALENDAR EMPTY ================= */}

            {!loadingAppointments &&
              appointments.length ===
                0 && (
                <div className="calendar-empty">

                  <span>
                    ✓
                  </span>

                  <p>
                    No appointments scheduled
                  </p>

                  <small>
                    Your booked appointments
                    will appear here.
                  </small>

                </div>
              )}

          </div>

          {/* ================= UPCOMING ================= */}

          <div className="upcoming-card">

            <div className="section-header">

              <h2>
                Upcoming Appointments
              </h2>

              <div className="upcoming-header-actions">

                <button
                  className="book-header-button"
                  onClick={openBooking}
                >
                  + Book Appointment
                </button>

                <button
                  className="view-all-button"
                  onClick={openAllAppointments}
                >
                  View All
                </button>

              </div>

            </div>

            {loadingAppointments ? (
              <div className="upcoming-empty">
                <p>
                  Loading appointments...
                </p>
              </div>
            ) : upcomingAppointments.length ===
              0 ? (
              <div className="upcoming-empty">

                <div className="empty-icon">
                  ✓
                </div>

                <h3>
                  No upcoming appointments
                </h3>

                <p>
                  You don't have any
                  upcoming appointments.
                </p>

                <button
                  className="book-button"
                  onClick={openBooking}
                >
                  + Book New Appointment
                </button>

              </div>
            ) : (
              <div className="upcoming-list">

                {upcomingAppointments
                  .slice(0, 4)
                  .map((appointment) => (

                    <div
                      className="upcoming-appointment"
                      key={appointment.id}
                    >

                      <div className="appointment-date-box">

                        <strong>
                          {new Date(
                            `${appointment.appointment_date}T00:00:00`
                          ).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                            }
                          )}
                        </strong>

                        <span>
                          {new Date(
                            `${appointment.appointment_date}T00:00:00`
                          ).getDate()}
                        </span>

                      </div>

                      <div className="appointment-info">

                        <strong>
                          {
                            appointment.doctor_name
                          }
                        </strong>

                        <span>
                          {formatDate(
                            appointment.appointment_date
                          )}
                        </span>

                        <span>
                          {formatTime(
                            appointment.start_time
                          )}
                          {" - "}
                          {formatTime(
                            appointment.end_time
                          )}
                        </span>

                      </div>

                      <span className="appointment-status">
                        {appointment.status}
                      </span>

                    </div>

                  ))}

              </div>
            )}

          </div>

        </section>

        {/* ================= QUICK ACTIONS ================= */}

        <section className="quick-actions-card">

          <div className="section-header">

            <h2>
              Quick Actions
            </h2>

          </div>

          <div className="quick-actions-grid">

            <button
              onClick={() =>
                navigate(
                  "/patient/doctors"
                )
              }
            >

              <span className="quick-icon blue">
                ♙
              </span>

              <span>
                Find Doctor
              </span>

            </button>

            <button
              onClick={openBooking}
            >

              <span className="quick-icon green">
                ▣
              </span>

              <span>
                Book Appointment
              </span>

            </button>

            <button>

              <span className="quick-icon purple">
                ↑
              </span>

              <span>
                Upload Record
              </span>

            </button>

            <button>

              <span className="quick-icon orange">
                ▤
              </span>

              <span>
                Health Summary
              </span>

            </button>

          </div>

        </section>

        {/* ================= THIS WEEK ================= */}

        <section className="week-card">

          <div className="section-header">

            <h2>
              Upcoming This Week
            </h2>

            <button
              className="view-all-button"
              onClick={openAllAppointments}
            >
              View All
            </button>

          </div>

          {thisWeekAppointments.length ===
          0 ? (
            <div className="week-empty">
              No appointments scheduled
              for this week.
            </div>
          ) : (
            <div className="week-appointments">

              {thisWeekAppointments.map(
                (appointment) => (

                  <div
                    key={appointment.id}
                    className="week-appointment"
                  >

                    <strong>
                      {appointment.doctor_name}
                    </strong>

                    <span>
                      {formatDate(
                        appointment.appointment_date
                      )}
                    </span>

                    <span>
                      {formatTime(
                        appointment.start_time
                      )}
                      {" - "}
                      {formatTime(
                        appointment.end_time
                      )}
                    </span>

                  </div>

                )
              )}

            </div>
          )}

        </section>

      </main>

      {/* =================================================
          BOOKING MODAL
      ================================================= */}

      {showBooking && (

        <div
          className="booking-modal-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeBooking();
            }

          }}
        >

          <div
            className="booking-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <button
              className="booking-modal-close"
              onClick={closeBooking}
              aria-label="Close booking"
            >
              ×
            </button>

            <AppointmentBooking
              onBookingSuccess={
                handleBookingSuccess
              }
            />

          </div>

        </div>

      )}

      {/* =================================================
          ALL APPOINTMENTS MODAL
      ================================================= */}

      {showAllAppointments && (
        <div
          className="appointments-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAllAppointments();
            }
          }}
        >
          <div
            className="appointments-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="appointments-modal-header">
              <div>
                <p>APPOINTMENTS</p>
                <h2>All Appointments</h2>
                <span>
                  {appointments.length} appointment
                  {appointments.length !== 1 ? "s" : ""}
                </span>
              </div>

              <button
                type="button"
                className="appointments-modal-close"
                onClick={closeAllAppointments}
                aria-label="Close appointments"
              >
                ×
              </button>
            </div>

            {loadingAppointments ? (
              <div className="all-appointments-empty">
                Loading appointments...
              </div>
            ) : appointments.length === 0 ? (
              <div className="all-appointments-empty">
                <div className="all-empty-icon">✓</div>

                <h3>No appointments yet</h3>

                <p>
                  Your booked appointments will appear here.
                </p>

                <button
                  type="button"
                  className="book-button"
                  onClick={() => {
                    closeAllAppointments();
                    openBooking();
                  }}
                >
                  + Book New Appointment
                </button>
              </div>
            ) : (
              <div className="all-appointments-list">
                {appointments
                  .slice()
                  .sort((a, b) => {
                    const first =
                      `${a.appointment_date}T${a.start_time}`;
                    const second =
                      `${b.appointment_date}T${b.start_time}`;

                    return first.localeCompare(second);
                  })
                  .map((appointment) => (
                    <div
                      className="all-appointment-item"
                      key={appointment.id}
                    >
                      <div className="all-appointment-date">
                        <strong>
                          {new Date(
                            `${appointment.appointment_date}T00:00:00`
                          ).toLocaleDateString("en-US", {
                            month: "short",
                          })}
                        </strong>

                        <span>
                          {new Date(
                            `${appointment.appointment_date}T00:00:00`
                          ).getDate()}
                        </span>
                      </div>

                      <div className="all-appointment-info">
                        <strong>
                          {appointment.doctor_name}
                        </strong>

                        <span>
                          {formatDate(
                            appointment.appointment_date
                          )}
                        </span>

                        <span>
                          {formatTime(
                            appointment.start_time
                          )}
                          {" - "}
                          {formatTime(
                            appointment.end_time
                          )}
                        </span>
                      </div>

                      <span className="appointment-status">
                        {appointment.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="appointments-modal-footer">
              <button
                type="button"
                className="confirmation-cancel"
                onClick={closeAllAppointments}
              >
                Close
              </button>

              <button
                type="button"
                className="confirmation-submit"
                onClick={() => {
                  closeAllAppointments();
                  openBooking();
                }}
              >
                + Book New Appointment
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PatientDashboard;