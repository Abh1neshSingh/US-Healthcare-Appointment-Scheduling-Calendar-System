import { type FormEvent, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";

import "./LoginPage.css";
import API_URL from "../config";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<"PATIENT" | "STAFF">("PATIENT");

  const navigate = useNavigate();

  // =========================================================
  // LOGIN
  // =========================================================

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      let data: {
        access_token?: string;
        detail?: string;
        [key: string]: unknown;
      } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setMessage(
          typeof data.detail === "string"
            ? data.detail
            : "Login failed"
        );

        return;
      }

      if (!data.access_token) {
        setMessage(
          "Login failed: access token not received."
        );

        return;
      }

      // =====================================================
      // SAVE JWT TOKEN
      // =====================================================

      // =====================================================
      // DECODE JWT
      // =====================================================

      const { role } = jwtDecode<{
        role: string;
      }>(data.access_token);

      console.log("User role:", role);

      // =====================================================
      // LOGIN MODE / ROLE VALIDATION
      // =====================================================
      // Patient login must accept ONLY PATIENT accounts.
      // Admin / Staff login must accept ONLY ADMIN, DOCTOR,
      // or RECEPTIONIST accounts. Do not save the token when
      // the account does not belong to the selected login mode.

      const isPatientLogin = loginMode === "PATIENT";
      const isPatientAccount = role === "PATIENT";
      const isStaffAccount =
        role === "ADMIN" ||
        role === "DOCTOR" ||
        role === "RECEPTIONIST";

      if (isPatientLogin && !isPatientAccount) {
        setMessage(
          "This is an administrator or staff account. Please use Login as Admin / Staff."
        );
        return;
      }

      if (!isPatientLogin && !isStaffAccount) {
        setMessage(
          "This account is not available for Admin / Staff login."
        );
        return;
      }

      // =====================================================
      // SAVE JWT TOKEN ONLY AFTER ROLE VALIDATION
      // =====================================================

      localStorage.setItem(
        "access_token",
        data.access_token
      );

      // =====================================================
      // ROLE BASED REDIRECT
      // =====================================================

      if (role === "ADMIN") {
        navigate("/admin");
      } else if (role === "DOCTOR") {
        navigate("/doctor");
      } else if (role === "RECEPTIONIST") {
        navigate("/receptionist");
      } else if (role === "PATIENT") {
        navigate("/patient");
      } else {
        setMessage("Unknown user role");
      }
    } catch (error) {
      console.error("Login error:", error);

      setMessage(
        "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="login-page">

      <div className="login-container">

        {/* =====================================================
            LEFT SIDE
        ===================================================== */}

        <section className="login-hero">

          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />

          {/* BRAND */}

          <div className="brand">

            <div className="brand-icon">

              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M12 21s-7-4.35-9.33-8.36C.7 9.25 2.1 5 5.8 5c2.03 0 3.4 1.16 4.2 2.47C10.8 6.16 12.17 5 14.2 5c3.7 0 5.1 4.25 3.13 7.64C16.07 16.65 12 21 12 21Z"
                  fill="currentColor"
                />
              </svg>

            </div>

            <div className="brand-copy">

              <h2>
                HealthCare<span>+</span>
              </h2>

              <span>
                Appointment System
              </span>

            </div>

          </div>


          {/* HERO CONTENT */}

          <div className="hero-content">

            <div className="hero-kicker">

              <span className="kicker-dot" />

              PATIENT CARE PLATFORM

            </div>


            <p className="hero-label">
              YOUR HEALTH,
            </p>


            <h1>
              Our
              <br />
              <span>Priority.</span>
            </h1>


            <p className="hero-description">
              Book appointments with trusted
              healthcare professionals and manage
              your care from one secure platform.
            </p>


            {/* VISUAL DASHBOARD */}

            <div className="doctor-illustration">

              <div className="visual-grid" />


              {/* Availability */}

              <div className="availability-card">

                <div className="availability-icon">

                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="17"
                      rx="3"
                    />

                    <path d="M8 2v4M16 2v4M3 9h18" />

                    <path d="m8 14 2 2 5-5" />

                  </svg>

                </div>


                <div className="availability-copy">

                  <span>
                    APPOINTMENTS
                  </span>

                  <strong>
                    Easy scheduling
                  </strong>

                </div>


                <div className="availability-status">

                  <span />

                  Available

                </div>

              </div>


              {/* Healthcare card */}

              <div className="care-card">

                <div className="care-avatar">

                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="8"
                      r="3.2"
                    />

                    <path
                      d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"
                    />

                  </svg>

                </div>


                <div className="care-copy">

                  <span>
                    TRUSTED CARE
                  </span>

                  <strong>
                    Professional healthcare
                  </strong>

                  <small>
                    Verified providers
                  </small>

                </div>


                <div className="care-check">

                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="m6 12 4 4 8-8" />
                  </svg>

                </div>

              </div>


              {/* Patient card */}

              <div className="patient-card">

                <div className="patient-card-icon">

                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="8"
                      r="3"
                    />

                    <path
                      d="M5 20c.7-3.8 3-5.7 7-5.7s6.3 1.9 7 5.7"
                    />

                  </svg>

                </div>


                <div>

                  <span>
                    PATIENT PORTAL
                  </span>

                  <strong>
                    Your health matters
                  </strong>

                </div>

              </div>


              {/* Plus */}

              <div className="doctor-circle">

                <span />
                <i />

              </div>

            </div>

          </div>


          {/* FEATURES */}

          <div className="login-features">

            {/* Feature 1 */}

            <div className="login-feature">

              <div className="feature-icon">

                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M4 12h16" />
                  <path d="M13 5l7 7-7 7" />
                </svg>

              </div>


              <div>

                <strong>
                  Easy Appointments
                </strong>

                <span>
                  Simple booking experience
                </span>

              </div>

            </div>


            {/* Feature 2 */}

            <div className="login-feature">

              <div className="feature-icon">

                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 3 4 7v5c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V7l-8-4Z" />

                  <path d="m8.5 12 2.2 2.2 4.8-5" />

                </svg>

              </div>


              <div>

                <strong>
                  Trusted Doctors
                </strong>

                <span>
                  Verified healthcare providers
                </span>

              </div>

            </div>


            {/* Feature 3 */}

            <div className="login-feature">

              <div className="feature-icon">

                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="10"
                    rx="2"
                  />

                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />

                </svg>

              </div>


              <div>

                <strong>
                  Secure & Private
                </strong>

                <span>
                  Protected patient information
                </span>

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            RIGHT LOGIN
        ===================================================== */}

        <section className="login-form-section">

          <div className="login-form-inner">


            {/* HEADER */}

            <div className="login-form-header">

              <div className="form-welcome-badge">

                <span />

                {loginMode === "PATIENT" ? "SECURE PATIENT LOGIN" : "SECURE ADMIN / STAFF LOGIN"}

              </div>


              <h2>
                Welcome back
              </h2>


              <p>
                {loginMode === "PATIENT"
                  ? "Sign in to continue to your healthcare account."
                  : "Sign in with your administrator or staff account."}
              </p>

            </div>


            {/* FORM */}

            <form
              onSubmit={handleLogin}
              className="login-form"
            >

              {/* EMAIL */}

              <div className="form-group">

                <label htmlFor="email">
                  Email address
                </label>


                <div className="input-wrapper">

                  <span className="input-icon">

                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                      />

                      <path d="m4 7 8 6 8-6" />

                    </svg>

                  </span>


                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    autoComplete="email"
                    required
                  />

                </div>

              </div>


              {/* PASSWORD */}

              <div className="form-group">

                <div className="password-label-row">

                  <label htmlFor="password">
                    Password
                  </label>

                </div>


                <div className="input-wrapper">

                  <span className="input-icon">

                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect
                        x="5"
                        y="10"
                        width="14"
                        height="10"
                        rx="2"
                      />

                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />

                    </svg>

                  </span>


                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    autoComplete="current-password"
                    required
                  />


                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >

                    {showPassword ? (

                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >

                        <path d="M3 3l18 18" />

                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />

                        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.4 9.5 7-0.4 1.1-1.2 2.4-2.3 3.5" />

                        <path d="M6.2 6.2C4.5 7.4 3.4 9 2.5 12c1 2.6 4.5 7 9.5 7 1 0 1.9-.2 2.8-.5" />

                      </svg>

                    ) : (

                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >

                        <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />

                        <circle
                          cx="12"
                          cy="12"
                          r="2.7"
                        />

                      </svg>

                    )}

                  </button>

                </div>

              </div>


              {/* OPTIONS */}

              <div className="login-options">

                <label className="remember-me">

                  <input
                    type="checkbox"
                  />

                  <span className="custom-checkbox">

                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="m6 12 4 4 8-8" />
                    </svg>

                  </span>

                  <span>
                    Remember me
                  </span>

                </label>


                <button
                  type="button"
                  className="forgot-password"
                  onClick={() =>
                    setMessage(
                      "Password reset is not available yet."
                    )
                  }
                >
                  Forgot password?
                </button>

              </div>


              {/* LOGIN BUTTON */}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >

                <span>
                  {loading
                    ? "Signing in..."
                    : "Sign in"}
                </span>


                {!loading && (

                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M5 12h13" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>

                )}

              </button>

            </form>


            {/* DIVIDER */}

            <div className="login-divider">

              <span />

              <p>
                or
              </p>

              <span />

            </div>


            {/* STAFF LOGIN */}

            <button
              type="button"
              className="staff-login-button"
              onClick={() => {
                setLoginMode((mode) =>
                  mode === "PATIENT" ? "STAFF" : "PATIENT"
                );
                setMessage("");
                setEmail("");
                setPassword("");
              }}
            >

              <span className="staff-icon">

                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >

                  <path d="M7 20v-1.5A3.5 3.5 0 0 1 10.5 15h3A3.5 3.5 0 0 1 17 18.5V20" />

                  <circle
                    cx="12"
                    cy="8"
                    r="3"
                  />

                  <path d="M19 11v6M16 14h6" />

                </svg>

              </span>


              <span>
                {loginMode === "PATIENT"
                  ? "Login as Admin / Staff"
                  : "Back to Patient Login"}
              </span>


              <svg
                className="staff-arrow"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M5 12h13" />
                <path d="m13 6 6 6-6 6" />
              </svg>

            </button>


            {/* REGISTER */}

            <p className="register-text">

              <span>
                Don't have an account?
              </span>


              <button
                type="button"
                className="register-link"
                onClick={() =>
                  navigate("/register")
                }
              >

                Register as Patient

                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M5 12h13" />
                  <path d="m13 6 6 6-6 6" />
                </svg>

              </button>

            </p>


            {/* MESSAGE */}

            {message && (

              <div
                className="message"
                role="alert"
              >

                <span className="message-dot" />

                <span>
                  {message}
                </span>

              </div>

            )}


            {/* SECURITY */}

            <div className="login-security-note">

              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >

                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="10"
                  rx="2"
                />

                <path
                  d="M8 10V7a4 4 0 0 1 8 0v3"
                />

              </svg>


              <span>
                Your connection is secure and
                your account information is protected.
              </span>

            </div>

          </div>

        </section>

      </div>

    </div>
  );
}

export default LoginPage;