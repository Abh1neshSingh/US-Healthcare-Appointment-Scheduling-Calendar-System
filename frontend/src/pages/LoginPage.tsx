import { type FormEvent, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

const API_URL = "https://ushcs.onrender.com";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // =========================
  // Login
  // =========================

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

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Login failed"
        );
        return;
      }

      // Save JWT token
      localStorage.setItem(
        "access_token",
        data.access_token
      );

      // Decode JWT
      const decoded = jwtDecode<{
        role: string;
      }>(data.access_token);

      const role = decoded.role;

      console.log(
        "Decoded token:",
        decoded
      );

      console.log(
        "User role:",
        role
      );

      // Redirect based on role
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
      console.error(error);

      setMessage(
        "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">

        {/* =========================
            Left Side
        ========================= */}

        <div className="login-hero">

          <div className="brand">
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

          <div className="hero-content">
            <p className="hero-label">
              YOUR HEALTH,
            </p>

            <h1>
              Our Priority
            </h1>

            <p className="hero-description">
              Book appointments with
              trusted doctors and manage
              your healthcare easily.
            </p>

            <div className="doctor-illustration">
              <div className="doctor-circle">
                +
              </div>

              <div className="doctor-card">
                <div className="doctor-avatar">
                  👩‍⚕️
                </div>

                <div>
                  <strong>
                    Trusted Care
                  </strong>

                  <span>
                    Professional healthcare
                  </span>
                </div>
              </div>

              <div className="patient-card">
                <div className="patient-avatar">
                  👨
                </div>

                <div>
                  <strong>
                    Patient
                  </strong>

                  <span>
                    Your health matters
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}

          <div className="login-features">

            <div className="login-feature">
              <div className="feature-icon">
                ✓
              </div>

              <div>
                <strong>
                  Easy Appointments
                </strong>

                <span>
                  Book appointments in
                  just a few clicks
                </span>
              </div>
            </div>

            <div className="login-feature">
              <div className="feature-icon">
                ✓
              </div>

              <div>
                <strong>
                  Trusted Doctors
                </strong>

                <span>
                  Connect with verified
                  professionals
                </span>
              </div>
            </div>

            <div className="login-feature">
              <div className="feature-icon">
                ✓
              </div>

              <div>
                <strong>
                  Secure & Private
                </strong>

                <span>
                  Your data is safe
                  and protected
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* =========================
            Right Side - Login
        ========================= */}

        <div className="login-form-section">

          <div className="login-form-header">
            <h2>
              Welcome Back!
            </h2>

            <p>
              Login to your account
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="login-form"
          >

            {/* Email */}

            <div className="form-group">
              <label htmlFor="email">
                Email
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  ✉
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
                  required
                />
              </div>
            </div>

            {/* Password */}

            <div className="form-group">
              <label htmlFor="password">
                Password
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  🔒
                </span>

                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  required
                />
              </div>
            </div>

            {/* Remember / Forgot */}

            <div className="login-options">

              <label className="remember-me">
                <input
                  type="checkbox"
                />

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
                Forgot Password?
              </button>

            </div>

            {/* Login */}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading
                ? "Logging in..."
                : "Login"}
            </button>

          </form>

          {/* Divider */}

          <div className="login-divider">
            <span></span>
            <p>or</p>
            <span></span>
          </div>

          {/* Admin / Staff */}

          <button
            type="button"
            className="staff-login-button"
            onClick={() => {
              setMessage("");
            }}
          >
            <span>♙</span>
            Login as Admin / Staff
          </button>

          {/* Register */}

          <p className="register-text">
            Don't have an account?

            <button
              type="button"
              className="register-link"
              onClick={() =>
                navigate("/register")
              }
            >
              Register as Patient
            </button>
          </p>

          {/* Message */}

          {message && (
            <p className="message">
              {message}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

export default LoginPage;