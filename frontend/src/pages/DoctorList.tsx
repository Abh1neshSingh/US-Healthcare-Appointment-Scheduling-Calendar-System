import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DoctorList.css";

const API_URL = "http://127.0.0.1:8000";

interface Doctor {
  id: number;
  name: string;
  specialization: string;
  sub_specialization: string;
  qualification: string;
  years_of_experience: number;
  department: string;
  clinic_name: string;
  city: string;
  state: string;
  consultation_fee: number;
  consultation_mode: string;
  bio: string;
  languages: string;
  profile_photo: string | null;
  accepting_new_patients: boolean;
}

interface DoctorsResponse {
  count: number;
  doctors: Doctor[];
}

function DoctorList() {
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const token = localStorage.getItem("access_token");

        // No JWT token
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch(
          `${API_URL}/users/doctors`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data: DoctorsResponse | { detail?: string } =
          await response.json();

        // JWT expired / invalid
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          navigate("/login");
          return;
        }

        if (!response.ok) {
          const errorMessage =
            "detail" in data && data.detail
              ? data.detail
              : "Unable to load doctors";

          throw new Error(errorMessage);
        }

        // Make sure response has doctors
        if ("doctors" in data) {
          setDoctors(data.doctors);
        }
      } catch (error) {
        console.error("Doctor fetch error:", error);

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load doctors. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [navigate]);

  /* =========================
     Loading
  ========================= */

  if (loading) {
    return (
      <div className="doctor-list-page">
        <div className="doctor-list-loading">
          <div className="loading-spinner"></div>
          <p>Loading doctors...</p>
        </div>
      </div>
    );
  }

  /* =========================
     Error
  ========================= */

  if (error) {
    return (
      <div className="doctor-list-page">
        <div className="doctor-list-error">
          <h2>Unable to Load Doctors</h2>
          <p>{error}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-list-page">

      {/* =========================
          Header
      ========================= */}

      <header className="doctor-list-header">

        <div className="doctor-list-heading">
          <div className="page-label">
            HEALTHCARE PROVIDERS
          </div>

          <h1>Find a Doctor</h1>

          <p>
            Browse available doctors and choose the
            right healthcare professional for your needs.
          </p>
        </div>

        <button
          type="button"
          className="doctor-back-button"
          onClick={() => navigate("/patient")}
        >
          ← Back to Dashboard
        </button>

      </header>


      {/* =========================
          Count
      ========================= */}

      <div className="doctor-list-summary">
        <div className="doctor-count">
          <strong>{doctors.length}</strong>

          <span>
            {doctors.length === 1
              ? "doctor available"
              : "doctors available"}
          </span>
        </div>
      </div>


      {/* =========================
          Empty State
      ========================= */}

      {doctors.length === 0 ? (

        <div className="doctor-list-empty">

          <div className="empty-icon">
            +
          </div>

          <h2>No doctors available</h2>

          <p>
            There are currently no doctors available
            for appointments.
          </p>

        </div>

      ) : (

        /* =========================
           Doctor Grid
        ========================= */

        <div className="doctor-grid">

          {doctors.map((doctor) => (

            <article
              key={doctor.id}
              className="doctor-card"
            >

              {/* Doctor Header */}

              <div className="doctor-card-top">

                <div className="doctor-avatar">

                  {doctor.profile_photo ? (

                    <img
                      src={doctor.profile_photo}
                      alt={doctor.name}
                    />

                  ) : (

                    <span>Dr</span>

                  )}

                </div>

                <div className="doctor-card-name">

                  <h2>
                    {doctor.name}
                  </h2>

                  <p className="doctor-specialization">
                    {doctor.specialization}
                  </p>

                </div>

              </div>


              {/* Doctor Information */}

              <div className="doctor-info">

                <div className="doctor-info-row">

                  <span className="doctor-info-icon">
                    +
                  </span>

                  <span>
                    {doctor.qualification}
                    {" • "}
                    {doctor.years_of_experience}
                    {" years experience"}
                  </span>

                </div>


                <div className="doctor-info-row">

                  <span className="doctor-info-icon">
                    □
                  </span>

                  <span>
                    <strong>
                      {doctor.clinic_name}
                    </strong>
                  </span>

                </div>


                <div className="doctor-info-row">

                  <span className="doctor-info-icon">
                    ●
                  </span>

                  <span>
                    {doctor.city}, {doctor.state}
                  </span>

                </div>

              </div>


              {/* Sub Specialization */}

              {doctor.sub_specialization && (

                <div className="doctor-sub-specialization">

                  <span className="sub-label">
                    SPECIALIZATION
                  </span>

                  <strong>
                    {doctor.sub_specialization}
                  </strong>

                </div>

              )}


              {/* Consultation */}

              <div className="doctor-consultation">

                <div className="doctor-fee-container">

                  <span className="doctor-fee-label">
                    CONSULTATION FEE
                  </span>

                  <span className="doctor-fee">
                    ${doctor.consultation_fee}
                  </span>

                </div>

                <span className="doctor-mode">
                  {doctor.consultation_mode}
                </span>

              </div>


              {/* Status */}

              <div
                className={`doctor-status ${
                  doctor.accepting_new_patients
                    ? "available"
                    : "unavailable"
                }`}
              >

                <span className="status-dot"></span>

                {doctor.accepting_new_patients
                  ? "Accepting new patients"
                  : "Not accepting new patients"}

              </div>


              {/* Profile Button */}

              <button
                type="button"
                className="doctor-profile-button"
                onClick={() =>
                  alert(
                    `Doctor profile for ${doctor.name} will be available next.`
                  )
                }
              >
                View Profile
              </button>

            </article>

          ))}

        </div>

      )}

    </div>
  );
}

export default DoctorList;