import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import PublicCalendar from "../components/PublicCalendar";
import API_URL from "../config";
import "./CalendarPage.css";

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
  doctors: Record<string, Record<string, CalendarSlot>>;
}

export interface PublicCalendarResponse {
  start_date: string;
  end_date: string;
  doctors: CalendarDoctor[];
  days: Record<string, CalendarDay>;
  time_slots: string[];
}

/* =========================================================
   DATE HELPERS
========================================================= */

const getLocalDateString = (
  date: Date = new Date()
): string => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseLocalDate = (
  dateString: string
): Date =>
  new Date(`${dateString}T00:00:00`);

const formatDateString = (
  date: Date
): string =>
  getLocalDateString(date);

/*
 * The public calendar API supports an inclusive
 * 42-day window.
 *
 * The range starts on Sunday so the calendar can safely
 * render month grids and adjacent-month days.
 */
const getCalendarRange = (
  dateString: string
) => {
  const selectedDate =
    parseLocalDate(dateString);

  const firstDayOfMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1
  );

  const calendarStart = new Date(
    firstDayOfMonth
  );

  calendarStart.setDate(
    firstDayOfMonth.getDate() -
      firstDayOfMonth.getDay()
  );

  const calendarEnd = new Date(
    calendarStart
  );

  calendarEnd.setDate(
    calendarStart.getDate() + 41
  );

  return {
    startDate:
      formatDateString(calendarStart),
    endDate:
      formatDateString(calendarEnd),
  };
};

/* =========================================================
   SEARCH / FILTER
========================================================= */

const buildFilteredCalendar = (
  data: PublicCalendarResponse,
  query: string
): PublicCalendarResponse => {
  const normalizedQuery =
    query.trim().toLowerCase();

  if (!normalizedQuery) {
    return data;
  }

  const matchingDoctors =
    data.doctors.filter(
      (doctor) =>
        [
          doctor.name,
          doctor.specialization,
          doctor.department,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(
                normalizedQuery
              )
          )
    );

  const filteredDays: Record<
    string,
    CalendarDay
  > = {};

  Object.entries(data.days).forEach(
    ([dateKey, day]) => {
      const doctors: CalendarDay["doctors"] =
        {};

      let availableSlots = 0;
      let bookedSlots = 0;
      let breakSlots = 0;
      let notAvailableSlots = 0;

      matchingDoctors.forEach(
        (doctor) => {
          const doctorSlots =
            day.doctors[
              String(doctor.id)
            ];

          if (!doctorSlots) {
            return;
          }

          doctors[
            String(doctor.id)
          ] = doctorSlots;

          Object.values(
            doctorSlots
          ).forEach((slot) => {
            if (
              slot.status ===
              "available"
            ) {
              availableSlots += 1;
            } else if (
              slot.status ===
              "booked"
            ) {
              bookedSlots += 1;
            } else if (
              slot.status ===
              "break"
            ) {
              breakSlots += 1;
            } else {
              notAvailableSlots += 1;
            }
          });
        }
      );

      filteredDays[dateKey] = {
        ...day,
        available_slots:
          availableSlots,
        booked_slots:
          bookedSlots,
        break_slots:
          breakSlots,
        not_available_slots:
          notAvailableSlots,
        doctors,
      };
    }
  );

  const filteredTimeSlots =
    Array.from(
      new Set(
        Object.values(
          filteredDays
        ).flatMap((day) =>
          Object.values(
            day.doctors
          ).flatMap((slots) =>
            Object.keys(slots)
          )
        )
      )
    ).sort();

  return {
    ...data,
    doctors: matchingDoctors,
    days: filteredDays,
    time_slots:
      filteredTimeSlots,
  };
};

/* =========================================================
   PAGE
========================================================= */

