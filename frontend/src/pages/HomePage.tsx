import React, { useEffect, useState } from "react";
import PublicCalendar from "../components/PublicCalendar";
import API_URL from "../config";
import "./HomePage.css";

interface CalendarDoctor {
  id: number;
  name: string;
  specialization?: string | null;
  department?: string | null;
  profile_photo?: string | null;
  requires_referral: boolean;
}

interface CalendarSlot {
  start_time: string;
  end_time: string;
  status: "available" | "booked" | "break" | "not_available";
}

interface CalendarDay {
  date: string;
  day: string;
  available_slots: number;
  booked_slots: number;
  break_slots: number;
  not_available_slots: number;
  doctors: Record<string, Record<string, CalendarSlot>>;
}

export interface PublicCalendarResponse {
  start_date: string;
  end_date: string;
  doctors: CalendarDoctor[];
  days: Record<string, CalendarDay>;
  time_slots: string[];
}

const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateString: string) => {
  return new Date(`${dateString}T00:00:00`);
};

const formatDateString = (date: Date) => {
  return getLocalDateString(date);
};

/*
 * Fetch 42 days instead of only the selected month's days.
 *
 * This is important for:
 * - Month view
 * - Week view
 * - weeks crossing two months
 * - mini calendar previous/next month dates
 *
 * 42 days is within the backend public-calendar limit.
 */
const getCalendarRange = (dateString: string) => {
  const selectedDate = parseLocalDate(dateString);

  const firstDayOfMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1
  );

  const calendarStart = new Date(firstDayOfMonth);

  // Sunday = 0
  calendarStart.setDate(
    firstDayOfMonth.getDate() - firstDayOfMonth.getDay()
  );

  const calendarEnd = new Date(calendarStart);
  calendarEnd.setDate(calendarStart.getDate() + 41);

  return {
    startDate: formatDateString(calendarStart),
    endDate: formatDateString(calendarEnd),
  };
};

