import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import API_URL from "../config";

import AppointmentBooking from "../components/AppointmentBooking";

import DayView from "../components/DayView";

import type {
  DayViewAppointment,
} from "../components/DayView";

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

function PatientDashboard() {
  const navigate = useNavigate();

  // ==================================================
  // TODAY
  // ==================================================

  const todayDate = getTodayDate();

  // ==================================================
  // MODALS
  // ==================================================

  const [showBooking, setShowBooking] =
    useState(false);

  const [
    showAllAppointments,
    setShowAllAppointments,
  ] = useState(false);

  const [
    showDayView,
    setShowDayView,
  ] = useState(false);

  const [
    selectedAppointment,
    setSelectedAppointment,
  ] = useState<Appointment | null>(
    null
  );

  // ==================================================
  // APPOINTMENTS
  // ==================================================

  const [
    appointments,
    setAppointments,
  ] = useState<Appointment[]>([]);

  const [
    loadingAppointments,
    setLoadingAppointments,
  ] = useState(true);

  // ==================================================
  // CALENDAR
  // ==================================================

  const [
    currentMonth,
    setCurrentMonth,
  ] = useState(() => {
    const today = new Date();

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  });

  const [
    calendarView,
    setCalendarView,
  ] = useState<
    "month" | "week" | "day"
  >("month");

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(todayDate);

  // ==================================================
  // BOOKING STATE
  // ==================================================

  const [
    bookingDate,
    setBookingDate,
  ] = useState("");

  const [
    bookingDoctorId,
    setBookingDoctorId,
  ] = useState<number | null>(
    null
  );

  const [
    bookingStartTime,
    setBookingStartTime,
  ] = useState("");

  // ==================================================
  // LOAD APPOINTMENTS
  // ==================================================

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);

      const token =
        localStorage.getItem(
          "access_token"
        );

      const response = await fetch(
        `${API_URL}/appointments/my`,
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
            "Unable to load appointments."
        );
      }

      setAppointments(
        data.appointments || []
      );
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

  useEffect(() => {
    fetchAppointments();
  }, []);

  // ==================================================
  // LOGOUT
  // ==================================================

  const handleLogout = () => {
    localStorage.removeItem(
      "access_token"
    );

    navigate("/login");
  };

  // ==================================================
  // DATE HELPERS
  // ==================================================

  const getDateKey = (
    date: Date
  ): string => {
    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatTime = (
    time: string
  ): string => {
    const [
      hours,
      minutes,
    ] = time
      .split(":")
      .map(Number);

    const date = new Date();

    date.setHours(
      hours,
      minutes,
      0,
      0
    );

    return date.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  };

  const formatDate = (
    dateString: string
  ): string => {
    const date = new Date(
      `${dateString}T00:00:00`
    );

    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  };

  // ==================================================
  // MONTH TITLE
  // ==================================================

  const monthTitle =
    currentMonth.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      }
    );

  // ==================================================
  // MONTH CALENDAR DAYS
  // ==================================================

  const calendarDays = useMemo(() => {
    const year =
      currentMonth.getFullYear();

    const month =
      currentMonth.getMonth();

    const firstDay =
      new Date(
        year,
        month,
        1
      ).getDay();

    const daysInMonth =
      new Date(
        year,
        month + 1,
        0
      ).getDate();

    const previousMonthDays =
      new Date(
        year,
        month,
        0
      ).getDate();

    const days: {
      date: Date;
      currentMonth: boolean;
    }[] = [];

    for (
      let index = firstDay - 1;
      index >= 0;
      index--
    ) {
      days.push({
        date: new Date(
          year,
          month - 1,
          previousMonthDays -
            index
        ),
        currentMonth: false,
      });
    }

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

    let nextDay = 1;

    while (
      days.length < 42
    ) {
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

  // ==================================================
  // GET APPOINTMENTS FOR DATE
  // ==================================================

  const getAppointmentsForDate = (
    date: Date
  ) => {
    const dateKey =
      getDateKey(date);

    return appointments.filter(
      (appointment) =>
        appointment.appointment_date ===
        dateKey
    );
  };

  // ==================================================
  // UPCOMING APPOINTMENTS
  // ==================================================

  const upcomingAppointments =
    useMemo(() => {
      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      return appointments
        .filter(
          (appointment) => {
            const appointmentDate =
              new Date(
                `${appointment.appointment_date}T00:00:00`
              );

            return (
              appointmentDate >=
                today &&
              appointment.status !==
                "CANCELLED"
            );
          }
        )
        .sort(
          (first, second) =>
            `${first.appointment_date}T${first.start_time}`.localeCompare(
              `${second.appointment_date}T${second.start_time}`
            )
        );
    }, [appointments]);

  // ==================================================
  // THIS WEEK
  // ==================================================

  const thisWeekAppointments =
    useMemo(() => {
      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      const startOfWeek =
        new Date(today);

      startOfWeek.setDate(
        today.getDate() -
          today.getDay()
      );

      const endOfWeek =
        new Date(
          startOfWeek
        );

      endOfWeek.setDate(
        startOfWeek.getDate() +
          7
      );

      return upcomingAppointments.filter(
        (appointment) => {
          const appointmentDate =
            new Date(
              `${appointment.appointment_date}T00:00:00`
            );

          return (
            appointmentDate >=
              startOfWeek &&
            appointmentDate <
              endOfWeek
          );
        }
      );
    }, [
      upcomingAppointments,
    ]);

  // ==================================================
  // STATS
  // ==================================================

  const upcomingCount =
    upcomingAppointments.length;

  const completedCount =
    appointments.filter(
      (appointment) =>
        appointment.status ===
        "COMPLETED"
    ).length;

  const doctorsConsulted =
    new Set(
      appointments
        .filter(
          (appointment) =>
            appointment.status ===
            "COMPLETED"
        )
        .map(
          (appointment) =>
            appointment.doctor_id
        )
    ).size;

  // ==================================================
  // CALENDAR NAVIGATION
  // ==================================================

  const goToPreviousMonth =
    () => {
      setCurrentMonth(
        (previous) =>
          new Date(
            previous.getFullYear(),
            previous.getMonth() -
              1,
            1
          )
      );
    };

  const goToNextMonth =
    () => {
      setCurrentMonth(
        (previous) =>
          new Date(
            previous.getFullYear(),
            previous.getMonth() +
              1,
            1
          )
      );
    };

  const goToToday = () => {
    const today =
      new Date();

    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

    setSelectedDate(
      getDateKey(today)
    );
  };

  // ==================================================
  // OPEN DAY POPUP
  // ==================================================

  const openDayView = (
    date: Date
  ) => {
    const dateKey =
      getDateKey(date);

    setSelectedDate(
      dateKey
    );

    setCurrentMonth(
      new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      )
    );

    setCalendarView("day");

    setShowDayView(true);
  };

  // ==================================================
  // OPEN TODAY DAY POPUP
  // ==================================================

  const openTodayDayView =
    () => {
      const today =
        new Date();

      setSelectedDate(
        getDateKey(today)
      );

      setCurrentMonth(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          1
        )
      );

      setCalendarView("day");

      setShowDayView(true);
    };

  // ==================================================
  // CLOSE DAY POPUP
  // ==================================================

  const closeDayView = () => {
    setShowDayView(false);

    setCalendarView("month");

    setSelectedDate(
      todayDate
    );
  };

  // ==================================================
  // DAY DATE CHANGE
  // ==================================================

  const handleDayDateChange = (
    date: string
  ) => {
    /*
     * Day View is locked to today's date.
     *
     * Month and Week are responsible
     * for date selection.
     */
    if (date !== todayDate) {
      setSelectedDate(
        todayDate
      );

      return;
    }

    setSelectedDate(
      todayDate
    );
  };

  // ==================================================
  // BOOKING
  // ==================================================

  const openBooking = (
    date?: string,
    doctorId?: number,
    startTime?: string
  ) => {
    /*
     * IMPORTANT:
     * Close Day View first.
     *
     * This prevents the Day View popup
     * from remaining behind the Booking
     * popup when the user books from a
     * selected day/slot.
     */
    setShowDayView(false);

    setBookingDate(
      date || ""
    );

    setBookingDoctorId(
      doctorId ?? null
    );

    setBookingStartTime(
      startTime || ""
    );

    setShowBooking(true);
  };

  const closeBooking = () => {
    setShowBooking(false);

    setBookingDate("");

    setBookingDoctorId(
      null
    );

    setBookingStartTime(
      ""
    );
  };

  const handleBookingSuccess =
    async () => {
      closeBooking();

      setShowDayView(
        false
      );

      setCalendarView(
        "month"
      );

      await fetchAppointments();
    };

  // ==================================================
  // APPOINTMENT DETAILS
  // ==================================================

  const openAppointmentDetails =
    (
      appointment: DayViewAppointment
    ) => {
      const existing =
        appointments.find(
          (item) =>
            item.id ===
            appointment.id
        );

      setSelectedAppointment(
        existing || {
          ...appointment,
        }
      );
    };

  const closeAppointmentDetails =
    () => {
      setSelectedAppointment(
        null
      );
    };

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="patient-dashboard">

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <aside className="patient-sidebar">

        <div className="sidebar-brand">

          <div className="brand-icon">
            ♥
          </div>

          <div>
            <h2>
              HealthCare
            </h2>

            <span>
              Appointment System
            </span>
          </div>

        </div>

        <nav className="sidebar-nav">

          <button
            type="button"
            className="nav-item active"
          >
            <span>
              ⌂
            </span>

            Dashboard
          </button>

          <div className="nav-section-title">
            APPOINTMENTS
          </div>

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              navigate(
                "/patient/doctors"
              )
            }
          >
            <span>
              ♙
            </span>

            Find Doctor
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={
              () =>
                setShowAllAppointments(
                  true
                )
            }
          >
            <span>
              ▣
            </span>

            My Appointments
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() => {
              setCalendarView(
                "month"
              );

              setShowDayView(
                false
              );
            }}
          >
            <span>
              □
            </span>

            Calendar
          </button>

          <div className="sidebar-divider" />

          <div className="nav-section-title">
            ACCOUNT
          </div>

          <button
            type="button"
            className="nav-item"
          >
            <span>
              ♙
            </span>

            Profile
          </button>

          <button
            type="button"
            className="nav-item"
          >
            <span>
              ▤
            </span>

            Medical Records
          </button>

          <button
            type="button"
            className="nav-item"
          >
            <span>
              ⚙
            </span>

            Settings
          </button>

          <button
            type="button"
            className="nav-item"
          >
            <span>
              ?
            </span>

            Help & Support
          </button>

        </nav>

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
            type="button"
            className="logout-button"
            onClick={
              handleLogout
            }
          >
            ↪ Logout
          </button>

        </div>

      </aside>

      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="patient-main">

        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="dashboard-header">

          <div>

            <p className="dashboard-label">
              PATIENT DASHBOARD
            </p>

            <h1>
              Good morning, John! 👋
            </h1>

            <p className="dashboard-subtitle">
              Here's your healthcare
              overview for today.
            </p>

          </div>

          <div className="header-actions">

            <button
              type="button"
              className="notification-button"
            >
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

        {/* ==================================================
            STATS
        ================================================== */}

        <section className="stats-grid">

          <button
            type="button"
            className="stat-card"
            onClick={
              () =>
                setShowAllAppointments(
                  true
                )
            }
          >

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

          </button>

          <button
            type="button"
            className="stat-card"
            onClick={
              () =>
                setShowAllAppointments(
                  true
                )
            }
          >

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

          </button>

          <button
            type="button"
            className="stat-card"
            onClick={() =>
              navigate(
                "/patient/doctors"
              )
            }
          >

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

          </button>

          <button
            type="button"
            className="stat-card"
          >

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

          </button>

        </section>

        {/* ==================================================
            CONTENT
        ================================================== */}

        <section className="dashboard-content-grid">

          {/* ==================================================
              CALENDAR
          ================================================== */}

          <div className="calendar-card">

            <div className="section-header">

              <h2>
                Calendar
              </h2>

              <div className="calendar-header-actions">

                <button
                  type="button"
                  className="book-calendar-button"
                  onClick={() =>
                    openBooking()
                  }
                >
                  + Book Appointment
                </button>

                <button
                  type="button"
                  className="today-button"
                  onClick={
                    goToToday
                  }
                >
                  Today
                </button>

              </div>

            </div>

            {/* ==================================================
                CALENDAR TOOLBAR
            ================================================== */}

            <div className="calendar-toolbar">

              <div className="calendar-navigation">

                <button
                  type="button"
                  onClick={
                    goToPreviousMonth
                  }
                  disabled={
                    calendarView ===
                    "day"
                  }
                  aria-label="Previous month"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={
                    goToNextMonth
                  }
                  disabled={
                    calendarView ===
                    "day"
                  }
                  aria-label="Next month"
                >
                  ›
                </button>

              </div>

              <strong>

                {calendarView ===
                "day"
                  ? "Today"
                  : monthTitle}

              </strong>

              <div className="calendar-view">

                <button
                  type="button"
                  className={
                    calendarView ===
                    "month"
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    setCalendarView(
                      "month"
                    );

                    setShowDayView(
                      false
                    );
                  }}
                >
                  Month
                </button>

                <button
                  type="button"
                  className={
                    calendarView ===
                    "week"
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    setCalendarView(
                      "week"
                    );

                    setShowDayView(
                      false
                    );
                  }}
                >
                  Week
                </button>

                <button
                  type="button"
                  className={
                    calendarView ===
                    "day"
                      ? "selected"
                      : ""
                  }
                  onClick={
                    openTodayDayView
                  }
                >
                  Day
                </button>

              </div>

            </div>

            {/* ==================================================
                MONTH VIEW
            ================================================== */}

            {calendarView ===
              "month" && (

              <>

                <div className="calendar-weekdays">

                  <span>
                    Sun
                  </span>

                  <span>
                    Mon
                  </span>

                  <span>
                    Tue
                  </span>

                  <span>
                    Wed
                  </span>

                  <span>
                    Thu
                  </span>

                  <span>
                    Fri
                  </span>

                  <span>
                    Sat
                  </span>

                </div>

                <div className="calendar-grid">

                  {calendarDays.map(
                    (
                      calendarDay
                    ) => {

                      const dateKey =
                        getDateKey(
                          calendarDay.date
                        );

                      const dayAppointments =
                        getAppointmentsForDate(
                          calendarDay.date
                        );

                      const isToday =
                        dateKey ===
                        todayDate;

                      return (
                        <button
                          type="button"
                          key={dateKey}
                          className={`calendar-day ${
                            calendarDay.currentMonth
                              ? ""
                              : "muted"
                          } ${
                            dayAppointments.length >
                            0
                              ? "has-appointment"
                              : ""
                          } ${
                            isToday
                              ? "today"
                              : ""
                          }`}
                          onClick={() =>
                            openDayView(
                              calendarDay.date
                            )
                          }
                        >

                          <span className="calendar-day-number">
                            {
                              calendarDay.date.getDate()
                            }
                          </span>

                          {dayAppointments.length >
                            0 && (

                            <div className="calendar-appointments">

                              {dayAppointments
                                .slice(
                                  0,
                                  2
                                )
                                .map(
                                  (
                                    appointment
                                  ) => (

                                    <span
                                      key={
                                        appointment.id
                                      }
                                      className="calendar-appointment"
                                      onClick={(
                                        event
                                      ) => {

                                        event.stopPropagation();

                                        openAppointmentDetails(
                                          appointment
                                        );

                                      }}
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

                                    </span>

                                  )
                                )}

                              {dayAppointments.length >
                                2 && (

                                <small>

                                  +
                                  {
                                    dayAppointments.length -
                                    2
                                  }{" "}
                                  more

                                </small>

                              )}

                            </div>

                          )}

                        </button>
                      );
                    }
                  )}

                </div>

              </>

            )}

            {/* ==================================================
                WEEK VIEW
            ================================================== */}

            {calendarView ===
              "week" && (

              <div className="week-calendar-view">

                <div className="week-calendar-grid">

                  {Array.from(
                    {
                      length: 7,
                    },
                    (
                      _,
                      index
                    ) => {

                      const today =
                        new Date();

                      today.setHours(
                        0,
                        0,
                        0,
                        0
                      );

                      const sunday =
                        new Date(
                          today
                        );

                      sunday.setDate(
                        today.getDate() -
                          today.getDay()
                      );

                      const date =
                        new Date(
                          sunday
                        );

                      date.setDate(
                        sunday.getDate() +
                          index
                      );

                      const dateKey =
                        getDateKey(
                          date
                        );

                      const dayAppointments =
                        getAppointmentsForDate(
                          date
                        );

                      const isToday =
                        dateKey ===
                        todayDate;

                      return (
                        <div
                          key={
                            dateKey
                          }
                          className={`week-day-column ${
                            isToday
                              ? "today"
                              : ""
                          }`}
                        >

                          <button
                            type="button"
                            className="week-day-header"
                            onClick={() =>
                              openDayView(
                                date
                              )
                            }
                          >

                            <span>
                              {date.toLocaleDateString(
                                "en-US",
                                {
                                  weekday:
                                    "short",
                                }
                              )}
                            </span>

                            <strong>
                              {date.getDate()}
                            </strong>

                          </button>

                          <div className="week-day-body">

                            {dayAppointments.length ===
                            0 ? (

                              <div className="week-no-appointment">
                                No appointments
                              </div>

                            ) : (

                              dayAppointments.map(
                                (
                                  appointment
                                ) => (

                                  <button
                                    type="button"
                                    key={
                                      appointment.id
                                    }
                                    className="week-calendar-appointment"
                                    onClick={() =>
                                      openAppointmentDetails(
                                        appointment
                                      )
                                    }
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

                                    <small>
                                      {
                                        appointment.status
                                      }
                                    </small>

                                  </button>

                                )
                              )

                            )}

                            <button
                              type="button"
                              className="week-book-button"
                              onClick={() =>
                                openBooking(
                                  dateKey
                                )
                              }
                            >
                              + Book
                            </button>

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>

              </div>

            )}

          </div>

          {/* ==================================================
              UPCOMING
          ================================================== */}

          <div className="upcoming-card">

            <div className="section-header">

              <h2>
                Upcoming Appointments
              </h2>

              <div className="upcoming-header-actions">

                <button
                  type="button"
                  className="book-header-button"
                  onClick={() =>
                    openBooking()
                  }
                >
                  + Book Appointment
                </button>

                <button
                  type="button"
                  className="view-all-button"
                  onClick={
                    () =>
                      setShowAllAppointments(
                        true
                      )
                  }
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
                  type="button"
                  className="book-button"
                  onClick={() =>
                    openBooking()
                  }
                >
                  + Book New Appointment
                </button>

              </div>

            ) : (

              <div className="upcoming-list">

                {upcomingAppointments
                  .slice(
                    0,
                    4
                  )
                  .map(
                    (
                      appointment
                    ) => (

                      <button
                        type="button"
                        className="upcoming-appointment"
                        key={
                          appointment.id
                        }
                        onClick={() =>
                          openAppointmentDetails(
                            appointment
                          )
                        }
                      >

                        <div className="appointment-date-box">

                          <strong>
                            {new Date(
                              `${appointment.appointment_date}T00:00:00`
                            ).toLocaleDateString(
                              "en-US",
                              {
                                month:
                                  "short",
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
                          {
                            appointment.status
                          }
                        </span>

                      </button>

                    )
                  )}

              </div>

            )}

          </div>

        </section>

        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

        <section className="quick-actions-card">

          <div className="section-header">

            <h2>
              Quick Actions
            </h2>

          </div>

          <div className="quick-actions-grid">

            <button
              type="button"
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
              type="button"
              onClick={() =>
                openBooking()
              }
            >

              <span className="quick-icon green">
                ▣
              </span>

              <span>
                Book Appointment
              </span>

            </button>

            <button
              type="button"
            >

              <span className="quick-icon purple">
                ↑
              </span>

              <span>
                Upload Record
              </span>

            </button>

            <button
              type="button"
            >

              <span className="quick-icon orange">
                ▤
              </span>

              <span>
                Health Summary
              </span>

            </button>

          </div>

        </section>

        {/* ==================================================
            THIS WEEK
        ================================================== */}

        <section className="week-card">

          <div className="section-header">

            <h2>
              Upcoming This Week
            </h2>

            <button
              type="button"
              className="view-all-button"
              onClick={
                () =>
                  setShowAllAppointments(
                    true
                  )
              }
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
                (
                  appointment
                ) => (

                  <button
                    type="button"
                    className="week-appointment"
                    key={
                      appointment.id
                    }
                    onClick={() =>
                      openAppointmentDetails(
                        appointment
                      )
                    }
                  >

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

                  </button>

                )
              )}

            </div>

          )}

        </section>

      </main>

      {/* ==================================================
          DAY VIEW POPUP
      ================================================== */}

      {showDayView && (

        <DayView
          selectedDate={
            selectedDate
          }
          appointments={
            appointments
          }
          loading={
            loadingAppointments
          }
          onDateChange={
            handleDayDateChange
          }
          onBook={
            openBooking
          }
          onAppointmentClick={
            openAppointmentDetails
          }
          formatTime={
            formatTime
          }
          onClose={
            closeDayView
          }
        />

      )}

      {/* ==================================================
          BOOKING MODAL
      ================================================== */}

      {showBooking && (

        <div
          className="booking-modal-overlay"
          onMouseDown={(
            event
          ) => {

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
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              className="booking-modal-close"
              onClick={
                closeBooking
              }
              aria-label="Close booking"
            >
              ×
            </button>

            <AppointmentBooking
              initialDate={
                bookingDate
              }
              initialDoctorId={
                bookingDoctorId
              }
              initialStartTime={
                bookingStartTime
              }
              onBookingSuccess={
                handleBookingSuccess
              }
            />

          </div>

        </div>

      )}

      {/* ==================================================
          APPOINTMENT DETAILS
      ================================================== */}

      {selectedAppointment && (

        <div
          className="appointment-details-modal-overlay"
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeAppointmentDetails();
            }

          }}
        >

          <div
            className="appointment-details-modal"
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              className="appointment-details-close"
              onClick={
                closeAppointmentDetails
              }
              aria-label="Close appointment details"
            >
              ×
            </button>

            <p className="appointment-details-label">
              APPOINTMENT DETAILS
            </p>

            <h2>
              {
                selectedAppointment.doctor_name
              }
            </h2>

            <div className="appointment-details-status">
              {
                selectedAppointment.status
              }
            </div>

            <div className="appointment-details-grid">

              <div>

                <span>
                  Date
                </span>

                <strong>
                  {formatDate(
                    selectedAppointment.appointment_date
                  )}
                </strong>

              </div>

              <div>

                <span>
                  Time
                </span>

                <strong>

                  {formatTime(
                    selectedAppointment.start_time
                  )}

                  {" - "}

                  {formatTime(
                    selectedAppointment.end_time
                  )}

                </strong>

              </div>

              <div>

                <span>
                  Appointment Type
                </span>

                <strong>
                  {
                    selectedAppointment.appointment_type
                  }
                </strong>

              </div>

              <div>

                <span>
                  Reason
                </span>

                <strong>
                  {
                    selectedAppointment.reason ||
                    "Not provided"
                  }
                </strong>

              </div>

            </div>

            {selectedAppointment.notes && (

              <div className="appointment-details-notes">

                <span>
                  Notes
                </span>

                <p>
                  {
                    selectedAppointment.notes
                  }
                </p>

              </div>

            )}

            <div className="appointment-details-actions">

              <button
                type="button"
                className="confirmation-cancel"
                onClick={
                  closeAppointmentDetails
                }
              >
                Close
              </button>

              <button
                type="button"
                className="confirmation-submit"
                onClick={() => {

                  const date =
                    selectedAppointment.appointment_date;

                  closeAppointmentDetails();

                  openBooking(
                    date
                  );

                }}
              >
                Book Another
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ==================================================
          ALL APPOINTMENTS
      ================================================== */}

      {showAllAppointments && (

        <div
          className="appointments-modal-overlay"
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              setShowAllAppointments(
                false
              );
            }

          }}
        >

          <div
            className="appointments-modal"
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="appointments-modal-header">

              <div>

                <p>
                  APPOINTMENTS
                </p>

                <h2>
                  All Appointments
                </h2>

                <span>

                  {appointments.length}{" "}

                  appointment

                  {appointments.length !==
                  1
                    ? "s"
                    : ""}

                </span>

              </div>

              <button
                type="button"
                className="appointments-modal-close"
                onClick={() =>
                  setShowAllAppointments(
                    false
                  )
                }
                aria-label="Close appointments"
              >
                ×
              </button>

            </div>

            {loadingAppointments ? (

              <div className="all-appointments-empty">
                Loading appointments...
              </div>

            ) : appointments.length ===
              0 ? (

              <div className="all-appointments-empty">

                <div className="all-empty-icon">
                  ✓
                </div>

                <h3>
                  No appointments yet
                </h3>

                <p>
                  Your booked appointments
                  will appear here.
                </p>

                <button
                  type="button"
                  className="book-button"
                  onClick={() => {

                    setShowAllAppointments(
                      false
                    );

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
                  .sort(
                    (
                      first,
                      second
                    ) =>
                      `${first.appointment_date}T${first.start_time}`.localeCompare(
                        `${second.appointment_date}T${second.start_time}`
                      )
                  )
                  .map(
                    (
                      appointment
                    ) => (

                      <button
                        type="button"
                        className="all-appointment-item"
                        key={
                          appointment.id
                        }
                        onClick={() =>
                          openAppointmentDetails(
                            appointment
                          )
                        }
                      >

                        <div className="all-appointment-date">

                          <strong>
                            {new Date(
                              `${appointment.appointment_date}T00:00:00`
                            ).toLocaleDateString(
                              "en-US",
                              {
                                month:
                                  "short",
                              }
                            )}
                          </strong>

                          <span>
                            {new Date(
                              `${appointment.appointment_date}T00:00:00`
                            ).getDate()}
                          </span>

                        </div>

                        <div className="all-appointment-info">

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
                          {
                            appointment.status
                          }
                        </span>

                      </button>

                    )
                  )}

              </div>

            )}

            <div className="appointments-modal-footer">

              <button
                type="button"
                className="confirmation-cancel"
                onClick={() =>
                  setShowAllAppointments(
                    false
                  )
                }
              >
                Close
              </button>

              <button
                type="button"
                className="confirmation-submit"
                onClick={() => {

                  setShowAllAppointments(
                    false
                  );

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