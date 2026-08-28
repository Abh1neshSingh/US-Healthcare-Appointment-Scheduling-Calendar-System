import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

const API_URL = "http://127.0.0.1:8000";

function AdminDashboard() {
  const navigate = useNavigate();

  // Common states
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Form visibility
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [showReceptionistForm, setShowReceptionistForm] =
    useState(false);

  // =========================
  // Doctor states
  // =========================

  const [doctorName, setDoctorName] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorPassword, setDoctorPassword] = useState("");

  const [licenseNumber, setLicenseNumber] = useState("");
  const [npiNumber, setNpiNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [subSpecialization, setSubSpecialization] =
    useState("");
  const [qualification, setQualification] = useState("");
  const [medicalSchool, setMedicalSchool] = useState("");
  const [boardCertification, setBoardCertification] =
    useState("");
  const [experience, setExperience] = useState("");
  const [department, setDepartment] = useState("");

  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [consultationFee, setConsultationFee] =
    useState("");
  const [consultationMode, setConsultationMode] =
    useState("IN_PERSON");

  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState("");
  const [acceptingPatients, setAcceptingPatients] =
    useState(true);

  // =========================
  // Receptionist states
  // =========================

  const [receptionistName, setReceptionistName] =
    useState("");
  const [receptionistEmail, setReceptionistEmail] =
    useState("");
  const [receptionistPassword, setReceptionistPassword] =
    useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [receptionistDepartment, setReceptionistDepartment] =
    useState("");
  const [receptionistPhone, setReceptionistPhone] =
    useState("");
  const [hireDate, setHireDate] = useState("");
  const [shift, setShift] = useState("");
  const [clinicLocation, setClinicLocation] =
    useState("");
  // =========================
// Admin states
// =========================

const [showAdminForm, setShowAdminForm] = useState(false);

const [adminName, setAdminName] = useState("");
const [adminEmail, setAdminEmail] = useState("");
const [adminPassword, setAdminPassword] = useState("");

// =========================
// View states
// =========================

const [showDoctors, setShowDoctors] = useState(false);
const [showReceptionists, setShowReceptionists] = useState(false);
const [showPatients, setShowPatients] = useState(false);

const [doctors, setDoctors] = useState<any[]>([]);
const [receptionists, setReceptionists] = useState<any[]>([]);
const [patients, setPatients] = useState<any[]>([]);

    // =========================
  // Logout
  // =========================

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/login");
  };

  // =========================
  // Create Doctor
  // =========================

  const handleCreateDoctor = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/users/doctors`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: doctorName,
            email: doctorEmail,
            password: doctorPassword,
            license_number: licenseNumber,
            npi_number: npiNumber || null,
            specialization,
            sub_specialization:
              subSpecialization || null,
            qualification,
            medical_school:
              medicalSchool || null,
            board_certification:
              boardCertification || null,
            years_of_experience: experience
              ? Number(experience)
              : null,
            department: department || null,
            clinic_name: clinicName || null,
            clinic_address:
              clinicAddress || null,
            city: city || null,
            state: state || null,
            zip_code: zipCode || null,
            consultation_fee: consultationFee
              ? Number(consultationFee)
              : null,
            consultation_mode: consultationMode,
            bio: bio || null,
            languages: languages || null,
            accepting_new_patients:
              acceptingPatients,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to create doctor"
        );
        return;
      }

      setMessage(
        "Doctor created successfully!"
      );

      setDoctorName("");
      setDoctorEmail("");
      setDoctorPassword("");
      setLicenseNumber("");
      setNpiNumber("");
      setSpecialization("");
      setSubSpecialization("");
      setQualification("");
      setMedicalSchool("");
      setBoardCertification("");
      setExperience("");
      setDepartment("");
      setClinicName("");
      setClinicAddress("");
      setCity("");
      setState("");
      setZipCode("");
      setConsultationFee("");
      setConsultationMode("IN_PERSON");
      setBio("");
      setLanguages("");
      setAcceptingPatients(true);
    } catch (error) {
      console.error(error);
      setMessage(
        "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // Create Receptionist
  // =========================

  const handleCreateReceptionist = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/users/receptionists`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: receptionistName,
            email: receptionistEmail,
            password: receptionistPassword,
            employee_id: employeeId,
            department:
              receptionistDepartment || null,
            phone:
              receptionistPhone || null,
            hire_date:
              hireDate || null,
            shift: shift || null,
            clinic_location:
              clinicLocation || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to create receptionist"
        );
        return;
      }

      setMessage(
        "Receptionist created successfully!"
      );

      setReceptionistName("");
      setReceptionistEmail("");
      setReceptionistPassword("");
      setEmployeeId("");
      setReceptionistDepartment("");
      setReceptionistPhone("");
      setHireDate("");
      setShift("");
      setClinicLocation("");
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // Create Admin
  // =========================

  const handleCreateAdmin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/users/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to create admin"
        );
        return;
      }

      setMessage(
        "Admin created successfully!"
      );

      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // View Doctors
  // =========================

  const handleViewDoctors = async () => {
    setLoading(true);
    setMessage("");

    setShowDoctorForm(false);
    setShowReceptionistForm(false);
    setShowAdminForm(false);

    setShowReceptionists(false);
    setShowPatients(false);

    try {
      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/users/doctors`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to load doctors"
        );
        return;
      }

      setDoctors(data.doctors || []);
      setShowDoctors(true);
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // View Receptionists
  // =========================

  const handleViewReceptionists = async () => {
    setLoading(true);
    setMessage("");

    setShowDoctorForm(false);
    setShowReceptionistForm(false);
    setShowAdminForm(false);

    setShowDoctors(false);
    setShowPatients(false);

    try {
      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/users/receptionists`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to load receptionists"
        );
        return;
      }

      setReceptionists(
        data.receptionists || []
      );

      setShowReceptionists(true);
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to connect to the server"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // View Patients
  // =========================

  const handleViewPatients = async () => {
    setLoading(true);
    setMessage("");

    setShowDoctorForm(false);
    setShowReceptionistForm(false);
    setShowAdminForm(false);

    setShowDoctors(false);
    setShowReceptionists(false);

    try {
      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_URL}/users/patients`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail ||
            "Unable to load patients"
        );
        return;
      }

      setPatients(data.patients || []);
      setShowPatients(true);
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
  <div className="admin-layout">

    {/* =========================
        Sidebar
    ========================= */}

    <aside className="admin-sidebar">
      <div className="brand">
        <div className="brand-icon">♥</div>

        <div>
          <div className="brand-name">HealthCare</div>
          <div className="brand-subtitle">
            Appointment System
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className="sidebar-item active"
          onClick={() => {
            setShowDoctorForm(false);
            setShowReceptionistForm(false);
            setShowAdminForm(false);
            setShowDoctors(false);
            setShowReceptionists(false);
            setShowPatients(false);
            setMessage("");
          }}
        >
          <span>▦</span>
          Dashboard
        </button>

        <button
          className="sidebar-item"
          onClick={() => {
            setShowDoctorForm(true);
            setShowReceptionistForm(false);
            setShowAdminForm(false);
            setShowDoctors(false);
            setShowReceptionists(false);
            setShowPatients(false);
            setMessage("");
          }}
        >
          <span>+</span>
          Create Doctor
        </button>

        <button
          className="sidebar-item"
          onClick={() => {
            setShowDoctorForm(false);
            setShowReceptionistForm(true);
            setShowAdminForm(false);
            setShowDoctors(false);
            setShowReceptionists(false);
            setShowPatients(false);
            setMessage("");
          }}
        >
          <span>+</span>
          Create Receptionist
        </button>

        <button
          className="sidebar-item"
          onClick={() => {
            setShowDoctorForm(false);
            setShowReceptionistForm(false);
            setShowAdminForm(true);
            setShowDoctors(false);
            setShowReceptionists(false);
            setShowPatients(false);
            setMessage("");
          }}
        >
          <span>+</span>
          Create Admin
        </button>

        <div className="sidebar-divider" />

        <button
          className="sidebar-item"
          onClick={handleViewPatients}
        >
          <span>♙</span>
          Patients
        </button>

        <button
          className="sidebar-item"
          onClick={handleViewDoctors}
        >
          <span>♙</span>
          Doctors
        </button>

        <button
          className="sidebar-item"
          onClick={handleViewReceptionists}
        >
          <span>♙</span>
          Receptionists
        </button>
      </nav>

      <button
        className="sidebar-logout"
        onClick={handleLogout}
      >
        ↪ Logout
      </button>
    </aside>

    {/* =========================
        Main Content
    ========================= */}

    <main className="admin-main">

      {/* Header */}

      <header className="admin-header">
        <div>
          <div className="breadcrumb">
            Dashboard
          </div>

          <h1>
            Good morning, Admin 👋
          </h1>

          <p>
            Manage your healthcare appointment system
            from one place.
          </p>
        </div>

        <div className="admin-profile">
          <div className="profile-avatar">
            A
          </div>

          <div>
            <strong>Administrator</strong>
            <span>System Admin</span>
          </div>
        </div>
      </header>

      {/* =========================
          Stats
      ========================= */}

      {!showDoctorForm &&
        !showReceptionistForm &&
        !showAdminForm &&
        !showDoctors &&
        !showReceptionists &&
        !showPatients && (
          <>
            <section className="stats-grid">

              <div className="stat-card">
                <div className="stat-icon blue">
                  ♙
                </div>

                <div>
                  <span>Doctors</span>
                  <strong>{doctors.length}</strong>
                  <small>Registered doctors</small>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green">
                  ♙
                </div>

                <div>
                  <span>Patients</span>
                  <strong>{patients.length}</strong>
                  <small>Registered patients</small>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon purple">
                  ♙
                </div>

                <div>
                  <span>Receptionists</span>
                  <strong>
                    {receptionists.length}
                  </strong>
                  <small>Active staff</small>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon orange">
                  ✓
                </div>

                <div>
                  <span>System</span>
                  <strong>Active</strong>
                  <small>All services running</small>
                </div>
              </div>

            </section>

            {/* Quick Actions */}

            <section className="dashboard-card">

              <div className="section-header">
                <div>
                  <h2>Quick Actions</h2>
                  <p>
                    Create and manage healthcare staff
                  </p>
                </div>
              </div>

              <div className="quick-actions">

                <button
                  className="quick-action blue-action"
                  onClick={() => {
                    setShowDoctorForm(true);
                    setMessage("");
                  }}
                >
                  <span className="action-icon">
                    +
                  </span>

                  <div>
                    <strong>Create Doctor</strong>
                    <small>
                      Add a new healthcare provider
                    </small>
                  </div>
                </button>

                <button
                  className="quick-action green-action"
                  onClick={() => {
                    setShowReceptionistForm(true);
                    setMessage("");
                  }}
                >
                  <span className="action-icon">
                    +
                  </span>

                  <div>
                    <strong>Create Receptionist</strong>
                    <small>
                      Add front desk staff
                    </small>
                  </div>
                </button>

                <button
                  className="quick-action purple-action"
                  onClick={() => {
                    setShowAdminForm(true);
                    setMessage("");
                  }}
                >
                  <span className="action-icon">
                    +
                  </span>

                  <div>
                    <strong>Create Admin</strong>
                    <small>
                      Add another administrator
                    </small>
                  </div>
                </button>

              </div>
            </section>

            {/* Directory */}

            <section className="dashboard-card">

              <div className="section-header">
                <div>
                  <h2>People Directory</h2>
                  <p>
                    View registered users in the system
                  </p>
                </div>
              </div>

              <div className="directory-grid">

                <button
                  onClick={handleViewPatients}
                  className="directory-card"
                >
                  <span>♙</span>
                  <strong>Patients</strong>
                  <small>
                    View patient records
                  </small>
                </button>

                <button
                  onClick={handleViewDoctors}
                  className="directory-card"
                >
                  <span>♙</span>
                  <strong>Doctors</strong>
                  <small>
                    View doctor profiles
                  </small>
                </button>

                <button
                  onClick={handleViewReceptionists}
                  className="directory-card"
                >
                  <span>♙</span>
                  <strong>Receptionists</strong>
                  <small>
                    View staff members
                  </small>
                </button>

              </div>
            </section>
          </>
        )}

      {/* =========================
          Doctor Form
      ========================= */}

      {showDoctorForm && (
        <div className="modern-form-card">

          <div className="form-page-header">
            <div>
              <span className="form-badge">
                Healthcare Staff
              </span>

              <h2>Create Doctor</h2>

              <p>
                Add a new doctor to your healthcare
                network.
              </p>
            </div>

            <button
              className="close-button"
              type="button"
              onClick={() =>
                setShowDoctorForm(false)
              }
            >
              ×
            </button>
          </div>

          <form onSubmit={handleCreateDoctor}>

            <div className="form-section">
              <h3>Account Information</h3>
              <p>Basic login information</p>

              <div className="form-grid">

                <div className="modern-field">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    placeholder="Dr. John Anderson"
                    value={doctorName}
                    onChange={(e) =>
                      setDoctorName(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    placeholder="doctor@example.com"
                    value={doctorEmail}
                    onChange={(e) =>
                      setDoctorEmail(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Password *</label>
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={doctorPassword}
                    onChange={(e) =>
                      setDoctorPassword(e.target.value)
                    }
                    minLength={8}
                    required
                  />
                </div>

              </div>
            </div>

            <div className="form-section">
              <h3>Professional Information</h3>
              <p>Doctor credentials and specialization</p>

              <div className="form-grid">

                <div className="modern-field">
                  <label>License Number *</label>
                  <input
                    value={licenseNumber}
                    placeholder="License number"
                    onChange={(e) =>
                      setLicenseNumber(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>NPI Number</label>
                  <input
                    value={npiNumber}
                    placeholder="10-digit NPI"
                    onChange={(e) =>
                      setNpiNumber(e.target.value)
                    }
                    maxLength={10}
                  />
                </div>

                <div className="modern-field">
                  <label>Specialization *</label>
                  <input
                    value={specialization}
                    placeholder="e.g. Cardiology"
                    onChange={(e) =>
                      setSpecialization(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Sub-Specialization</label>
                  <input
                    value={subSpecialization}
                    placeholder="e.g. Interventional Cardiology"
                    onChange={(e) =>
                      setSubSpecialization(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Qualification *</label>
                  <input
                    value={qualification}
                    placeholder="e.g. MD, DO"
                    onChange={(e) =>
                      setQualification(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Medical School</label>
                  <input
                    value={medicalSchool}
                    placeholder="Medical school"
                    onChange={(e) =>
                      setMedicalSchool(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Board Certification</label>
                  <input
                    value={boardCertification}
                    placeholder="Board certification"
                    onChange={(e) =>
                      setBoardCertification(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    max="70"
                    placeholder="Years"
                    value={experience}
                    onChange={(e) =>
                      setExperience(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Department</label>
                  <input
                    value={department}
                    placeholder="e.g. Cardiology"
                    onChange={(e) =>
                      setDepartment(e.target.value)
                    }
                  />
                </div>

              </div>
            </div>

            <div className="form-section">
              <h3>Practice Information</h3>
              <p>Clinic and consultation details</p>

              <div className="form-grid">

                <div className="modern-field">
                  <label>Clinic Name</label>
                  <input
                    value={clinicName}
                    placeholder="Clinic name"
                    onChange={(e) =>
                      setClinicName(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Clinic Address</label>
                  <input
                    value={clinicAddress}
                    placeholder="Street address"
                    onChange={(e) =>
                      setClinicAddress(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>City</label>
                  <input
                    value={city}
                    placeholder="City"
                    onChange={(e) =>
                      setCity(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>State</label>
                  <input
                    value={state}
                    placeholder="State"
                    onChange={(e) =>
                      setState(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>ZIP Code</label>
                  <input
                    value={zipCode}
                    placeholder="ZIP code"
                    onChange={(e) =>
                      setZipCode(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Consultation Fee</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="$0.00"
                    value={consultationFee}
                    onChange={(e) =>
                      setConsultationFee(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Consultation Mode</label>
                  <select
                    value={consultationMode}
                    onChange={(e) =>
                      setConsultationMode(e.target.value)
                    }
                  >
                    <option value="IN_PERSON">
                      In Person
                    </option>
                    <option value="TELEHEALTH">
                      Telehealth
                    </option>
                    <option value="BOTH">
                      Both
                    </option>
                  </select>
                </div>

              </div>
            </div>

            <div className="form-section">
              <h3>Profile</h3>
              <p>Public doctor profile information</p>

              <div className="form-grid">

                <div className="modern-field full">
                  <label>Bio</label>
                  <textarea
                    rows={4}
                    placeholder="Short professional biography..."
                    value={bio}
                    onChange={(e) =>
                      setBio(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Languages</label>
                  <input
                    placeholder="English, Spanish"
                    value={languages}
                    onChange={(e) =>
                      setLanguages(e.target.value)
                    }
                  />
                </div>

              </div>

              <label className="check-row">
                <input
                  type="checkbox"
                  checked={acceptingPatients}
                  onChange={(e) =>
                    setAcceptingPatients(
                      e.target.checked
                    )
                  }
                />
                <span>
                  Accepting new patients
                </span>
              </label>
            </div>

            <div className="form-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowDoctorForm(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading
                  ? "Creating Doctor..."
                  : "Create Doctor"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* =========================
          Receptionist Form
      ========================= */}

      {showReceptionistForm && (
        <div className="modern-form-card">

          <div className="form-page-header">
            <div>
              <span className="form-badge">
                Healthcare Staff
              </span>

              <h2>Create Receptionist</h2>

              <p>
                Add a new receptionist to your
                healthcare team.
              </p>
            </div>

            <button
              className="close-button"
              type="button"
              onClick={() =>
                setShowReceptionistForm(false)
              }
            >
              ×
            </button>
          </div>

          <form onSubmit={handleCreateReceptionist}>

            <div className="form-section">
              <h3>Account Information</h3>

              <div className="form-grid">

                <div className="modern-field">
                  <label>Full Name *</label>
                  <input
                    placeholder="Sarah Johnson"
                    value={receptionistName}
                    onChange={(e) =>
                      setReceptionistName(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    placeholder="staff@example.com"
                    value={receptionistEmail}
                    onChange={(e) =>
                      setReceptionistEmail(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Password *</label>
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={receptionistPassword}
                    onChange={(e) =>
                      setReceptionistPassword(
                        e.target.value
                      )
                    }
                    minLength={8}
                    required
                  />
                </div>

              </div>
            </div>

            <div className="form-section">
              <h3>Employee Information</h3>

              <div className="form-grid">

                <div className="modern-field">
                  <label>Employee ID *</label>
                  <input
                    placeholder="EMP-1001"
                    value={employeeId}
                    onChange={(e) =>
                      setEmployeeId(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Department</label>
                  <input
                    placeholder="Front Desk"
                    value={receptionistDepartment}
                    onChange={(e) =>
                      setReceptionistDepartment(
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Phone</label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={receptionistPhone}
                    onChange={(e) =>
                      setReceptionistPhone(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Hire Date</label>
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) =>
                      setHireDate(e.target.value)
                    }
                  />
                </div>

                <div className="modern-field">
                  <label>Shift</label>
                  <select
                    value={shift}
                    onChange={(e) =>
                      setShift(e.target.value)
                    }
                  >
                    <option value="">
                      Select Shift
                    </option>
                    <option value="MORNING">
                      Morning
                    </option>
                    <option value="AFTERNOON">
                      Afternoon
                    </option>
                    <option value="EVENING">
                      Evening
                    </option>
                    <option value="NIGHT">
                      Night
                    </option>
                  </select>
                </div>

                <div className="modern-field">
                  <label>Clinic Location</label>
                  <input
                    placeholder="Main Clinic"
                    value={clinicLocation}
                    onChange={(e) =>
                      setClinicLocation(e.target.value)
                    }
                  />
                </div>

              </div>
            </div>

            <div className="form-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowReceptionistForm(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading
                  ? "Creating Receptionist..."
                  : "Create Receptionist"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* =========================
          Admin Form
      ========================= */}

      {showAdminForm && (
        <div className="modern-form-card">

          <div className="form-page-header">
            <div>
              <span className="form-badge">
                Administration
              </span>

              <h2>Create Admin</h2>

              <p>
                Create another administrator account.
              </p>
            </div>

            <button
              className="close-button"
              type="button"
              onClick={() =>
                setShowAdminForm(false)
              }
            >
              ×
            </button>
          </div>

          <form onSubmit={handleCreateAdmin}>

            <div className="form-section">
              <h3>Admin Account Information</h3>

              <div className="form-grid">

                <div className="modern-field">
                  <label>Full Name *</label>
                  <input
                    placeholder="Administrator Name"
                    value={adminName}
                    onChange={(e) =>
                      setAdminName(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={adminEmail}
                    onChange={(e) =>
                      setAdminEmail(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="modern-field">
                  <label>Password *</label>
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={adminPassword}
                    onChange={(e) =>
                      setAdminPassword(e.target.value)
                    }
                    minLength={8}
                    required
                  />
                </div>

              </div>
            </div>

            <div className="form-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowAdminForm(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading
                  ? "Creating Admin..."
                  : "Create Admin"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* =========================
          Lists
      ========================= */}

      {showDoctors && (
        <div className="dashboard-card table-card">
          <div className="section-header">
            <div>
              <span className="form-badge">
                Directory
              </span>
              <h2>Doctors</h2>
              <p>Registered healthcare providers</p>
            </div>

            <button
              className="secondary-button"
              onClick={() => setShowDoctors(false)}
            >
              Close
            </button>
          </div>

          {doctors.length === 0 ? (
            <div className="empty-state">
              No doctors found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Specialization</th>
                    <th>License</th>
                    <th>Department</th>
                    <th>Experience</th>
                    <th>Clinic</th>
                    <th>Mode</th>
                  </tr>
                </thead>

                <tbody>
                  {doctors.map((doctor) => (
                    <tr key={doctor.id}>
                      <td>
                        <strong>{doctor.name}</strong>
                      </td>
                      <td>{doctor.email}</td>
                      <td>
                        {doctor.specialization}
                      </td>
                      <td>
                        {doctor.license_number}
                      </td>
                      <td>
                        {doctor.department || "-"}
                      </td>
                      <td>
                        {doctor.years_of_experience ?? "-"} yrs
                      </td>
                      <td>
                        {doctor.clinic_name || "-"}
                      </td>
                      <td>
                        {doctor.consultation_mode || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showReceptionists && (
        <div className="dashboard-card table-card">

          <div className="section-header">
            <div>
              <span className="form-badge">
                Directory
              </span>

              <h2>Receptionists</h2>

              <p>
                Healthcare support staff
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() =>
                setShowReceptionists(false)
              }
            >
              Close
            </button>
          </div>

          {receptionists.length === 0 ? (
            <div className="empty-state">
              No receptionists found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Phone</th>
                    <th>Shift</th>
                    <th>Clinic</th>
                  </tr>
                </thead>

                <tbody>
                  {receptionists.map(
                    (receptionist) => (
                      <tr key={receptionist.id}>
                        <td>
                          <strong>
                            {receptionist.name}
                          </strong>
                        </td>

                        <td>
                          {receptionist.email}
                        </td>

                        <td>
                          {receptionist.employee_id}
                        </td>

                        <td>
                          {receptionist.department ||
                            "-"}
                        </td>

                        <td>
                          {receptionist.phone || "-"}
                        </td>

                        <td>
                          {receptionist.shift || "-"}
                        </td>

                        <td>
                          {receptionist.clinic_location ||
                            "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showPatients && (
        <div className="dashboard-card table-card">

          <div className="section-header">
            <div>
              <span className="form-badge">
                Directory
              </span>

              <h2>Patients</h2>

              <p>
                Registered patient records
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() =>
                setShowPatients(false)
              }
            >
              Close
            </button>
          </div>

          {patients.length === 0 ? (
            <div className="empty-state">
              No patients found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Date of Birth</th>
                    <th>Gender</th>
                    <th>Phone</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Insurance</th>
                  </tr>
                </thead>

                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <strong>{patient.name}</strong>
                      </td>

                      <td>{patient.email}</td>

                      <td>
                        {patient.date_of_birth || "-"}
                      </td>

                      <td>
                        {patient.gender || "-"}
                      </td>

                      <td>
                        {patient.phone || "-"}
                      </td>

                      <td>
                        {patient.city || "-"}
                      </td>

                      <td>
                        {patient.state || "-"}
                      </td>

                      <td>
                        {patient.insurance_provider ||
                          "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {message && (
        <div className="system-message">
          {message}
        </div>
      )}

    </main>
  </div>
);
}

export default AdminDashboard;