const HomePage: React.FC = () => {
  const [calendarData, setCalendarData] =
    useState<PublicCalendarResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [selectedDate, setSelectedDate] = useState(() =>
    getLocalDateString()
  );

  const fetchCalendar = async (
    dateString: string,
    signal?: AbortSignal
  ) => {
    try {
      setLoading(true);
      setError("");

      const { startDate, endDate } =
        getCalendarRange(dateString);

      const baseUrl =
        API_URL || "http://localhost:8000";

      const response = await fetch(
        `${baseUrl}/public/calendar?start_date=${startDate}&end_date=${endDate}`,
        {
          method: "GET",
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Calendar request failed with status ${response.status}`
        );
      }

      const data: PublicCalendarResponse =
        await response.json();

      setCalendarData(data);
    } catch (err) {
      /*
       * AbortError happens when the user changes dates
       * before the previous request finishes.
       */
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Public calendar error:",
        err
      );

      setCalendarData(null);

      setError(
        "Unable to load appointment calendar. Please try again."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchCalendar(
      selectedDate,
      controller.signal
    );

    return () => {
      controller.abort();
    };
  }, [selectedDate]);

  const handleDateChange = (
    date: string
  ) => {
    setSelectedDate(date);
  };

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleRegister = () => {
    window.location.href = "/register";
  };

  const scrollToCalendar = () => {
    document
      .getElementById("appointment-calendar")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  const scrollToHowItWorks = () => {
    document
      .getElementById("how-it-works")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  return (
    <div className="home-page">
      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="home-header">
        <div className="home-header-inner">
          <button
            type="button"
            className="home-logo"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
            aria-label="HealthCare Plus home"
          >
            <div className="home-logo-mark">
              +
            </div>

            <div className="home-logo-text">
              <span>HealthCare</span>
              <strong>+</strong>
            </div>
          </button>

          <nav className="home-navigation">
            <button
              type="button"
              className="home-nav-link active"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                })
              }
            >
              Home
            </button>

            <button
              type="button"
              className="home-nav-link"
              onClick={scrollToCalendar}
            >
              Calendar
            </button>

            <button
              type="button"
              className="home-nav-link"
              onClick={scrollToHowItWorks}
            >
              About
            </button>

            <button
              type="button"
              className="home-nav-link"
              onClick={scrollToHowItWorks}
            >
              Contact
            </button>
          </nav>

          <div className="home-header-search">
            <span className="home-search-icon">
              ⌕
            </span>

            <input
              type="text"
              placeholder="Search doctors, specialty..."
              aria-label="Search doctors"
            />
          </div>

          <div className="home-header-actions">
            <button
              type="button"
              className="home-login-button"
              onClick={handleLogin}
            >
              Login
            </button>

            <button
              type="button"
              className="home-register-button"
              onClick={handleRegister}
            >
              Register
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ==================================================
            COMPACT HERO
        ================================================== */}

        <section className="home-hero">
          <div className="home-hero-content">
            <div className="home-hero-badge">
              <span>✓</span>
              Quality Care for a Brighter Tomorrow
            </div>

            <h1>
              Book with{" "}
              <span>Confidence.</span>
            </h1>

            <p>
              View all doctors' real-time
              availability in one calendar.
              Choose a date and time that
              works for you.
            </p>

            <div className="home-hero-feature-row">
              <div className="home-hero-feature">
                <span className="hero-feature-icon">
                  ▣
                </span>

                <div>
                  <strong>
                    Real-time Availability
                  </strong>

                  <span>
                    Live updates across all doctors
                  </span>
                </div>
              </div>

              <div className="home-hero-feature">
                <span className="hero-feature-icon">
                  ●
                </span>

                <div>
                  <strong>
                    All Doctors in One View
                  </strong>

                  <span>
                    Compare schedules easily
                  </span>
                </div>
              </div>

              <div className="home-hero-feature">
                <span className="hero-feature-icon">
                  ✓
                </span>

                <div>
                  <strong>
                    Secure Booking
                  </strong>

                  <span>
                    Login or register to book
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="home-hero-visual-content">
              <span>
                Expert Doctors.
              </span>

              <strong>
                Better Care.
              </strong>

              <p>
                Modern healthcare for you
                and your family.
              </p>

              <div className="hero-visual-line" />
            </div>

            <div className="home-hero-hospital">
              <div className="hospital-building">
                <div className="hospital-sign">
                  HealthCare+
                </div>

                <div className="hospital-windows">
                  {Array.from({
                    length: 18,
                  }).map((_, index) => (
                    <span
                      key={index}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="home-hero-quote">
              “ Your Health
              <br />
              Our Priority ”
            </div>
          </div>
        </section>

        {/* ==================================================
            APPOINTMENT CALENDAR
        ================================================== */}

        <section
          id="appointment-calendar"
          className="home-calendar-section"
        >
          <div className="home-calendar-card">
            {loading && (
              <div className="home-calendar-loading">
                <div className="loading-spinner" />

                <p>
                  Loading appointment
                  availability...
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="home-calendar-error">
                <div className="error-icon">
                  !
                </div>

                <h3>
                  Calendar unavailable
                </h3>

                <p>
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    fetchCalendar(
                      selectedDate
                    )
                  }
                >
                  Try Again
                </button>
              </div>
            )}

            {!loading &&
              !error &&
              calendarData && (
                <PublicCalendar
                  data={calendarData}
                  selectedDate={selectedDate}
                  onDateChange={
                    handleDateChange
                  }
                  onLogin={handleLogin}
                  onRegister={handleRegister}
                />
              )}
          </div>
        </section>

        {/* ==================================================
            HOW IT WORKS
        ================================================== */}

        <section
          id="how-it-works"
          className="home-how-it-works"
        >
          <div className="home-section-heading centered">
            <span className="section-eyebrow">
              HOW IT WORKS
            </span>

            <h2>
              Healthcare scheduling made simple
            </h2>

            <p>
              From finding an available slot
              to confirming your appointment.
            </p>
          </div>

          <div className="home-process-grid">
            <div className="home-process-card">
              <div className="process-number">
                01
              </div>

              <div className="process-icon">
                ◷
              </div>

              <h3>
                Check Availability
              </h3>

              <p>
                View schedules and appointment
                availability for all doctors in
                one calendar.
              </p>
            </div>

            <div className="home-process-card">
              <div className="process-number">
                02
              </div>

              <div className="process-icon">
                →
              </div>

              <h3>
                Select a Slot
              </h3>

              <p>
                Choose a suitable date and
                available appointment time.
              </p>
            </div>

            <div className="home-process-card">
              <div className="process-number">
                03
              </div>

              <div className="process-icon">
                ✓
              </div>

              <h3>
                Book Securely
              </h3>

              <p>
                Login or register and continue
                through the appointment
                verification process.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================
            FINAL CTA
        ================================================== */}

        <section className="home-final-cta">
          <div>
            <span className="section-eyebrow">
              BETTER CARE STARTS HERE
            </span>

            <h2>
              Take the next step toward
              better healthcare.
            </h2>

            <p>
              View available appointments
              and schedule your visit when
              it works for you.
            </p>
          </div>

          <div className="home-final-actions">
            <button
              type="button"
              onClick={handleRegister}
              className="home-final-primary"
            >
              Get Started
              <span>→</span>
            </button>

            <button
              type="button"
              onClick={handleLogin}
              className="home-final-secondary"
            >
              Login
            </button>
          </div>
        </section>
      </main>

      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <div className="home-logo">
              <div className="home-logo-mark">
                +
              </div>

              <div className="home-logo-text">
                <span>HealthCare</span>
                <strong>+</strong>
              </div>
            </div>

            <p>
              Making healthcare scheduling
              simple, accessible, and reliable.
            </p>
          </div>

          <div className="home-footer-links">
            <div>
              <strong>
                Platform
              </strong>

              <button
                type="button"
                onClick={scrollToCalendar}
              >
                Calendar
              </button>

              <button
                type="button"
                onClick={handleLogin}
              >
                Login
              </button>

              <button
                type="button"
                onClick={handleRegister}
              >
                Register
              </button>
            </div>

            <div>
              <strong>
                Information
              </strong>

              <button
                type="button"
                onClick={scrollToHowItWorks}
              >
                How It Works
              </button>

              <button
                type="button"
                onClick={() =>
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  })
                }
              >
                Home
              </button>
            </div>
          </div>
        </div>

        <div className="home-footer-bottom">
          <span>
            © {new Date().getFullYear()}{" "}
            HealthCare+. All rights reserved.
          </span>

          <span>
            Secure Healthcare Scheduling
          </span>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;