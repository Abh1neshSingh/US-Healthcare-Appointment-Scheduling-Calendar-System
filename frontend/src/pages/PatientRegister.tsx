import { type FormEvent, useState } from "react";
import "./PatientRegister.css";

const API_URL = "http://127.0.0.1:8000";

function PatientRegister() {
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPassword, setPatientPassword] = useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [insuranceProvider, setInsuranceProvider] =
    useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePatientRegister = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/users/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: patientName,
            email: patientEmail,
            password: patientPassword,
            date_of_birth: dateOfBirth,
            gender,
            phone,
            city: city || null,
            state: state || null,
            insurance_provider:
              insuranceProvider || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Registration failed"
        );
        return;
      }

      setMessage(
        "Patient registered successfully!"
      );

      console.log(
        "Patient registration response:",
        data
      );

      setPatientName("");
      setPatientEmail("");
      setPatientPassword("");
      setDateOfBirth("");
      setGender("");
      setPhone("");
      setCity("");
      setState("");
      setInsuranceProvider("");
    } catch (error) {
      console.error(
        "Patient registration error:",
        error
      );

      setMessage(
        "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="patient-register-page">

      <div className="patient-register-container">

        {/* =================================================
            LEFT BRANDING PANEL
        ================================================= */}

        <div className="patient-register-left">

          <div className="register-brand">

            <div className="register-brand-icon">
              ♥
            </div>

            <div>
              <h2>HealthCare</h2>
              <span>
                Appointment System
              </span>
            </div>

          </div>


          <div className="register-hero">

            <p className="register-eyebrow">
              YOUR HEALTH,
            </p>

            <h1>
              Our Priority
            </h1>

            <p className="register-description">
              Create your healthcare account
              and manage your appointments
              with trusted healthcare
              professionals.
            </p>

          </div>


          {/* Floating Cards */}

          <div className="register-floating-card register-card-one">

            <div className="floating-icon">
              ✓
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


          <div className="register-floating-card register-card-two">

            <div className="floating-icon">
              +
            </div>

            <div>
              <strong>
                Patient First
              </strong>

              <span>
                Your health matters
              </span>
            </div>

          </div>


          {/* Feature Box */}

          <div className="register-features">

            <div className="register-feature">

              <div className="feature-check">
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


            <div className="register-feature">

              <div className="feature-check">
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


            <div className="register-feature">

              <div className="feature-check">
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


        {/* =================================================
            RIGHT REGISTRATION PANEL
        ================================================= */}

        <div className="patient-register-right">

          <div className="patient-register-header">

            <h1>
              Healthcare Appointment System
            </h1>

            <p>
              Create your patient account
            </p>

          </div>


          <h2>
            Patient Registration
          </h2>


          <form
            className="patient-register-form"
            onSubmit={handlePatientRegister}
          >

            {/* =================================================
                PERSONAL INFORMATION
            ================================================= */}

            <section className="patient-register-section">

              <h3>
                Personal Information
              </h3>


              <div className="patient-form-group">

                <label htmlFor="patientName">
                  Name *
                </label>

                <input
                  id="patientName"
                  type="text"
                  placeholder="Enter your name"
                  value={patientName}
                  onChange={(event) =>
                    setPatientName(
                      event.target.value
                    )
                  }
                  required
                />

              </div>


              <div className="patient-form-group">

                <label htmlFor="patientEmail">
                  Email *
                </label>

                <input
                  id="patientEmail"
                  type="email"
                  placeholder="Enter your email"
                  value={patientEmail}
                  onChange={(event) =>
                    setPatientEmail(
                      event.target.value
                    )
                  }
                  required
                />

              </div>


              <div className="patient-form-group">

                <label htmlFor="patientPassword">
                  Password *
                </label>

                <input
                  id="patientPassword"
                  type="password"
                  placeholder="Create a password"
                  value={patientPassword}
                  onChange={(event) =>
                    setPatientPassword(
                      event.target.value
                    )
                  }
                  minLength={8}
                  required
                />

              </div>


              <div className="patient-form-group">

                <label htmlFor="dateOfBirth">
                  Date of Birth *
                </label>

                <input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) =>
                    setDateOfBirth(
                      event.target.value
                    )
                  }
                  required
                />

              </div>


              <div className="patient-form-group">

                <label htmlFor="gender">
                  Gender *
                </label>

                <select
                  id="gender"
                  value={gender}
                  onChange={(event) =>
                    setGender(
                      event.target.value
                    )
                  }
                  required
                >

                  <option value="">
                    Select Gender
                  </option>

                  <option value="MALE">
                    Male
                  </option>

                  <option value="FEMALE">
                    Female
                  </option>

                  <option value="OTHER">
                    Other
                  </option>

                  <option value="PREFER_NOT_TO_SAY">
                    Prefer not to say
                  </option>

                </select>

              </div>


              <div className="patient-form-group">

                <label htmlFor="phone">
                  Phone *
                </label>

                <input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value
                    )
                  }
                  required
                />

              </div>

            </section>


            {/* =================================================
                LOCATION
            ================================================= */}

            <section className="patient-register-section">

              <h3>
                Location
              </h3>


              <div className="patient-form-group">

                <label htmlFor="city">
                  City
                </label>

                <input
                  id="city"
                  type="text"
                  placeholder="Enter city"
                  value={city}
                  onChange={(event) =>
                    setCity(
                      event.target.value
                    )
                  }
                />

              </div>


              <div className="patient-form-group">

                <label htmlFor="state">
                  State
                </label>

                <input
                  id="state"
                  type="text"
                  placeholder="Enter state"
                  value={state}
                  onChange={(event) =>
                    setState(
                      event.target.value
                    )
                  }
                />

              </div>

            </section>


            {/* =================================================
                INSURANCE
            ================================================= */}

            <section className="patient-register-section">

              <h3>
                Insurance
              </h3>


              <div className="patient-form-group">

                <label htmlFor="insuranceProvider">
                  Insurance Provider
                </label>

                <input
                  id="insuranceProvider"
                  type="text"
                  placeholder="Enter insurance provider"
                  value={insuranceProvider}
                  onChange={(event) =>
                    setInsuranceProvider(
                      event.target.value
                    )
                  }
                />

              </div>

            </section>


            {/* =================================================
                SUBMIT
            ================================================= */}

            <button
              type="submit"
              className="patient-register-button"
              disabled={loading}
            >
              {loading
                ? "Creating Account..."
                : "Create Patient Account"}
            </button>

          </form>


          {message && (
            <p className="patient-register-message">
              {message}
            </p>
          )}

        </div>

      </div>

    </div>
  );
}

export default PatientRegister;