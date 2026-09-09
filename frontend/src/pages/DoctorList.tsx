import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API_URL from "../config";
import "./DoctorList.css";

interface Doctor {
  id: number;
  name: string;
  specialization?: string | null;
  sub_specialization?: string | null;
  qualification?: string | null;
  years_of_experience?: number | null;
  department?: string | null;
  clinic_name?: string | null;
  city?: string | null;
  state?: string | null;
  consultation_fee?: number | string | null;
  consultation_mode?: string | null;
  bio?: string | null;
  languages?: string | null;
  profile_photo?: string | null;
  accepting_new_patients?: boolean | null;
  requires_referral?: boolean | null;
}

interface DoctorsResponse {
  count?: number;
  doctors?: Doctor[];
  detail?: string;
}

const cleanText = (value?: string | null): string => {
  return typeof value === "string" ? value.trim() : "";
};

const getInitials = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "DR"
  );
};

const formatLocation = (doctor: Doctor): string => {
  const parts = [
    cleanText(doctor.city),
    cleanText(doctor.state),
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(", ")
    : "Location not provided";
};

const formatExperience = (
  years?: number | null,
): string => {
  if (
    years === null ||
    years === undefined ||
    Number.isNaN(Number(years))
  ) {
    return "Experience not provided";
  }

  const value = Number(years);

  return `${value} ${
    value === 1 ? "year" : "years"
  } experience`;
};

const formatFee = (
  fee?: number | string | null,
): string => {
  if (
    fee === null ||
    fee === undefined ||
    fee === ""
  ) {
    return "Consultation fee not provided";
  }

  const numericFee = Number(fee);

  if (Number.isNaN(numericFee)) {
    return "Consultation fee not provided";
  }

  return `$${numericFee.toFixed(2)}`;
};

const formatMode = (
  mode?: string | null,
): string => {
  switch (mode) {
    case "TELEHEALTH":
      return "Telehealth";

    case "BOTH":
      return "In Person + Telehealth";

    case "IN_PERSON":
      return "In Person";

    default:
      return "";
  }
};

const DoctorList: React.FC = () => {
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("ALL");

  const [selectedDoctor, setSelectedDoctor] =
    useState<Doctor | null>(null);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("access_token");

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/users/doctors`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      /*
       * Keep the successful API response typed as either:
       * 1. Doctor[]
       * 2. DoctorsResponse
       *
       * Error responses are handled through the same
       * object shape instead of adding a third union type.
       * This prevents TypeScript errors when accessing
       * `detail` and `doctors`.
       */
      let data: DoctorsResponse | Doctor[] = {};

      try {
        const responseData: unknown =
          await response.json();

        if (Array.isArray(responseData)) {
          data = responseData as Doctor[];
        } else if (
          responseData !== null &&
          typeof responseData === "object"
        ) {
          data = responseData as DoctorsResponse;
        }
      } catch {
        data = {};
      }

      if (!response.ok) {
        const errorData = Array.isArray(data)
          ? {}
          : data;

        const detail =
          typeof errorData.detail === "string"
            ? errorData.detail
            : "Unable to load doctors.";

        if (response.status === 401) {
          localStorage.removeItem(
            "access_token",
          );

          navigate("/login");
          return;
        }

        throw new Error(detail);
      }

      const doctorList = Array.isArray(data)
        ? data
        : data.doctors ?? [];

      setDoctors(doctorList);
    } catch (err) {
      console.error(
        "Doctor list error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load doctors.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDoctors();
  }, []);

  const specialties = useMemo(() => {
    return Array.from(
      new Set(
        doctors
          .map(
            (doctor) =>
              cleanText(
                doctor.specialization,
              ) ||
              cleanText(
                doctor.department,
              ),
          )
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return doctors.filter((doctor) => {
      const name =
        cleanText(
          doctor.name,
        ).toLowerCase();

      const doctorSpecialty = (
        cleanText(
          doctor.specialization,
        ) ||
        cleanText(
          doctor.department,
        )
      ).toLowerCase();

      const department =
        cleanText(
          doctor.department,
        ).toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        doctorSpecialty.includes(query) ||
        department.includes(query);

      const matchesSpecialty =
        specialty === "ALL" ||
        doctorSpecialty ===
          specialty.toLowerCase();

      return (
        matchesSearch &&
        matchesSpecialty
      );
    });
  }, [
    doctors,
    search,
    specialty,
  ]);

  const handleBack = () => {
    navigate("/patient");
  };

  const renderStatus = (
    doctor: Doctor,
  ) => {
    if (
      doctor.accepting_new_patients ===
      true
    ) {
      return (
        <div className="doctor-status available">
          <span className="status-dot" />
          <span>
            Accepting new patients
          </span>
        </div>
      );
    }

    if (
      doctor.accepting_new_patients ===
      false
    ) {
      return (
        <div className="doctor-status unavailable">
          <span className="status-dot" />
          <span>
            Not accepting new patients
          </span>
        </div>
      );
    }

    return (
      <div className="doctor-status unknown">
        <span className="status-dot" />
        <span>
          Availability status not provided
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <main className="doctor-list-page">
        <div className="doctor-list-loading">
          <span className="loading-spinner" />

          <p>
            Loading healthcare providers...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="doctor-list-page">
        <section className="doctor-list-error">
          <div className="error-icon">
            !
          </div>

          <h2>
            Unable to load doctors
          </h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              void fetchDoctors()
            }
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="doctor-list-page">
      <div className="doctor-list-shell">

        {/* HEADER */}
        <header className="doctor-list-header">
          <div className="doctor-list-heading">
            <span className="page-label">
              HEALTHCARE PROVIDERS
            </span>

            <h1>
              Find a Doctor
            </h1>

            <p>
              Browse available doctors and
              choose the right healthcare
              professional for your needs.
            </p>
          </div>

          <button
            type="button"
            className="doctor-back-button"
            onClick={handleBack}
          >
            <span aria-hidden="true">
              ←
            </span>

            Back to Dashboard
          </button>
        </header>

        {/* CONTROLS */}
        <section className="doctor-list-controls">
          <div className="doctor-list-summary">
            <strong>
              {filteredDoctors.length}
            </strong>

            <span>
              {filteredDoctors.length === 1
                ? "doctor"
                : "doctors"}{" "}
              available
            </span>
          </div>

          <div className="doctor-list-filters">
            <label className="doctor-search">
              <span
                className="filter-icon"
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search by doctor or specialty"
                aria-label="Search doctors"
              />

              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() =>
                    setSearch("")
                  }
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </label>

            <select
              value={specialty}
              onChange={(event) =>
                setSpecialty(
                  event.target.value,
                )
              }
              aria-label="Filter by specialty"
              className="specialty-filter"
            >
              <option value="ALL">
                All specialties
              </option>

              {specialties.map((item) => (
                <option
                  value={item}
                  key={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* DOCTOR LIST */}
        {filteredDoctors.length === 0 ? (
          <section className="doctor-list-empty">
            <div className="empty-icon">
              ⌕
            </div>

            <h2>
              No doctors found
            </h2>

            <p>
              Try another doctor name or
              specialty.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSpecialty("ALL");
              }}
            >
              Clear filters
            </button>
          </section>
        ) : (
          <section className="doctor-grid">
            {filteredDoctors.map(
              (doctor) => {
                const specialization =
                  cleanText(
                    doctor.specialization,
                  ) ||
                  cleanText(
                    doctor.department,
                  ) ||
                  "Healthcare Provider";

                const mode = formatMode(
                  doctor.consultation_mode,
                );

                return (
                  <article
                    className="doctor-card"
                    key={doctor.id}
                  >
                    {/* CARD HEADER */}
                    <div className="doctor-card-top">
                      <div className="doctor-avatar">
                        {doctor.profile_photo ? (
                          <>
                            <img
                              src={
                                doctor.profile_photo
                              }
                              alt=""
                              onError={(
                                event,
                              ) => {
                                event.currentTarget.style.display =
                                  "none";
                              }}
                            />

                            <span className="doctor-avatar-fallback">
                              {getInitials(
                                doctor.name,
                              )}
                            </span>
                          </>
                        ) : (
                          getInitials(
                            doctor.name,
                          )
                        )}
                      </div>

                      <div className="doctor-card-name">
                        <h2>
                          {doctor.name}
                        </h2>

                        <p className="doctor-specialization">
                          {specialization}
                        </p>
                      </div>
                    </div>

                    {/* INFO */}
                    <div className="doctor-info">
                      <div className="doctor-info-row">
                        <span
                          className="doctor-info-icon"
                          aria-hidden="true"
                        >
                          +
                        </span>

                        <span>
                          {formatExperience(
                            doctor.years_of_experience,
                          )}
                        </span>
                      </div>

                      <div className="doctor-info-row">
                        <span
                          className="doctor-info-icon"
                          aria-hidden="true"
                        >
                          □
                        </span>

                        <span>
                          {cleanText(
                            doctor.qualification,
                          ) ||
                            "Qualification not provided"}
                        </span>
                      </div>

                      <div className="doctor-info-row">
                        <span
                          className="doctor-info-icon"
                          aria-hidden="true"
                        >
                          •
                        </span>

                        <span>
                          {formatLocation(
                            doctor,
                          )}
                        </span>
                      </div>
                    </div>

                    {/* SUB SPECIALIZATION */}
                    {cleanText(
                      doctor.sub_specialization,
                    ) && (
                      <div className="doctor-sub-specialization">
                        <span className="sub-label">
                          SPECIALTY
                        </span>

                        <strong>
                          {
                            doctor.sub_specialization
                          }
                        </strong>
                      </div>
                    )}

                    {/* CONSULTATION */}
                    <div className="doctor-consultation">
                      <div className="doctor-fee-container">
                        <span className="doctor-fee-label">
                          CONSULTATION FEE
                        </span>

                        <strong className="doctor-fee">
                          {formatFee(
                            doctor.consultation_fee,
                          )}
                        </strong>
                      </div>

                      {mode && (
                        <span className="doctor-mode">
                          {mode}
                        </span>
                      )}
                    </div>

                    {/* STATUS */}
                    {renderStatus(
                      doctor,
                    )}

                    {/* ACTION */}
                    <button
                      type="button"
                      className="doctor-profile-button"
                      onClick={() =>
                        setSelectedDoctor(
                          doctor,
                        )
                      }
                    >
                      View Profile
                    </button>
                  </article>
                );
              },
            )}
          </section>
        )}
      </div>

      {/* PROFILE MODAL */}
      {selectedDoctor && (
        <div
          className="doctor-profile-overlay"
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
            className="doctor-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doctor-profile-title"
          >
            <button
              type="button"
              className="doctor-profile-close"
              onClick={() =>
                setSelectedDoctor(
                  null,
                )
              }
              aria-label="Close doctor profile"
            >
              ×
            </button>

            <div className="doctor-profile-hero">
              <div className="doctor-profile-avatar">
                {selectedDoctor.profile_photo ? (
                  <img
                    src={
                      selectedDoctor.profile_photo
                    }
                    alt=""
                  />
                ) : (
                  getInitials(
                    selectedDoctor.name,
                  )
                )}
              </div>

              <div>
                <span className="modal-kicker">
                  HEALTHCARE PROVIDER
                </span>

                <h2 id="doctor-profile-title">
                  {selectedDoctor.name}
                </h2>

                <p>
                  {cleanText(
                    selectedDoctor.specialization,
                  ) ||
                    cleanText(
                      selectedDoctor.department,
                    ) ||
                    "Healthcare Provider"}
                </p>
              </div>
            </div>

            <div className="doctor-profile-status">
              {renderStatus(
                selectedDoctor,
              )}
            </div>

            <div className="doctor-profile-grid">
              <div>
                <span>
                  Experience
                </span>

                <strong>
                  {formatExperience(
                    selectedDoctor.years_of_experience,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Location
                </span>

                <strong>
                  {formatLocation(
                    selectedDoctor,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Consultation
                </span>

                <strong>
                  {formatFee(
                    selectedDoctor.consultation_fee,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Mode
                </span>

                <strong>
                  {formatMode(
                    selectedDoctor.consultation_mode,
                  ) ||
                    "Mode not provided"}
                </strong>
              </div>
            </div>

            {cleanText(
              selectedDoctor.qualification,
            ) && (
              <div className="doctor-profile-section">
                <span>
                  QUALIFICATION
                </span>

                <p>
                  {
                    selectedDoctor.qualification
                  }
                </p>
              </div>
            )}

            {cleanText(
              selectedDoctor.bio,
            ) && (
              <div className="doctor-profile-section">
                <span>
                  ABOUT
                </span>

                <p>
                  {selectedDoctor.bio}
                </p>
              </div>
            )}

            {cleanText(
              selectedDoctor.languages,
            ) && (
              <div className="doctor-profile-section">
                <span>
                  LANGUAGES
                </span>

                <p>
                  {selectedDoctor.languages}
                </p>
              </div>
            )}

            <button
              type="button"
              className="doctor-profile-primary"
              onClick={() => {
                setSelectedDoctor(
                  null,
                );

                navigate("/patient");
              }}
            >
              Continue to Patient Dashboard
            </button>
          </section>
        </div>
      )}
    </main>
  );
};

export default DoctorList;