const CalendarPage: React.FC = () => {
  const [
    calendarData,
    setCalendarData,
  ] =
    useState<PublicCalendarResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(() =>
    getLocalDateString()
  );

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(null);

  /*
   * Normalize the configured API URL so both:
   * http://localhost:8000
   * and
   * http://localhost:8000/
   * work correctly.
   */
  const baseUrl = (
    API_URL ||
    "http://localhost:8000"
  ).replace(/\/+$/, "");

  /* =======================================================
     FETCH PUBLIC CALENDAR
  ======================================================= */

  const fetchCalendar =
    useCallback(
      async (
        dateString: string,
        signal?: AbortSignal,
        background = false
      ) => {
        try {
          /*
           * Initial load uses the loading state.
           * Background/live refreshes stay completely silent:
           * the already-rendered calendar remains visible.
           */
          if (!background) {
            setLoading(true);
            setError("");
          }

          const {
            startDate,
            endDate,
          } =
            getCalendarRange(
              dateString
            );

          const params =
            new URLSearchParams({
              start_date: startDate,
              end_date: endDate,
            });

          const response =
            await fetch(
              `${baseUrl}/public/calendar?${params.toString()}`,
              {
                method: "GET",
                headers: {
                  Accept:
                    "application/json",
                },
                signal,
              }
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
              // Keep the friendly fallback message.
            }

            throw new Error(
              detail ||
                `Calendar request failed with status ${response.status}`
            );
          }

          const data: PublicCalendarResponse =
            await response.json();

          if (
            !data ||
            !Array.isArray(
              data.doctors
            ) ||
            !data.days ||
            !Array.isArray(
              data.time_slots
            )
          ) {
            throw new Error(
              "Invalid calendar response."
            );
          }

          setCalendarData(data);
          setLastUpdated(
            new Date()
          );
        } catch (err) {
          if (
            err instanceof DOMException &&
            err.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Public calendar error:",
            err
          );

          if (
            !signal?.aborted &&
            !background
          ) {
            setCalendarData(
              null
            );

            setError(
              err instanceof Error &&
              err.message
                ? err.message
                : "Unable to load appointment calendar. Please try again."
            );
          }
        } finally {
          /*
           * Never toggle the page loading state for a
           * background refresh.
           */
          if (
            !signal?.aborted &&
            !background
          ) {
            setLoading(false);
          }
        }
      },
      [baseUrl]
    );

  /* =======================================================
     INITIAL / DATE CHANGE FETCH
  ======================================================= */

  useEffect(() => {
    const controller =
      new AbortController();

    void fetchCalendar(
      selectedDate,
      controller.signal
    );

    return () =>
      controller.abort();
  }, [
    selectedDate,
    fetchCalendar,
  ]);

  /* =======================================================
     LIVE REFRESH
  ======================================================= */

  useEffect(() => {
    let refreshController:
      | AbortController
      | null = null;

    const refreshCalendar = () => {
      /*
       * Do not create background requests while
       * the browser tab is hidden.
       */
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      /*
       * Cancel the previous live refresh request
       * before starting another one.
       */
      refreshController?.abort();

      refreshController =
        new AbortController();

      void fetchCalendar(
        selectedDate,
        refreshController.signal,
        true
      );
    };

    /*
     * Refresh every 10 seconds while the page
     * is visible.
     *
     * This keeps booking/cancellation changes
     * synchronized with the public calendar.
     */
    const refreshTimer =
      window.setInterval(() => {
        refreshCalendar();
      }, 10_000);

    /*
     * If the user returns to this tab, refresh
     * immediately instead of waiting for the
     * next 10-second interval.
     */
    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          refreshCalendar();
        } else {
          refreshController?.abort();
          refreshController = null;
        }
      };

    /*
     * Refresh when the browser window receives
     * focus again.
     */
    const handleWindowFocus =
      () => {
        refreshCalendar();
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener(
      "focus",
      handleWindowFocus
    );

    return () => {
      window.clearInterval(
        refreshTimer
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus
      );

      refreshController?.abort();
    };
  }, [
    selectedDate,
    fetchCalendar,
  ]);

  /* =======================================================
     FILTERED DATA
  ======================================================= */

  const visibleCalendarData =
    useMemo(
      () =>
        calendarData
          ? buildFilteredCalendar(
              calendarData,
              searchQuery
            )
          : null,
      [
        calendarData,
        searchQuery,
      ]
    );

  const matchingDoctorCount =
    visibleCalendarData
      ?.doctors.length ?? 0;

  const totalDoctorCount =
    calendarData?.doctors.length ??
    0;

  /* =======================================================
     ACTIONS
  ======================================================= */

  const handleDateChange = (
    date: string
  ) => {
    if (!date) {
      return;
    }

    setSelectedDate(date);
  };

  const handleLogin = () => {
    window.location.assign(
      "/login"
    );
  };

  const handleRegister = () => {
    window.location.assign(
      "/register"
    );
  };

  const scrollTo = (
    id: string
  ) => {
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  const scrollToHome = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      event.key === "Escape"
    ) {
      setSearchQuery("");
      event.currentTarget.blur();
    }
  };

  const formatLastUpdated = (
    date: Date | null
  ) => {
    if (!date) {
      return "Waiting for live data";
    }

    return `Updated ${date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    )}`;
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className="home-page"
      id="home-top"
    >
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="home-header">
        <div className="home-header-inner">
          <button
            type="button"
            className="home-logo"
            onClick={scrollToHome}
            aria-label="HealthCare Plus home"
          >
            <div className="home-logo-mark">
              +
            </div>

            <div className="home-logo-text">
              <span>
                HealthCare
              </span>

              <strong>+</strong>
            </div>
          </button>

          <nav
            className="home-navigation"
            aria-label="Primary navigation"
          >
            <button
              type="button"
              className="home-nav-link active"
              onClick={
                scrollToHome
              }
            >
              Home
            </button>

            <button
              type="button"
              className="home-nav-link"
              onClick={() =>
                scrollTo(
                  "appointment-calendar"
                )
              }
            >
              Calendar
            </button>

            <button
              type="button"
              className="home-nav-link"
              onClick={() =>
                scrollTo(
                  "how-it-works"
                )
              }
            >
              About
            </button>

            <button
              type="button"
              className="home-nav-link"
              onClick={() =>
                scrollTo(
                  "contact"
                )
              }
            >
              Contact
            </button>
          </nav>

          <div className="home-header-search">
            <span
              className="home-search-icon"
              aria-hidden="true"
            >
              ⌕
            </span>

            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              onKeyDown={
                handleSearchKeyDown
              }
              placeholder="Search doctors, specialty..."
              aria-label="Search doctors or specialty"
            />

            {searchQuery && (
              <button
                type="button"
                className="home-search-clear"
                onClick={() =>
                  setSearchQuery("")
                }
                aria-label="Clear doctor search"
              >
                ×
              </button>
            )}
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
              onClick={
                handleRegister
              }
            >
              Register
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main>
        {/* =================================================
            HERO
        ================================================= */}

        <section className="home-hero">
          <div className="home-hero-content">
            <div className="home-hero-badge">
              <span>✓</span>
              Quality Care for a Brighter Tomorrow
            </div>

            <h1>
              Book with{" "}
              <span>
                Confidence.
              </span>
            </h1>

            <p>
              Explore live appointment
              availability across active
              doctors, compare schedules,
              and choose a time that works
              for you.
            </p>

            <div className="home-hero-feature-row">
              <div className="home-hero-feature">
                <span className="hero-feature-icon">
                  ▣
                </span>

                <div>
                  <strong>
                    Live Availability
                  </strong>

                  <span>
                    Refreshes automatically
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
                    Search by name or specialty
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
                Modern healthcare
                scheduling for you and
                your family.
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
                  }).map(
                    (_, index) => (
                      <span
                        key={index}
                      />
                    )
                  )}
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

        {/* =================================================
            CALENDAR
        ================================================= */}

        <section
          id="appointment-calendar"
          className="home-calendar-section"
          aria-labelledby="calendar-heading"
        >
          <div className="calendar-section-toolbar">
            <div>
              <span className="section-eyebrow">
                APPOINTMENT SCHEDULING
              </span>

              <h2 id="calendar-heading">
                Find the right time for your care
              </h2>

              <p>
                Search doctors or
                specialties and explore
                current availability.
              </p>
            </div>

            <div className="calendar-live-indicator">
              <span className="calendar-live-dot" />

              <div>
                <strong>
                  Live availability
                </strong>

                <span>
                  {formatLastUpdated(
                    lastUpdated
                  )}
                </span>
              </div>

              <button
                type="button"
                className="calendar-refresh-button"
                onClick={() =>
                  void fetchCalendar(
                    selectedDate,
                    undefined,
                    true
                  )
                }
              >
                Refresh
              </button>
            </div>
          </div>

          {calendarData &&
            searchQuery && (
              <div className="calendar-search-summary">
                <span>
                  Showing{" "}
                  <strong>
                    {matchingDoctorCount}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {totalDoctorCount}
                  </strong>{" "}
                  doctors for "
                  {searchQuery.trim()}"
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery("")
                  }
                >
                  Clear search
                </button>
              </div>
            )}

          <div className="home-calendar-card">
            {loading &&
              !calendarData && (
                <div className="home-calendar-loading">
                  <div className="loading-spinner" />

                  <p>
                    Loading appointment
                    availability...
                  </p>
                </div>
              )}

            {!loading &&
              error && (
                <div className="home-calendar-error">
                  <div className="error-icon">
                    !
                  </div>

                  <h3>
                    Calendar unavailable
                  </h3>

                  <p>{error}</p>

                  <button
                    type="button"
                    onClick={() =>
                      void fetchCalendar(
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
              visibleCalendarData &&
              visibleCalendarData
                .doctors.length >
                0 && (
                <PublicCalendar
                  data={
                    visibleCalendarData
                  }
                  selectedDate={
                    selectedDate
                  }
                  onDateChange={
                    handleDateChange
                  }
                  onLogin={
                    handleLogin
                  }
                  onRegister={
                    handleRegister
                  }
                />
              )}

            {!loading &&
              !error &&
              visibleCalendarData &&
              visibleCalendarData
                .doctors.length ===
                0 && (
                <div className="calendar-no-results">
                  <div className="no-results-icon">
                    ⌕
                  </div>

                  <h3>
                    No matching doctors
                  </h3>

                  <p>
                    Try a different
                    doctor name,
                    specialty, or
                    department.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setSearchQuery("")
                    }
                  >
                    Show all doctors
                  </button>
                </div>
              )}
          </div>
        </section>

        {/* =================================================
            HOW IT WORKS
        ================================================= */}

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
              From finding an available
              slot to confirming your
              appointment.
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
                View current schedules
                and appointment
                availability for active
                doctors in one calendar.
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
                Choose a suitable date
                and an available
                appointment time.
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
                Login or register and
                continue through the
                appointment booking
                process.
              </p>
            </div>
          </div>
        </section>

        {/* =================================================
            CTA
        ================================================= */}

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
              Explore available
              appointments and schedule
              your visit when it works
              for you.
            </p>
          </div>

          <div className="home-final-actions">
            <button
              type="button"
              onClick={
                handleRegister
              }
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

      {/* ===================================================
          FOOTER
      =================================================== */}

      <footer
        className="home-footer"
        id="contact"
      >
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <button
              type="button"
              className="home-logo"
              onClick={scrollToHome}
              aria-label="HealthCare Plus home"
            >
              <div className="home-logo-mark">
                +
              </div>

              <div className="home-logo-text">
                <span>
                  HealthCare
                </span>

                <strong>+</strong>
              </div>
            </button>

            <p>
              Making healthcare
              scheduling simple,
              accessible, and reliable.
            </p>
          </div>

          <div className="home-footer-links">
            <div>
              <strong>
                Platform
              </strong>

              <button
                type="button"
                onClick={() =>
                  scrollTo(
                    "appointment-calendar"
                  )
                }
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
                onClick={
                  handleRegister
                }
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
                onClick={() =>
                  scrollTo(
                    "how-it-works"
                  )
                }
              >
                How It Works
              </button>

              <button
                type="button"
                onClick={
                  scrollToHome
                }
              >
                Home
              </button>
            </div>
          </div>
        </div>

        <div className="home-footer-bottom">
          <span>
            ©{" "}
            {new Date().getFullYear()}{" "}
            HealthCare+. All rights
            reserved.
          </span>

          <span>
            Secure Healthcare
            Scheduling
          </span>
        </div>
      </footer>
    </div>
  );
};

export default CalendarPage;