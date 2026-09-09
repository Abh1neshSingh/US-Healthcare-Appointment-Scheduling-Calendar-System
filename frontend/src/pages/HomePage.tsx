import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import homeDoctor from "../assets/home-doctor.png";
import "./HomePage.css";

interface HomeStats {
  doctors: number;
  available_slots: number;
  booked_slots: number;
  break_slots: number;
  not_available_slots: number;
}

interface PublicHomeResponse {
  date: string;
  stats: HomeStats;
  specialties: string[];
}

interface CalendarDoctor {
  id: number;
  name: string;
  specialization?: string | null;
  department?: string | null;
  profile_photo?: string | null;
  requires_referral?: boolean | null;
}

interface CalendarSlot {
  start_time: string;
  end_time: string;
  status: "available" | "booked" | "break" | "not_available";
}

interface PublicCalendarDay {
  date: string;
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
  days: Record<string, PublicCalendarDay>;
  time_slots: string[];
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const [homeData, setHomeData] =
    useState<PublicHomeResponse | null>(null);

  const [calendarData, setCalendarData] =
    useState<PublicCalendarResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadingDoctors, setLoadingDoctors] =
    useState(true);

  const [doctorError, setDoctorError] =
    useState("");

  const [doctorSearch, setDoctorSearch] =
    useState("");

  const [selectedDoctor, setSelectedDoctor] =
    useState<CalendarDoctor | null>(null);

  const [search, setSearch] = useState("");

  const [mobileMenu, setMobileMenu] =
    useState(false);

  /*
   * The provider directory is intentionally kept inside
   * a modal instead of rendering the complete directory
   * directly on the landing page.
   *
   * This keeps the home page clean while still allowing
   * the user to access the complete live provider list.
   */
  const [directoryOpen, setDirectoryOpen] =
    useState(false);

  /*
   * Directory can be opened directly on either tab.
   */
  const [directoryTab, setDirectoryTab] =
    useState<"doctors" | "specialties">(
      "doctors",
    );

  /*
   * Booking is protected behind an account gateway.
   *
   * Existing patient:
   *      Login
   *
   * New patient:
   *      Register
   *
   * No anonymous booking is started from this page.
   */
  const [accountGatewayOpen, setAccountGatewayOpen] =
    useState(false);

  /*
   * =========================================================
   * LOAD HOME DATA
   * =========================================================
   *
   * This remains connected to the real public home API.
   * No dashboard statistics are hardcoded here.
   */

  useEffect(() => {
    const controller = new AbortController();

    const loadHome = async () => {
      try {
        const baseUrl =
          API_URL || "http://localhost:8000";

        const response = await fetch(
          `${baseUrl}/public/home`,
          {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `Home API returned ${response.status}`,
          );
        }

        const result: PublicHomeResponse =
          await response.json();

        setHomeData(result);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Failed to load home data:",
          error,
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadHome();

    return () => controller.abort();
  }, []);

  /*
   * =========================================================
   * LOAD LIVE DOCTOR DIRECTORY
   * =========================================================
   *
   * Doctors are loaded from the existing public calendar
   * endpoint for today's date.
   *
   * The same data is used inside the directory modal.
   */

  useEffect(() => {
    const controller = new AbortController();

    const loadDoctors = async () => {
      try {
        setLoadingDoctors(true);
        setDoctorError("");

        const baseUrl =
          API_URL || "http://localhost:8000";

        const today = new Date();

        const dateKey = [
          today.getFullYear(),
          String(
            today.getMonth() + 1,
          ).padStart(2, "0"),
          String(
            today.getDate(),
          ).padStart(2, "0"),
        ].join("-");

        const response = await fetch(
          `${baseUrl}/public/calendar?start_date=${dateKey}&end_date=${dateKey}`,
          {
            method: "GET",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `Doctor directory returned ${response.status}`,
          );
        }

        const result: PublicCalendarResponse =
          await response.json();

        if (!Array.isArray(result.doctors)) {
          throw new Error(
            "Invalid doctor directory response.",
          );
        }

        setCalendarData(result);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Failed to load public doctor directory:",
          error,
        );

        setDoctorError(
          "Doctor directory is temporarily unavailable.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDoctors(false);
        }
      }
    };

    void loadDoctors();

    return () => controller.abort();
  }, []);

  /*
   * =========================================================
   * LIVE DATA HELPERS
   * =========================================================
   */

  const doctors =
    calendarData?.doctors ?? [];

  /*
   * Filter doctor records according to the search box.
   */
  const filteredDoctors = useMemo(() => {
    const query =
      doctorSearch.trim().toLowerCase();

    if (!query) {
      return doctors;
    }

    return doctors.filter((doctor) =>
      [
        doctor.name,
        doctor.specialization,
        doctor.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [
    doctors,
    doctorSearch,
  ]);

  /*
   * Return today's slots for a particular doctor.
   */
  const getTodayDoctorSlots = (
    doctorId: number,
  ): CalendarSlot[] => {
    const todayKey =
      calendarData?.start_date;

    if (
      !todayKey ||
      !calendarData
    ) {
      return [];
    }

    return Object.values(
      calendarData.days[
        todayKey
      ]?.doctors?.[
        String(doctorId)
      ] ?? {},
    );
  };

  /*
   * Count currently available slots.
   */
  const getAvailableSlotCount = (
    doctorId: number,
  ) =>
    getTodayDoctorSlots(
      doctorId,
    ).filter(
      (slot) =>
        slot.status === "available",
    ).length;

  /*
   * Calculate specialty counts dynamically
   * from the live doctor directory.
   */
  const specialtyDoctorCount = useMemo(() => {
    const counts =
      new Map<string, number>();

    doctors.forEach((doctor) => {
      const specialty =
        doctor.specialization?.trim() ||
        doctor.department?.trim() ||
        "General Care";

      counts.set(
        specialty,
        (counts.get(specialty) ?? 0) + 1,
      );
    });

    return counts;
  }, [doctors]);

  /*
   * =========================================================
   * NAVIGATION
   * =========================================================
   */

  const openDoctorDirectory = (
    tab:
      | "doctors"
      | "specialties" = "doctors",
  ) => {
    setMobileMenu(false);
    setDirectoryTab(tab);
    setDirectoryOpen(true);
  };

  const closeDoctorDirectory = () => {
    setDirectoryOpen(false);
  };

  /*
   * Every booking action on this page comes here first.
   */
  const openBookingGateway = () => {
    setMobileMenu(false);
    setAccountGatewayOpen(true);
  };

  const closeBookingGateway = () => {
    setAccountGatewayOpen(false);
  };

  /*
   * Appointment calendar remains a discovery route.
   * Actual booking inside protected calendar flow is
   * handled by the authenticated appointment flow.
   */
  const goCalendar = () => {
    setMobileMenu(false);
    navigate("/calendar");
  };

  const goLogin = () => {
    setMobileMenu(false);
    navigate("/login");
  };

  const goRegister = () => {
    setMobileMenu(false);
    navigate("/register");
  };

  const scrollToSection = (
    id: string,
  ) => {
    setMobileMenu(false);

    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
      });
  };

  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

  return (
    <div className="calendar-style-home">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="home-header">

        <div className="home-header-inner">

          {/* -------------------------------------------------
              BRAND
          ------------------------------------------------- */}

          <button
            type="button"
            className="home-brand"
            onClick={() =>
              scrollToSection(
                "home-top",
              )
            }
          >

            <span className="home-brand-icon">
              +
            </span>

            <span className="home-brand-copy">

              <strong>
                HealthCare
                <span>+</span>
              </strong>

              <small>
                Better Care. Brighter Tomorrow.
              </small>

            </span>

          </button>

          {/* -------------------------------------------------
              NAVIGATION
          ------------------------------------------------- */}

          <nav
            className={`home-navigation ${
              mobileMenu
                ? "home-navigation-open"
                : ""
            }`}
          >

            <button
              type="button"
              className="home-nav-active"
              onClick={() =>
                scrollToSection(
                  "home-top",
                )
              }
            >
              Home
            </button>

            <button
              type="button"
              onClick={() =>
                openDoctorDirectory(
                  "doctors",
                )
              }
            >
              Find a Doctor
            </button>

            <button
              type="button"
              onClick={() =>
                scrollToSection(
                  "how-it-works",
                )
              }
            >
              How It Works
            </button>

            <button
              type="button"
              onClick={() =>
                scrollToSection(
                  "about-healthcare",
                )
              }
            >
              About
            </button>

            <button
              type="button"
              onClick={() =>
                scrollToSection(
                  "contact-healthcare",
                )
              }
            >
              Contact
            </button>

          </nav>

          {/* -------------------------------------------------
              HEADER SEARCH
          ------------------------------------------------- */}

          <div className="home-search">

            <span>
              ⌕
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {

                if (
                  event.key ===
                  "Enter"
                ) {
                  setDoctorSearch(
                    search,
                  );

                  openDoctorDirectory(
                    "doctors",
                  );
                }

              }}
              placeholder="Search doctors, specialty..."
              aria-label="Search doctors or specialty"
            />

          </div>

          {/* -------------------------------------------------
              AUTH
          ------------------------------------------------- */}

          <div className="home-auth">

            <button
              type="button"
              className="home-login"
              onClick={goLogin}
            >
              Login
            </button>

            <button
              type="button"
              className="home-register"
              onClick={goRegister}
            >
              Register
            </button>

          </div>

          {/* -------------------------------------------------
              MOBILE MENU
          ------------------------------------------------- */}

          <button
            type="button"
            className="home-mobile-button"
            onClick={() =>
              setMobileMenu(
                (value) => !value,
              )
            }
            aria-label="Open navigation"
            aria-expanded={mobileMenu}
          >
            ☰
          </button>

        </div>

      </header>

      <main id="home-top">

        {/* =====================================================
            HERO
        ===================================================== */}

        <section className="calendar-home-hero">

          <div className="calendar-home-hero-inner">

            {/* -------------------------------------------------
                HERO COPY
            ------------------------------------------------- */}

            <div className="calendar-home-copy">

              <div className="calendar-home-eyebrow">

                <span>
                  ✓
                </span>

                QUALITY CARE FOR A BRIGHTER TOMORROW

              </div>

              <h1>
                Book with{" "}
                <span>
                  Confidence.
                </span>
              </h1>

              <p>
                Find trusted doctors and choose
                an appointment time that works
                for you. Simple, clear, and secure
                healthcare scheduling.
              </p>

              {/* -------------------------------------------------
                  HERO FEATURES
              ------------------------------------------------- */}

              <div className="calendar-home-features">

                <div className="calendar-home-feature">

                  <span className="calendar-feature-icon">
                    ▣
                  </span>

                  <div>

                    <strong>
                      Easy Scheduling
                    </strong>

                    <small>
                      Find an appointment with ease
                    </small>

                  </div>

                </div>

                <div className="calendar-home-feature">

                  <span className="calendar-feature-icon">
                    ●
                  </span>

                  <div>

                    <strong>
                      Multiple Doctors
                    </strong>

                    <small>
                      Explore providers in one place
                    </small>

                  </div>

                </div>

                <div className="calendar-home-feature">

                  <span className="calendar-feature-icon">
                    ✓
                  </span>

                  <div>

                    <strong>
                      Secure Booking
                    </strong>

                    <small>
                      Login or register to book
                    </small>

                  </div>

                </div>

              </div>

              {/* -------------------------------------------------
                  HERO ACTIONS
              ------------------------------------------------- */}

              <div className="calendar-home-actions">

                <button
                  type="button"
                  className="calendar-primary-button"
                  onClick={goCalendar}
                >
                  Find an Appointment

                  <span>
                    →
                  </span>
                </button>

                <button
                  type="button"
                  className="calendar-secondary-button"
                  onClick={
                    openBookingGateway
                  }
                >
                  Book an Appointment
                </button>

                <button
                  type="button"
                  className="calendar-tertiary-button"
                  onClick={() =>
                    openDoctorDirectory(
                      "doctors",
                    )
                  }
                >
                  View Doctors →
                </button>

              </div>

            </div>

            {/* =================================================
                HERO IMAGE
            ================================================= */}

            <div className="calendar-home-visual">

              <div className="calendar-visual-copy">

                <span>
                  Expert Doctors.
                </span>

                <strong>
                  Better Care.
                </strong>

                <small>
                  Modern healthcare for
                  you and your family.
                </small>

                <i />

              </div>

              <div className="calendar-quote">
                “ Your Health
                <br />
                Our Priority ”
              </div>

              <img
                src={homeDoctor}
                alt="Healthcare professional"
                className="calendar-home-image"
              />

            </div>

          </div>

        </section>

        {/* =====================================================
            STATS
        ===================================================== */}

        <section className="home-stat-strip">

          <div className="home-stat-inner">

            <div className="home-stat-item">

              <strong>
                {loading
                  ? "—"
                  : homeData
                      ?.stats
                      .doctors ??
                    0}
              </strong>

              <span>
                Doctors available
              </span>

            </div>

            <div className="home-stat-item">

              <strong>
                {loading
                  ? "—"
                  : homeData
                      ?.stats
                      .available_slots ??
                    0}
              </strong>

              <span>
                Available slots today
              </span>

            </div>

            <div className="home-stat-item">

              <strong>
                {loading
                  ? "—"
                  : homeData
                      ?.stats
                      .booked_slots ??
                    0}
              </strong>

              <span>
                Appointments today
              </span>

            </div>

            <div className="home-stat-item">

              <strong>
                {loadingDoctors
                  ? "—"
                  : specialtyDoctorCount.size}
              </strong>

              <span>
                Active specialties
              </span>

            </div>

          </div>

        </section>

        {/* =====================================================
            HOW IT WORKS
        ===================================================== */}

        <section
          id="how-it-works"
          className="home-how"
        >

          <div className="home-section-heading">

            <span>
              HOW IT WORKS
            </span>

            <h2>
              A simpler way to book
              your appointment.
            </h2>

            <p>
              Find a doctor, check availability,
              and choose your appointment time
              in just a few simple steps.
            </p>

          </div>

          <div className="home-step-grid">

            <article className="home-step-card">

              <div className="home-step-number">
                01
              </div>

              <div className="home-step-icon">
                ⌕
              </div>

              <h3>
                Find a Doctor
              </h3>

              <p>
                Search doctors by name,
                specialty, or department.
              </p>

            </article>

            <article className="home-step-card">

              <div className="home-step-number">
                02
              </div>

              <div className="home-step-icon">
                ◷
              </div>

              <h3>
                Check Availability
              </h3>

              <p>
                View the calendar and select
                a convenient appointment time.
              </p>

            </article>

            <article className="home-step-card">

              <div className="home-step-number">
                03
              </div>

              <div className="home-step-icon">
                ✓
              </div>

              <h3>
                Book Securely
              </h3>

              <p>
                Login or register and
                securely complete your booking.
              </p>

            </article>

          </div>

        </section>

        {/* =====================================================
            DIRECTORY ACCESS
        =====================================================

            IMPORTANT:
            The complete doctor list and specialty list are NOT
            rendered directly on the home page.

            Only the access panel is shown.

            Clicking View Doctors opens the provider directory
            modal.

            Clicking Browse Specialties opens the specialty
            tab in the same modal.
        ===================================================== */}

        <section
          id="home-directory"
          className="home-directory-access"
        >

          <div className="home-directory-access-inner">

            {/* -------------------------------------------------
                DIRECTORY INTRO
            ------------------------------------------------- */}

            <div className="home-directory-access-copy">

              <span className="home-directory-kicker">
                FIND THE RIGHT CARE
              </span>

              <h2>
                Explore doctors and specialties
                <span>
                  {" "}in one place.
                </span>
              </h2>

              <p>
                Browse the live provider directory
                or explore available healthcare
                specialties without leaving the
                home page.
              </p>

              {/* -------------------------------------------------
                  DIRECTORY ACTION BUTTONS
              ------------------------------------------------- */}

              <div className="home-directory-actions">

                <button
                  type="button"
                  className="home-directory-primary"
                  onClick={() =>
                    openDoctorDirectory(
                      "doctors",
                    )
                  }
                >

                  <span className="home-directory-button-icon">
                    +
                  </span>

                  <span>

                    <strong>
                      View Doctors
                    </strong>

                    <small>
                      Browse the live provider directory
                    </small>

                  </span>

                  <b>
                    →
                  </b>

                </button>

                <button
                  type="button"
                  className="home-directory-secondary"
                  onClick={() =>
                    openDoctorDirectory(
                      "specialties",
                    )
                  }
                >

                  <span className="home-directory-button-icon">
                    #
                  </span>

                  <span>

                    <strong>
                      Browse Specialties
                    </strong>

                    <small>
                      Find care by specialty
                    </small>

                  </span>

                  <b>
                    →
                  </b>

                </button>

              </div>

            </div>

            {/* -------------------------------------------------
                LIVE DIRECTORY SUMMARY
            ------------------------------------------------- */}

            <div className="home-directory-summary">

              <div className="home-directory-summary-head">

                <span>
                  LIVE DIRECTORY
                </span>

                <i>

                  <em />

                  Updated from scheduling data

                </i>

              </div>

              <div className="home-directory-summary-grid">

                <div>

                  <strong>
                    {loadingDoctors
                      ? "—"
                      : doctors.length}
                  </strong>

                  <span>
                    Active doctors
                  </span>

                </div>

                <div>

                  <strong>
                    {loadingDoctors
                      ? "—"
                      : specialtyDoctorCount.size}
                  </strong>

                  <span>
                    Specialties
                  </span>

                </div>

                <div>

                  <strong>
                    {loading
                      ? "—"
                      : homeData
                          ?.stats
                          .available_slots ??
                        0}
                  </strong>

                  <span>
                    Open slots today
                  </span>

                </div>

              </div>

              <div className="home-directory-summary-note">

                <span>
                  SECURE ACCESS
                </span>

                <p>
                  You can explore public provider
                  information before signing in.
                  Booking requires a patient account.
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =====================================================
            DIRECTORY MODAL
        =====================================================

            This is the replacement for the old direct
            doctor/specialty sections.

            Everything here is live data.
        ===================================================== */}

        {directoryOpen && (

          <div
            className="home-directory-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {

              if (
                event.target ===
                event.currentTarget
              ) {
                closeDoctorDirectory();
              }

            }}
          >

            <section
              className="home-directory-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="home-directory-title"
            >

              {/* -------------------------------------------------
                  MODAL HEADER
              ------------------------------------------------- */}

              <div className="home-directory-modal-header">

                <div>

                  <span>
                    HEALTHCARE DIRECTORY
                  </span>

                  <h2
                    id="home-directory-title"
                  >
                    Find your care team
                  </h2>

                  <p>
                    Live provider and specialty
                    information from the current
                    scheduling directory.
                  </p>

                </div>

                <button
                  type="button"
                  className="home-directory-modal-close"
                  onClick={
                    closeDoctorDirectory
                  }
                  aria-label="Close healthcare directory"
                >
                  ×
                </button>

              </div>

              {/* -------------------------------------------------
                  MODAL TOOLBAR
              ------------------------------------------------- */}

              <div className="home-directory-modal-toolbar">

                <div
                  className="home-directory-tabs"
                  role="tablist"
                  aria-label="Healthcare directory"
                >

                  <button
                    type="button"
                    role="tab"
                    aria-selected={
                      directoryTab ===
                      "doctors"
                    }
                    className={
                      directoryTab ===
                      "doctors"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setDirectoryTab(
                        "doctors",
                      )
                    }
                  >

                    Doctors

                    <span>
                      {loadingDoctors
                        ? "—"
                        : doctors.length}
                    </span>

                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={
                      directoryTab ===
                      "specialties"
                    }
                    className={
                      directoryTab ===
                      "specialties"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setDirectoryTab(
                        "specialties",
                      )
                    }
                  >

                    Specialties

                    <span>
                      {loadingDoctors
                        ? "—"
                        : specialtyDoctorCount.size}
                    </span>

                  </button>

                </div>

                {/* -------------------------------------------------
                    DOCTOR SEARCH
                ------------------------------------------------- */}

                {directoryTab ===
                  "doctors" && (

                  <label className="home-directory-modal-search">

                    <span
                      aria-hidden="true"
                    >
                      ⌕
                    </span>

                    <input
                      type="search"
                      value={
                        doctorSearch
                      }
                      onChange={(event) =>
                        setDoctorSearch(
                          event.target.value,
                        )
                      }
                      placeholder="Search by doctor, specialty or department"
                      aria-label="Search doctors"
                    />

                    {doctorSearch && (

                      <button
                        type="button"
                        onClick={() =>
                          setDoctorSearch("")
                        }
                        aria-label="Clear doctor search"
                      >
                        ×
                      </button>

                    )}

                  </label>

                )}

              </div>

              {/* =================================================
                  MODAL BODY
              ================================================= */}

              <div className="home-directory-modal-body">

                {/* =================================================
                    DOCTOR TAB
                ================================================= */}

                {directoryTab ===
                  "doctors" && (

                  <>

                    {/* ---------------------------------------------
                        LOADING
                    --------------------------------------------- */}

                    {loadingDoctors && (

                      <div className="home-directory-state">

                        <span className="home-state-spinner" />

                        <strong>
                          Loading provider directory
                        </strong>

                        <p>
                          Fetching the current
                          active doctors and
                          today's availability.
                        </p>

                      </div>

                    )}

                    {/* ---------------------------------------------
                        ERROR
                    --------------------------------------------- */}

                    {!loadingDoctors &&
                      doctorError && (

                      <div className="home-directory-state error">

                        <strong>
                          Provider directory unavailable
                        </strong>

                        <p>
                          {doctorError}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            goCalendar()
                          }
                        >
                          Open calendar
                        </button>

                      </div>

                    )}

                    {/* ---------------------------------------------
                        EMPTY SEARCH
                    --------------------------------------------- */}

                    {!loadingDoctors &&
                      !doctorError &&
                      filteredDoctors.length ===
                        0 && (

                      <div className="home-directory-state">

                        <strong>
                          No doctors found
                        </strong>

                        <p>
                          Try another doctor
                          name, specialty or
                          department.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            setDoctorSearch("")
                          }
                        >
                          Clear search
                        </button>

                      </div>

                    )}

                    {/* ---------------------------------------------
                        DOCTOR GRID
                    --------------------------------------------- */}

                    {!loadingDoctors &&
                      !doctorError &&
                      filteredDoctors.length >
                        0 && (

                      <div className="home-directory-doctor-grid">

                        {filteredDoctors.map(
                          (doctor) => {

                            const available =
                              getAvailableSlotCount(
                                doctor.id,
                              );

                            const initials =
                              doctor.name
                                .trim()
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map(
                                  (part) =>
                                    part[0],
                                )
                                .join("")
                                .toUpperCase();

                            return (

                              <article
                                className="home-directory-doctor-card"
                                key={
                                  doctor.id
                                }
                              >

                                {/* ---------------------------------
                                    DOCTOR TOP
                                --------------------------------- */}

                                <div className="home-directory-doctor-top">

                                  <div className="home-directory-doctor-avatar">

                                    {doctor.profile_photo ? (

                                      <img
                                        src={
                                          doctor.profile_photo
                                        }
                                        alt=""
                                      />

                                    ) : (

                                      initials

                                    )}

                                  </div>

                                  <span className="home-directory-doctor-status">

                                    <i />

                                    Active

                                  </span>

                                </div>

                                {/* ---------------------------------
                                    DOCTOR CONTENT
                                --------------------------------- */}

                                <div className="home-directory-doctor-content">

                                  <span className="home-directory-doctor-specialty">

                                    {doctor.specialization ||
                                      doctor.department ||
                                      "Healthcare Provider"}

                                  </span>

                                  <h3>
                                    {doctor.name}
                                  </h3>

                                  <p>
                                    {doctor.department ||
                                      doctor.specialization ||
                                      "Provider"}
                                  </p>

                                </div>

                                {/* ---------------------------------
                                    DOCTOR DATA
                                --------------------------------- */}

                                <div className="home-directory-doctor-data">

                                  <div>

                                    <span>
                                      Today
                                    </span>

                                    <strong>

                                      {available >
                                      0
                                        ? `${available} open slot${
                                            available ===
                                            1
                                              ? ""
                                              : "s"
                                          }`
                                        : "No open slots"}

                                    </strong>

                                  </div>

                                  <div>

                                    <span>
                                      Referral
                                    </span>

                                    <strong>

                                      {doctor.requires_referral
                                        ? "Required"
                                        : "Not required"}

                                    </strong>

                                  </div>

                                </div>

                                {/* ---------------------------------
                                    DOCTOR ACTIONS
                                --------------------------------- */}

                                <div className="home-directory-doctor-actions">

                                  <button
                                    type="button"
                                    className="home-directory-profile-button"
                                    onClick={() =>
                                      setSelectedDoctor(
                                        doctor,
                                      )
                                    }
                                  >
                                    View Profile
                                  </button>

                                  <button
                                    type="button"
                                    className="home-directory-book-button"
                                    onClick={
                                      openBookingGateway
                                    }
                                  >
                                    Book
                                  </button>

                                </div>

                              </article>

                            );

                          },
                        )}

                      </div>

                    )}

                  </>

                )}

                {/* =================================================
                    SPECIALTY TAB
                ================================================= */}

                {directoryTab ===
                  "specialties" && (

                  <div className="home-directory-specialties-panel">

                    <div className="home-directory-specialties-intro">

                      <span>
                        SPECIALTY DIRECTORY
                      </span>

                      <h3>
                        Choose a healthcare specialty
                      </h3>

                      <p>
                        Specialty counts are calculated
                        from the live provider directory.
                      </p>

                    </div>

                    {homeData
                      ?.specialties
                      ?.length ? (

                      <div className="home-directory-specialty-grid">

                        {homeData.specialties.map(
                          (
                            specialty,
                            index,
                          ) => {

                            const count =
                              specialtyDoctorCount.get(
                                specialty,
                              ) ?? 0;

                            /*
                             * Find providers belonging
                             * to this specialty.
                             */
                            const specialtyDoctors =
                              doctors.filter(
                                (doctor) =>
                                  (
                                    doctor.specialization ||
                                    doctor.department ||
                                    ""
                                  )
                                    .trim()
                                    .toLowerCase() ===
                                  specialty
                                    .trim()
                                    .toLowerCase(),
                              );

                            return (

                              <button
                                type="button"
                                className="home-directory-specialty-card"
                                key={
                                  specialty
                                }
                                onClick={() => {

                                  setDoctorSearch(
                                    specialty,
                                  );

                                  setDirectoryTab(
                                    "doctors",
                                  );

                                }}
                              >

                                <span className="home-directory-specialty-number">

                                  {String(
                                    index + 1,
                                  ).padStart(
                                    2,
                                    "0",
                                  )}

                                </span>

                                <div>

                                  <strong>
                                    {specialty}
                                  </strong>

                                  <small>

                                    {count} active provider
                                    {count ===
                                    1
                                      ? ""
                                      : "s"}

                                  </small>

                                </div>

                                <span className="home-directory-specialty-arrow">
                                  →
                                </span>

                                {/* ---------------------------------
                                    SMALL PROVIDER PREVIEW
                                --------------------------------- */}

                                <span className="home-directory-specialty-provider-preview">

                                  {specialtyDoctors
                                    .slice(
                                      0,
                                      3,
                                    )
                                    .map(
                                      (
                                        doctor,
                                      ) => (

                                        <span
                                          key={
                                            doctor.id
                                          }
                                        >

                                          {doctor.name
                                            .trim()
                                            .split(
                                              /\s+/,
                                            )
                                            .filter(
                                              Boolean,
                                            )
                                            .slice(
                                              0,
                                              2,
                                            )
                                            .map(
                                              (
                                                part,
                                              ) =>
                                                part[0],
                                            )
                                            .join("")
                                            .toUpperCase()}

                                        </span>

                                      ),
                                    )}

                                  {count >
                                    3 && (

                                    <b>
                                      +{count - 3}
                                    </b>

                                  )}

                                </span>

                              </button>

                            );

                          },
                        )}

                      </div>

                    ) : (

                      <div className="home-directory-state">

                        <strong>
                          No specialties available
                        </strong>

                        <p>
                          Specialty information will
                          appear when active providers
                          are available.
                        </p>

                      </div>

                    )}

                  </div>

                )}

              </div>

              {/* =================================================
                  MODAL FOOTER
              ================================================= */}

              <div className="home-directory-modal-footer">

                <div>

                  <span>
                    LIVE DATA
                  </span>

                  <p>
                    Provider information is loaded
                    from the public scheduling service.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => {

                    closeDoctorDirectory();

                    goCalendar();

                  }}
                >
                  Open appointment calendar →
                </button>

              </div>

            </section>

          </div>

        )}

        {/* =====================================================
            ABOUT
        ===================================================== */}

        <section
          id="about-healthcare"
          className="home-about"
        >

          <div className="home-about-inner">

            <div className="home-about-copy">

              <span>
                WHY HEALTHCARE+
              </span>

              <h2>
                Healthcare scheduling
                designed around you.
              </h2>

              <p>
                We make it easier to discover
                doctors, understand availability,
                and choose appointment times
                without unnecessary complexity.
              </p>

              <button
                type="button"
                onClick={goCalendar}
              >
                Find Your Appointment →
              </button>

            </div>

            <div className="home-about-grid">

              <div className="home-about-card">

                <span>
                  ◷
                </span>

                <div>

                  <strong>
                    Simple Scheduling
                  </strong>

                  <p>
                    Find appointment times
                    without unnecessary steps.
                  </p>

                </div>

              </div>

              <div className="home-about-card">

                <span>
                  ◇
                </span>

                <div>

                  <strong>
                    Secure & Private
                  </strong>

                  <p>
                    Your appointment information
                    is handled securely.
                  </p>

                </div>

              </div>

              <div className="home-about-card">

                <span>
                  ✓
                </span>

                <div>

                  <strong>
                    Easy Experience
                  </strong>

                  <p>
                    A clear and straightforward
                    appointment booking process.
                  </p>

                </div>

              </div>

              <div className="home-about-card">

                <span>
                  ♧
                </span>

                <div>

                  <strong>
                    Multiple Specialties
                  </strong>

                  <p>
                    Explore healthcare services
                    in one convenient place.
                  </p>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* =====================================================
            FINAL CTA
        ===================================================== */}

        <section className="home-final-cta">

          <div>

            <span>
              READY WHEN YOU ARE
            </span>

            <h2>
              Your appointment starts here.
            </h2>

            <p>
              Choose a doctor, check availability,
              and find a time that works for you.
            </p>

          </div>

          <button
            type="button"
            onClick={goCalendar}
          >
            Find an Appointment →
          </button>

        </section>

        {/* =====================================================
            DOCTOR PROFILE MODAL
        =====================================================

            This is opened only after the user clicks
            View Profile from the directory popup.
        ===================================================== */}

        {selectedDoctor && (

          <div
            className="home-doctor-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {

              if (
                event.target ===
                event.currentTarget
              ) {
                setSelectedDoctor(
                  null,
                );
              }

            }}
          >

            <section
              className="home-doctor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="home-doctor-profile-title"
            >

              <button
                type="button"
                className="home-doctor-modal-close"
                onClick={() =>
                  setSelectedDoctor(
                    null,
                  )
                }
                aria-label="Close doctor profile"
              >
                ×
              </button>

              <div className="home-doctor-modal-header">

                <div className="home-doctor-modal-avatar">

                  {selectedDoctor.profile_photo ? (

                    <img
                      src={
                        selectedDoctor.profile_photo
                      }
                      alt=""
                    />

                  ) : (

                    selectedDoctor.name
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map(
                        (part) =>
                          part[0],
                      )
                      .join("")
                      .toUpperCase()

                  )}

                </div>

                <div>

                  <span>
                    HEALTHCARE PROVIDER
                  </span>

                  <h2
                    id="home-doctor-profile-title"
                  >
                    {selectedDoctor.name}
                  </h2>

                  <p>
                    {selectedDoctor.specialization ||
                      selectedDoctor.department ||
                      "Healthcare Provider"}
                  </p>

                </div>

              </div>

              <div className="home-doctor-modal-grid">

                <div>

                  <span>
                    Department
                  </span>

                  <strong>
                    {selectedDoctor.department ||
                      "Not provided"}
                  </strong>

                </div>

                <div>

                  <span>
                    Specialization
                  </span>

                  <strong>
                    {selectedDoctor.specialization ||
                      "Not provided"}
                  </strong>

                </div>

                <div>

                  <span>
                    Today's availability
                  </span>

                  <strong>

                    {getAvailableSlotCount(
                      selectedDoctor.id,
                    )}{" "}
                    open slot
                    {getAvailableSlotCount(
                      selectedDoctor.id,
                    ) ===
                    1
                      ? ""
                      : "s"}

                  </strong>

                </div>

                <div>

                  <span>
                    Referral
                  </span>

                  <strong>

                    {selectedDoctor.requires_referral
                      ? "Required"
                      : "Not required"}

                  </strong>

                </div>

              </div>

              <div className="home-doctor-modal-note">

                <span>
                  LIVE DIRECTORY DATA
                </span>

                <p>
                  Provider information and today's
                  availability are loaded from the
                  active public scheduling directory.
                </p>

              </div>

              <div className="home-doctor-modal-actions">

                <button
                  type="button"
                  className="home-doctor-modal-secondary"
                  onClick={() =>
                    setSelectedDoctor(
                      null,
                    )
                  }
                >
                  Close
                </button>

                <button
                  type="button"
                  className="home-doctor-modal-primary"
                  onClick={() => {

                    setSelectedDoctor(
                      null,
                    );

                    openBookingGateway();

                  }}
                >
                  Book an Appointment →
                </button>

              </div>

            </section>

          </div>

        )}

        {/* =====================================================
            ACCOUNT GATEWAY
        =====================================================

            Booking requires a patient account.

            Existing patient:
              -> Login

            New patient:
              -> Register
        ===================================================== */}

        {accountGatewayOpen && (

          <div
            className="home-account-gateway-backdrop"
            role="presentation"
            onMouseDown={(event) => {

              if (
                event.target ===
                event.currentTarget
              ) {
                closeBookingGateway();
              }

            }}
          >

            <section
              className="home-account-gateway"
              role="dialog"
              aria-modal="true"
              aria-labelledby="home-account-gateway-title"
            >

              <button
                type="button"
                className="home-account-gateway-close"
                onClick={
                  closeBookingGateway
                }
                aria-label="Close booking account dialog"
              >
                ×
              </button>

              <div className="home-account-gateway-badge">
                SECURE BOOKING
              </div>

              <h2
                id="home-account-gateway-title"
              >
                Sign in to book your appointment
              </h2>

              <p className="home-account-gateway-intro">
                Choose the account option that
                matches you. Your appointment will
                continue after secure account access.
              </p>

              <div className="home-account-gateway-options">

                {/* ---------------------------------------------
                    EXISTING PATIENT
                --------------------------------------------- */}

                <button
                  type="button"
                  className="home-account-option home-account-existing"
                  onClick={() => {

                    closeBookingGateway();

                    navigate(
                      "/login",
                    );

                  }}
                >

                  <span className="home-account-option-icon">
                    →
                  </span>

                  <span>

                    <strong>
                      I already have an account
                    </strong>

                    <small>
                      Continue to patient login
                    </small>

                  </span>

                  <b>
                    →
                  </b>

                </button>

                {/* ---------------------------------------------
                    NEW PATIENT
                --------------------------------------------- */}

                <button
                  type="button"
                  className="home-account-option home-account-new"
                  onClick={() => {

                    closeBookingGateway();

                    navigate(
                      "/register",
                    );

                  }}
                >

                  <span className="home-account-option-icon">
                    +
                  </span>

                  <span>

                    <strong>
                      I am a new patient
                    </strong>

                    <small>
                      Create a patient account
                    </small>

                  </span>

                  <b>
                    →
                  </b>

                </button>

              </div>

              <div className="home-account-gateway-note">

                <span>
                  PRIVATE & SECURE
                </span>

                <p>
                  Public doctor information can be
                  viewed without an account. Booking
                  requires authenticated patient access.
                </p>

              </div>

              <button
                type="button"
                className="home-account-gateway-cancel"
                onClick={
                  closeBookingGateway
                }
              >
                Continue browsing
              </button>

            </section>

          </div>

        )}

      </main>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer
        id="contact-healthcare"
        className="home-footer"
      >

        <div className="home-footer-inner">

          {/* -------------------------------------------------
              FOOTER BRAND
          ------------------------------------------------- */}

          <div className="home-footer-brand">

            <div className="home-brand">

              <span className="home-brand-icon">
                +
              </span>

              <span className="home-brand-copy">

                <strong>
                  HealthCare
                  <span>+</span>
                </strong>

                <small>
                  Better Care. Brighter Tomorrow.
                </small>

              </span>

            </div>

            <p>
              Simple and transparent healthcare
              appointment scheduling.
            </p>

          </div>

          {/* -------------------------------------------------
              PLATFORM
          ------------------------------------------------- */}

          <div className="home-footer-column">

            <strong>
              Platform
            </strong>

            <button
              type="button"
              onClick={() =>
                openDoctorDirectory(
                  "doctors",
                )
              }
            >
              Find a Doctor
            </button>

            <button
              type="button"
              onClick={goCalendar}
            >
              Appointment Calendar
            </button>

          </div>

          {/* -------------------------------------------------
              ACCOUNT
          ------------------------------------------------- */}

          <div className="home-footer-column">

            <strong>
              Account
            </strong>

            <button
              type="button"
              onClick={goLogin}
            >
              Login
            </button>

            <button
              type="button"
              onClick={goRegister}
            >
              Register
            </button>

          </div>

          {/* -------------------------------------------------
              CONTACT
          ------------------------------------------------- */}

          <div className="home-footer-column">

            <strong>
              Contact
            </strong>

            <span>
              support@healthcareplus.com
            </span>

            <span>
              +1 (555) 123-4567
            </span>

            <span>
              Mon–Fri · 8 AM–6 PM
            </span>

          </div>

        </div>

        {/* -------------------------------------------------
            FOOTER BOTTOM
        ------------------------------------------------- */}

        <div className="home-footer-bottom">

          <span>
            © {new Date().getFullYear()} HealthCare+.
            All rights reserved.
          </span>

          <span>
            Better Care. Brighter Tomorrow.
          </span>

        </div>

      </footer>

    </div>
  );
};

export default HomePage;