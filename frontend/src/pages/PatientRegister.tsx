import {
  type FormEvent,
  useRef,
  useState,
} from "react";

import "./PatientRegister.css";
import API_URL from "../config";

function PatientRegister() {
  /* =========================================================
     FORM STATE
  ========================================================= */

  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPassword, setPatientPassword] =
    useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const [insuranceProvider, setInsuranceProvider] =
    useState("");

  const [insuranceMemberId, setInsuranceMemberId] =
    useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] =
    useState(false);

  const formRef =
    useRef<HTMLFormElement>(null);

  const totalSteps = 3;


  /* =========================================================
     VALIDATION
  ========================================================= */

  const validateCurrentStep = (): boolean => {
    const form = formRef.current;

    if (!form) {
      return true;
    }

    return form.reportValidity();
  };


  /* =========================================================
     CONTINUE
  ========================================================= */

  const handleContinue = () => {
    setMessage("");

    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(
        (step) => step + 1
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };


  /* =========================================================
     BACK
  ========================================================= */

  const handleBack = () => {
    setMessage("");

    if (currentStep > 1) {
      setCurrentStep(
        (step) => step - 1
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };


  /* =========================================================
     REGISTER PATIENT
  ========================================================= */

  const handlePatientRegister = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!validateCurrentStep()) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const baseUrl =
        API_URL || "http://localhost:8000";

      const response = await fetch(
        `${baseUrl}/users/register`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
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
            insurance_member_id:
              insuranceMemberId || null,
          }),
        }
      );

      let data: {
        detail?: string;
        [key: string]: unknown;
      } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const errorMessage =
          typeof data.detail === "string"
            ? data.detail
            : "Registration failed";

        setMessage(errorMessage);

        return;
      }

      setMessage(
        "Patient registered successfully!"
      );

      console.log(
        "Patient registration response:",
        data
      );

      /* Reset form */

      setPatientName("");
      setPatientEmail("");
      setPatientPassword("");

      setDateOfBirth("");
      setGender("");
      setPhone("");

      setCity("");
      setState("");

      setInsuranceProvider("");
      setInsuranceMemberId("");

      setShowPassword(false);
      setCurrentStep(1);

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


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="patient-register-page">

      <div className="patient-register-container">


        {/* =====================================================
            LEFT BRANDING
        ===================================================== */}

        <aside className="patient-register-left">

          <div className="register-brand">

            <div className="register-brand-icon">
              HC
            </div>

            <div className="register-brand-text">

              <h2>
                HealthCare<span>+</span>
              </h2>

              <p>
                Appointment System
              </p>

            </div>

          </div>


          {/* =================================================
              HERO
          ================================================= */}

          <div className="register-hero">

            <div className="register-eyebrow">

              <span className="eyebrow-dot" />

              PATIENT PORTAL

            </div>


            <p className="register-eyebrow-title">
              YOUR HEALTH,
            </p>


            <h1>
              Our
              <br />
              <span>Priority.</span>
            </h1>


            <p className="register-description">
              Create your secure patient account
              and take control of your healthcare
              appointments in one simple place.
            </p>

          </div>


          {/* =================================================
              FLOATING CARD 1
          ================================================= */}

          <div
            className="
              register-floating-card
              register-card-one
            "
          >

            <div
              className="
                floating-icon
                floating-icon-check
              "
            >
              <span />
            </div>


            <div className="floating-card-copy">

              <strong>
                Trusted Care
              </strong>

              <span>
                Professional healthcare
              </span>

            </div>


            <div className="floating-card-status">
              <span />
            </div>

          </div>


          {/* =================================================
              FLOATING CARD 2
          ================================================= */}

          <div
            className="
              register-floating-card
              register-card-two
            "
          >

            <div
              className="
                floating-icon
                floating-icon-plus
              "
            >
              <span />
              <i />
            </div>


            <div className="floating-card-copy">

              <strong>
                Patient First
              </strong>

              <span>
                Your health matters
              </span>

            </div>

          </div>


          {/* =================================================
              FEATURES
          ================================================= */}

          <div className="register-features">

            <div className="register-feature">

              <div className="feature-check">
                <span />
              </div>

              <div>

                <strong>
                  Easy Appointments
                </strong>

                <span>
                  Book appointments in just
                  a few clicks
                </span>

              </div>

            </div>


            <div className="register-feature">

              <div className="feature-check">
                <span />
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
                <span />
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

        </aside>


        {/* =====================================================
            RIGHT REGISTRATION PANEL
        ===================================================== */}

        <main className="patient-register-right">


          {/* =================================================
              HEADER
          ================================================= */}

          <div className="patient-register-header">

            <div>

              <span className="register-content-label">
                PATIENT REGISTRATION
              </span>


              <h1>
                Create your patient account
              </h1>


              <p>
                Complete your profile to access
                secure healthcare scheduling.
              </p>

            </div>


            <div className="register-secure-badge">

              <span className="secure-dot" />

              Secure registration

            </div>

          </div>


          {/* =================================================
              PROGRESS
          ================================================= */}

          <div className="registration-progress">


            {/* STEP 1 */}

            <div
              className={`progress-step ${
                currentStep >= 1
                  ? "active"
                  : ""
              } ${
                currentStep > 1
                  ? "completed"
                  : ""
              }`}
            >

              <div className="progress-circle">

                {currentStep > 1 ? (
                  <span className="circle-check" />
                ) : (
                  "1"
                )}

              </div>


              <div className="progress-copy">

                <strong>
                  Account
                </strong>

                <span>
                  Login details
                </span>

              </div>

            </div>


            <div
              className={`progress-line ${
                currentStep > 1
                  ? "progress-line-active"
                  : ""
              }`}
            />


            {/* STEP 2 */}

            <div
              className={`progress-step ${
                currentStep >= 2
                  ? "active"
                  : ""
              } ${
                currentStep > 2
                  ? "completed"
                  : ""
              }`}
            >

              <div className="progress-circle">

                {currentStep > 2 ? (
                  <span className="circle-check" />
                ) : (
                  "2"
                )}

              </div>


              <div className="progress-copy">

                <strong>
                  Personal
                </strong>

                <span>
                  Basic details
                </span>

              </div>

            </div>


            <div
              className={`progress-line ${
                currentStep > 2
                  ? "progress-line-active"
                  : ""
              }`}
            />


            {/* STEP 3 */}

            <div
              className={`progress-step ${
                currentStep >= 3
                  ? "active"
                  : ""
              }`}
            >

              <div className="progress-circle">
                3
              </div>


              <div className="progress-copy">

                <strong>
                  Healthcare
                </strong>

                <span>
                  Location & insurance
                </span>

              </div>

            </div>

          </div>


          {/* =================================================
              FORM
          ================================================= */}

          <form
            ref={formRef}
            className="patient-register-form"
            onSubmit={
              handlePatientRegister
            }
          >


            {/* =================================================
                STEP 1 — ACCOUNT
            ================================================= */}

            {currentStep === 1 && (

              <section
                className="
                  registration-step-panel
                "
              >

                <div className="step-panel-heading">

                  <div className="step-panel-badge">
                    01
                  </div>


                  <div>

                    <span>
                      STEP 01
                    </span>

                    <h2>
                      Account information
                    </h2>

                    <p>
                      Set up the credentials
                      you will use to access
                      your patient portal.
                    </p>

                  </div>

                </div>


                <div className="form-fields">


                  {/* NAME */}

                  <div className="patient-form-group">

                    <label htmlFor="patientName">
                      Full name <b>*</b>
                    </label>

                    <input
                      id="patientName"
                      type="text"
                      placeholder="Enter your full name"
                      value={patientName}
                      onChange={(event) =>
                        setPatientName(
                          event.target.value
                        )
                      }
                      autoComplete="name"
                      required
                    />

                  </div>


                  {/* EMAIL */}

                  <div className="patient-form-group">

                    <label htmlFor="patientEmail">
                      Email address <b>*</b>
                    </label>

                    <input
                      id="patientEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={patientEmail}
                      onChange={(event) =>
                        setPatientEmail(
                          event.target.value
                        )
                      }
                      autoComplete="email"
                      required
                    />

                    <small className="field-help">
                      We will use this email for
                      account access and appointment
                      communication.
                    </small>

                  </div>


                  {/* PASSWORD */}

                  <div className="patient-form-group">

                    <label htmlFor="patientPassword">
                      Create password <b>*</b>
                    </label>


                    <div className="password-input-wrapper">

                      <input
                        id="patientPassword"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        placeholder="Create a secure password"
                        value={patientPassword}
                        onChange={(event) =>
                          setPatientPassword(
                            event.target.value
                          )
                        }
                        autoComplete="new-password"
                        minLength={8}
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
                      >
                        {showPassword
                          ? "Hide"
                          : "Show"}
                      </button>

                    </div>


                    <small className="field-help">
                      Use at least 8 characters
                      for your account password.
                    </small>

                  </div>

                </div>


                <div
                  className="
                    step-action-row
                    step-action-right
                  "
                >

                  <button
                    type="button"
                    className="patient-register-button"
                    onClick={handleContinue}
                  >
                    Continue

                    <span className="button-arrow">
                      →
                    </span>

                  </button>

                </div>

              </section>
            )}


            {/* =================================================
                STEP 2 — PERSONAL
            ================================================= */}

            {currentStep === 2 && (

              <section
                className="
                  registration-step-panel
                "
              >

                <div className="step-panel-heading">

                  <div className="step-panel-badge">
                    02
                  </div>


                  <div>

                    <span>
                      STEP 02
                    </span>

                    <h2>
                      Personal information
                    </h2>

                    <p>
                      Tell us a little about
                      yourself so we can create
                      your patient profile.
                    </p>

                  </div>

                </div>


                <div className="form-fields">


                  <div className="form-row-two">


                    {/* DOB */}

                    <div className="patient-form-group">

                      <label htmlFor="dateOfBirth">
                        Date of birth <b>*</b>
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


                    {/* GENDER */}

                    <div className="patient-form-group">

                      <label htmlFor="gender">
                        Gender <b>*</b>
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
                          Select gender
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

                  </div>


                  {/* PHONE */}

                  <div className="patient-form-group">

                    <label htmlFor="phone">
                      Phone number <b>*</b>
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
                      autoComplete="tel"
                      required
                    />

                  </div>

                </div>


                <div className="step-action-row">


                  <button
                    type="button"
                    className="patient-back-button"
                    onClick={handleBack}
                  >
                    <span>
                      ←
                    </span>

                    Back
                  </button>


                  <button
                    type="button"
                    className="patient-register-button"
                    onClick={handleContinue}
                  >
                    Continue

                    <span className="button-arrow">
                      →
                    </span>

                  </button>

                </div>

              </section>
            )}


            {/* =================================================
                STEP 3 — HEALTHCARE
            ================================================= */}

            {currentStep === 3 && (

              <section
                className="
                  registration-step-panel
                "
              >

                <div className="step-panel-heading">

                  <div className="step-panel-badge">
                    03
                  </div>


                  <div>

                    <span>
                      STEP 03
                    </span>

                    <h2>
                      Healthcare details
                    </h2>

                    <p>
                      Add your location and insurance
                      information to complete your
                      patient profile.
                    </p>

                  </div>

                </div>


                <div className="form-fields">


                  {/* LOCATION */}

                  <div className="section-mini-label">
                    LOCATION
                  </div>


                  <div className="form-row-two">


                    {/* CITY */}

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
                        autoComplete="address-level2"
                      />

                    </div>


                    {/* STATE */}

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
                        autoComplete="address-level1"
                      />

                    </div>

                  </div>


                  {/* INSURANCE */}

                  <div
                    className="
                      section-mini-label
                      insurance-label
                    "
                  >
                    INSURANCE
                  </div>


                  {/* INSURANCE PROVIDER */}

                  <div className="patient-form-group">

                    <label htmlFor="insuranceProvider">
                      Insurance provider
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


                  {/* INSURANCE MEMBER ID */}

                  <div className="patient-form-group">

                    <label htmlFor="insuranceMemberId">
                      Insurance Member ID
                    </label>

                    <input
                      id="insuranceMemberId"
                      type="text"
                      placeholder="Enter insurance member ID"
                      value={insuranceMemberId}
                      onChange={(event) =>
                        setInsuranceMemberId(
                          event.target.value
                        )
                      }
                      autoComplete="off"
                    />

                    <small className="field-help">
                      You can leave this blank if
                      you do not have insurance
                      information available right now.
                    </small>

                  </div>


                  {/* SUMMARY */}

                  <div className="registration-summary">

                    <div className="summary-status">
                      <span />
                    </div>


                    <div>

                      <strong>
                        Profile almost complete
                      </strong>

                      <p>
                        Review your information
                        and create your secure
                        patient account.
                      </p>

                    </div>

                  </div>

                </div>


                <div className="step-action-row">


                  <button
                    type="button"
                    className="patient-back-button"
                    onClick={handleBack}
                    disabled={loading}
                  >
                    <span>
                      ←
                    </span>

                    Back
                  </button>


                  <button
                    type="submit"
                    className="
                      patient-register-button
                      patient-submit-button
                    "
                    disabled={loading}
                  >

                    {loading
                      ? "Creating Account..."
                      : "Create Patient Account"}


                    {!loading && (
                      <span className="button-arrow">
                        →
                      </span>
                    )}

                  </button>

                </div>

              </section>
            )}

          </form>


          {/* =================================================
              MESSAGE
          ================================================= */}

          {message && (

            <div
              className={`patient-register-message ${
                message.includes("successfully")
                  ? "success"
                  : "error"
              }`}
              role="alert"
            >

              <span className="message-indicator" />

              <span>
                {message}
              </span>

            </div>

          )}


          {/* =================================================
              SECURITY FOOTER
          ================================================= */}

          <div className="registration-footer-note">

            <span className="footer-lock" />

            <span>
              Your information is securely
              submitted to the healthcare
              scheduling system.
            </span>

          </div>

        </main>

      </div>

    </div>
  );
}

export default PatientRegister;