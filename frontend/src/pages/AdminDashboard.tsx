import {
  type FormEvent,
  type InputHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import API_URL from "../config";
import AdminCalendar from "../components/AdminCalendar";
import "./AdminDashboard.css";

type Role =
  | "DOCTOR"
  | "RECEPTIONIST"
  | "PATIENT"
  | "ADMIN";

type View =
  | "dashboard"
  | "create"
  | "doctors"
  | "receptionists"
  | "patients"
  | "admins"
  | "appointments"
  | "calendar";

interface ApiEnvelope<T = unknown> {
  detail?: string;
  message?: string;
  count?: number;
  doctors?: T[];
  receptionists?: T[];
  patients?: T[];
  admins?: T[];
}

interface AdminProfile {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface StaffAppointment {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_email?: string | null;
  doctor_id: number;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  status_label?: string | null;
  appointment_type?: string | null;
  reason?: string | null;
  notes?: string | null;
}

interface Doctor {
  id: number;
  user_id?: number;
  name: string;
  email?: string;
  specialization?: string | null;
  sub_specialization?: string | null;
  license_number?: string | null;
  npi_number?: string | null;
  qualification?: string | null;
  department?: string | null;
  years_of_experience?: number | null;
  clinic_name?: string | null;
  city?: string | null;
  state?: string | null;
  consultation_fee?: number | string | null;
  consultation_mode?: string | null;
  accepting_new_patients?: boolean | null;
  requires_referral?: boolean | null;
  active?: boolean | null;
}

interface Receptionist {
  id: number;
  user_id?: number;
  name: string;
  email?: string;
  employee_id?: string | null;
  department?: string | null;
  phone?: string | null;
  hire_date?: string | null;
  shift?: string | null;
  clinic_location?: string | null;
}

interface Patient {
  id: number;
  user_id?: number;
  name: string;
  email: string;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  insurance_provider?: string | null;
  insurance_member_id?: string | null;
  pcp_doctor_id?: number | null;
}

interface RoleCard {
  role: Role;
  title: string;
  description: string;
  level: string;
  icon: string;
}

const ROLE_CARDS: RoleCard[] = [
  {
    role: "ADMIN",
    title: "Administrator",
    description:
      "Manage users, staff and platform access.",
    level: "Level 01 · Administration",
    icon: "A",
  },
  {
    role: "DOCTOR",
    title: "Doctor",
    description:
      "Clinical provider with scheduling access.",
    level: "Level 02 · Clinical",
    icon: "D",
  },
  {
    role: "RECEPTIONIST",
    title: "Receptionist",
    description:
      "Front-desk staff for patient operations.",
    level: "Level 03 · Front Desk",
    icon: "R",
  },
  {
    role: "PATIENT",
    title: "Patient",
    description:
      "Patient portal account and healthcare profile.",
    level: "Level 04 · Patient",
    icon: "P",
  },
];

const initialPatient = {
  name: "",
  email: "",
  password: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  city: "",
  state: "",
  insurance_provider: "",
  insurance_member_id: "",
  pcp_doctor_id: "",
};

const initialDoctor = {
  name: "",
  email: "",
  password: "",
  license_number: "",
  npi_number: "",
  specialization: "",
  sub_specialization: "",
  qualification: "",
  medical_school: "",
  board_certification: "",
  years_of_experience: "",
  department: "",
  clinic_name: "",
  clinic_address: "",
  city: "",
  state: "",
  zip_code: "",
  consultation_fee: "",
  consultation_mode: "IN_PERSON",
  bio: "",
  languages: "",
  accepting_new_patients: true,
};

const initialReceptionist = {
  name: "",
  email: "",
  password: "",
  employee_id: "",
  department: "",
  phone: "",
  hire_date: "",
  shift: "",
  clinic_location: "",
};

const initialAdmin = {
  name: "",
  email: "",
  password: "",
};

const getToken = () =>
  localStorage.getItem("access_token");

const getCurrentRole = (): string => {
  const token = getToken();

  if (!token) return "";

  try {
    const payload = JSON.parse(
      atob(
        token
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
      ),
    ) as {
      role?: string;
    };

    return String(
      payload.role || "",
    ).toUpperCase();
  } catch {
    return "";
  }
};

const readJson = async (
  response: Response,
): Promise<
  ApiEnvelope | Record<string, unknown>
> => {
  try {
    const data: unknown =
      await response.json();

    if (
      data !== null &&
      typeof data === "object"
    ) {
      return data as
        | ApiEnvelope
        | Record<string, unknown>;
    }
  } catch {
    // Empty/non-JSON response.
  }

  return {};
};

const getDetail = (
  data:
    | ApiEnvelope
    | Record<string, unknown>,
  fallback: string,
) =>
  typeof data.detail === "string"
    ? data.detail
    : typeof data.message === "string"
      ? data.message
      : fallback;

const getFirstName = (name: string) =>
  name.trim().split(/\s+/)[0] ||
  "Administrator";

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "A";

const formatDate = (
  value?: string | null,
) => {
  if (!value) return "—";

  const date = new Date(
    `${value}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [view, setView] =
    useState<View>("dashboard");

  const [createRole, setCreateRole] =
    useState<Role>("DOCTOR");

  const [createStep, setCreateStep] =
    useState<1 | 2 | 3>(1);

  const [admin, setAdmin] =
    useState<AdminProfile | null>(null);

  const [currentRole, setCurrentRole] =
    useState<string>("");

  const [appointments, setAppointments] =
    useState<StaffAppointment[]>([]);

  const [
    appointmentFilter,
    setAppointmentFilter,
  ] = useState<
    | "ALL"
    | "WAITING"
    | "ATTENDED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "NOT_ATTENDED"
    | "CANCELLED"
  >("ALL");

  const [
    updatingAppointmentId,
    setUpdatingAppointmentId,
  ] = useState<number | null>(null);

  const [doctors, setDoctors] =
    useState<Doctor[]>([]);

  const [
    receptionists,
    setReceptionists,
  ] = useState<Receptionist[]>([]);

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [admins, setAdmins] =
    useState<AdminProfile[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [
    loadingDirectory,
    setLoadingDirectory,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<
      "success" | "error" | "info"
    >("info");

  const [search, setSearch] =
    useState("");

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [doctorForm, setDoctorForm] =
    useState(initialDoctor);

  const [
    receptionistForm,
    setReceptionistForm,
  ] = useState(initialReceptionist);

  const [patientForm, setPatientForm] =
    useState(initialPatient);

  const [adminForm, setAdminForm] =
    useState(initialAdmin);

  const showMessage = useCallback(
    (
      text: string,
      type:
        | "success"
        | "error"
        | "info" = "info",
    ) => {
      setMessage(text);
      setMessageType(type);
    },
    [],
  );

  const handleUnauthorized =
    useCallback(() => {
      localStorage.removeItem(
        "access_token",
      );

      navigate("/login", {
        replace: true,
      });
    }, [navigate]);

  const request = useCallback(
    async (
      path: string,
      options: RequestInit = {},
    ) => {
      const token = getToken();

      if (!token) {
        handleUnauthorized();
        return null;
      }

      const headers = new Headers(
        options.headers,
      );

      headers.set(
        "Authorization",
        `Bearer ${token}`,
      );

      if (options.body) {
        headers.set(
          "Content-Type",
          "application/json",
        );
      }

      const response = await fetch(
        `${API_URL}${path}`,
        {
          ...options,
          headers,
        },
      );

      if (response.status === 401) {
        handleUnauthorized();
        return null;
      }

      const data =
        await readJson(response);

      return {
        response,
        data,
      };
    },
    [handleUnauthorized],
  );

  const loadAdminProfile =
    useCallback(async () => {
      const role = getCurrentRole();

      setCurrentRole(role);

      if (role !== "ADMIN") {
        setAdmin(null);
        return;
      }

      const result = await request(
        "/users/admin/me",
      );

      if (!result) return;

      if (!result.response.ok) {
        return;
      }

      setAdmin(
        result.data as AdminProfile,
      );
    }, [request]);

  const loadDirectories =
    useCallback(async () => {
      setLoadingDirectory(true);

      try {
        /*
         * Read the role directly from the token here.
         * This avoids the first-load React state race where
         * currentRole can still be empty while the requests run.
         */
        const role =
          getCurrentRole();

        setCurrentRole(role);

        const [
          doctorResult,
          receptionistResult,
          patientResult,
          adminResult,
          appointmentResult,
        ] = await Promise.all([
          request("/users/doctors"),

          request(
            "/users/receptionists",
          ),

          request("/users/patients"),

          role === "ADMIN"
            ? request("/users/admins")
            : Promise.resolve(null),

          request(
            "/appointments/staff",
          ),
        ]);

        if (
          doctorResult?.response.ok
        ) {
          const data =
            doctorResult.data as ApiEnvelope<Doctor>;

          setDoctors(
            Array.isArray(data.doctors)
              ? data.doctors
              : [],
          );
        }

        if (
          receptionistResult?.response
            .ok
        ) {
          const data =
            receptionistResult.data as ApiEnvelope<Receptionist>;

          setReceptionists(
            Array.isArray(
              data.receptionists,
            )
              ? data.receptionists
              : [],
          );
        }

        if (
          patientResult?.response.ok
        ) {
          const data =
            patientResult.data as ApiEnvelope<Patient>;

          setPatients(
            Array.isArray(
              data.patients,
            )
              ? data.patients
              : [],
          );
        }

        if (
          adminResult?.response.ok
        ) {
          const data =
            adminResult.data as ApiEnvelope<AdminProfile>;

          setAdmins(
            Array.isArray(data.admins)
              ? data.admins
              : [],
          );
        }

        if (
          appointmentResult?.response
            .ok
        ) {
          const data =
            appointmentResult.data as {
              count?: number;
              appointments?: StaffAppointment[];
            };

          setAppointments(
            Array.isArray(
              data.appointments,
            )
              ? data.appointments
              : [],
          );
        }
      } catch (error) {
        console.error(
          "Admin directory load error:",
          error,
        );

        showMessage(
          "Unable to refresh the administration directory.",
          "error",
        );
      } finally {
        setLoadingDirectory(false);
      }
    }, [request, showMessage]);

  useEffect(() => {
    void loadAdminProfile();
    void loadDirectories();
  }, [
    loadAdminProfile,
    loadDirectories,
  ]);

  /*
   * Keep appointment lifecycle synchronized
   * with backend automatic NO_SHOW processing.
   */
  useEffect(() => {
    const intervalId =
      window.setInterval(() => {
        void loadDirectories();
      }, 30_000);

    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, [loadDirectories]);

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
  };

  const canCreateRole = useCallback(
    (role: Role) => {
      if (currentRole === "ADMIN") {
        return true;
      }

      if (
        currentRole ===
        "RECEPTIONIST"
      ) {
        return (
          role === "DOCTOR" ||
          role ===
            "RECEPTIONIST" ||
          role === "PATIENT"
        );
      }

      return false;
    },
    [currentRole],
  );

  const canViewDirectory =
    useCallback(
      (
        directory:
          | "doctors"
          | "receptionists"
          | "patients"
          | "admins"
          | "appointments",
      ) => {
        if (
          directory === "admins"
        ) {
          return (
            currentRole === "ADMIN"
          );
        }

        return (
          currentRole === "ADMIN" ||
          currentRole ===
            "RECEPTIONIST"
        );
      },
      [currentRole],
    );

  const openDashboard = () => {
    setView("dashboard");
    setSearch("");
    setMessage("");
    closeMenus();
  };

  const openCreate = (
    role: Role,
  ) => {
    if (!canCreateRole(role)) {
      showMessage(
        "You do not have permission to create this role.",
        "error",
      );
      return;
    }

    setCreateRole(role);
    setCreateStep(1);
    setView("create");
    setSearch("");
    setMessage("");
    closeMenus();
  };

  const openDirectory = (
    nextView:
      | "doctors"
      | "receptionists"
      | "patients"
      | "admins"
      | "appointments",
  ) => {
    if (
      !canViewDirectory(nextView)
    ) {
      showMessage(
        nextView === "admins"
          ? "Only administrators can access the administrator directory."
          : "You do not have permission to access this directory.",
        "error",
      );
      return;
    }

    setView(nextView);
    setSearch("");
    setMessage("");
    closeMenus();
  };

  const openCalendar = () => {
    if (
      currentRole !== "ADMIN" &&
      currentRole !== "RECEPTIONIST"
    ) {
      showMessage(
        "You do not have permission to access the appointment calendar.",
        "error",
      );
      return;
    }

    setView("calendar");
    setSearch("");
    setMessage("");
    closeMenus();
  };

  const resetRoleForm = (
    role: Role,
  ) => {
    if (role === "DOCTOR") {
      setDoctorForm({
        ...initialDoctor,
      });
    }

    if (
      role === "RECEPTIONIST"
    ) {
      setReceptionistForm({
        ...initialReceptionist,
      });
    }

    if (role === "PATIENT") {
      setPatientForm({
        ...initialPatient,
      });
    }

    if (role === "ADMIN") {
      setAdminForm({
        ...initialAdmin,
      });
    }
  };

  const selectCreateRole = (
    role: Role,
  ) => {
    setCreateRole(role);
    setCreateStep(1);
    setMessage("");
  };

  const createUser = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !canCreateRole(createRole)
    ) {
      showMessage(
        "You do not have permission to create this role.",
        "error",
      );
      return;
    }

    if (createStep !== 3) {
      setCreateStep((step) =>
        step === 1 ? 2 : 3,
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      let path = "";
      let body: Record<
        string,
        unknown
      >;

      if (createRole === "DOCTOR") {
        path = "/users/doctors";

        body = {
          ...doctorForm,

          npi_number:
            doctorForm.npi_number ||
            null,

          sub_specialization:
            doctorForm.sub_specialization ||
            null,

          medical_school:
            doctorForm.medical_school ||
            null,

          board_certification:
            doctorForm.board_certification ||
            null,

          years_of_experience:
            doctorForm.years_of_experience
              ? Number(
                  doctorForm.years_of_experience,
                )
              : null,

          department:
            doctorForm.department ||
            null,

          clinic_name:
            doctorForm.clinic_name ||
            null,

          clinic_address:
            doctorForm.clinic_address ||
            null,

          city:
            doctorForm.city || null,

          state:
            doctorForm.state || null,

          zip_code:
            doctorForm.zip_code ||
            null,

          consultation_fee:
            doctorForm.consultation_fee
              ? Number(
                  doctorForm.consultation_fee,
                )
              : null,

          bio:
            doctorForm.bio || null,

          languages:
            doctorForm.languages ||
            null,
        };
      } else if (
        createRole ===
        "RECEPTIONIST"
      ) {
        path =
          "/users/receptionists";

        body = {
          ...receptionistForm,

          department:
            receptionistForm.department ||
            null,

          phone:
            receptionistForm.phone ||
            null,

          hire_date:
            receptionistForm.hire_date ||
            null,

          shift:
            receptionistForm.shift ||
            null,

          clinic_location:
            receptionistForm.clinic_location ||
            null,
        };
      } else if (
        createRole === "PATIENT"
      ) {
        path = "/users/patients";

        body = {
          ...patientForm,

          city:
            patientForm.city || null,

          state:
            patientForm.state || null,

          insurance_provider:
            patientForm.insurance_provider ||
            null,

          insurance_member_id:
            patientForm.insurance_member_id ||
            null,

          pcp_doctor_id:
            patientForm.pcp_doctor_id
              ? Number(
                  patientForm.pcp_doctor_id,
                )
              : null,
        };
      } else {
        path = "/users/admin";

        body = {
          ...adminForm,
        };
      }

      const result = await request(
        path,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      if (!result) return;

      if (
        !result.response.ok
      ) {
        showMessage(
          getDetail(
            result.data,
            `Unable to create ${createRole.toLowerCase()}.`,
          ),
          "error",
        );

        return;
      }

      const roleLabel =
        ROLE_CARDS.find(
          (role) =>
            role.role ===
            createRole,
        )?.title || "User";

      showMessage(
        `${roleLabel} created successfully.`,
        "success",
      );

      resetRoleForm(createRole);
      setCreateStep(1);

      await loadDirectories();
    } catch (error) {
      console.error(
        "Create user error:",
        error,
      );

      showMessage(
        "Unable to connect to the server.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus =
    useCallback(
      async (
        appointmentId: number,
        nextStatus: string,
      ) => {
        setUpdatingAppointmentId(
          appointmentId,
        );

        try {
          const result =
            await request(
              `/appointments/${appointmentId}/status`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  status: nextStatus,
                }),
              },
            );

          if (!result) return;

          if (
            !result.response.ok
          ) {
            showMessage(
              getDetail(
                result.data,
                "Unable to update appointment status.",
              ),
              "error",
            );

            return;
          }

          showMessage(
            nextStatus ===
              "CHECKED_IN"
              ? "Patient marked as arrived."
              : nextStatus ===
                  "IN_PROGRESS"
                ? "Visit started."
                : nextStatus ===
                    "COMPLETED"
                  ? "Appointment completed."
                  : nextStatus ===
                      "CANCELLED"
                    ? "Appointment cancelled."
                    : "Appointment status updated.",
            "success",
          );

          await loadDirectories();
        } catch (error) {
          console.error(
            "Appointment status update error:",
            error,
          );

          showMessage(
            "Unable to connect to the server.",
            "error",
          );
        } finally {
          setUpdatingAppointmentId(
            null,
          );
        }
      },
      [
        request,
        showMessage,
        loadDirectories,
      ],
    );

  const updateDoctor = <
    K extends keyof typeof doctorForm,
  >(
    key: K,
    value: (typeof doctorForm)[K],
  ) => {
    setDoctorForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  };

  const updateReceptionist =
    <
      K extends keyof typeof receptionistForm,
    >(
      key: K,
      value: (typeof receptionistForm)[K],
    ) => {
      setReceptionistForm(
        (current) => ({
          ...current,
          [key]: value,
        }),
      );
    };

  const updatePatient = <
    K extends keyof typeof patientForm,
  >(
    key: K,
    value: (typeof patientForm)[K],
  ) => {
    setPatientForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  };

  const updateAdmin = <
    K extends keyof typeof adminForm,
  >(
    key: K,
    value: (typeof adminForm)[K],
  ) => {
    setAdminForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  };

  const filteredDoctors =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) return doctors;

      return doctors.filter(
        (doctor) =>
          [
            doctor.name,
            doctor.email,
            doctor.specialization,
            doctor.department,
            doctor.license_number,
            doctor.city,
            doctor.state,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
      );
    }, [doctors, search]);

  const filteredReceptionists =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query)
        return receptionists;

      return receptionists.filter(
        (staff) =>
          [
            staff.name,
            staff.email,
            staff.employee_id,
            staff.department,
            staff.phone,
            staff.shift,
            staff.clinic_location,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
      );
    }, [
      receptionists,
      search,
    ]);

  const filteredPatients =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) return patients;

      return patients.filter(
        (patient) =>
          [
            patient.name,
            patient.email,
            patient.phone,
            patient.city,
            patient.state,
            patient.insurance_provider,
            patient.insurance_member_id,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
      );
    }, [patients, search]);

  const filteredAdmins =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) return admins;

      return admins.filter(
        (user) =>
          [
            user.name,
            user.email,
            user.role,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
      );
    }, [admins, search]);

  /*
   * Backend is the source of truth for the lifecycle label.
   * The fallback exists only for older API responses that may
   * not yet include status_label.
   */
  const appointmentStatusLabel = (
    appointment: StaffAppointment,
  ): string => {
    if (
      appointment.status_label &&
      appointment.status_label.trim()
    ) {
      return appointment.status_label;
    }

    switch (
      appointment.status.toUpperCase()
    ) {
      case "SCHEDULED":
      case "CONFIRMED":
        return "Waiting";

      case "CHECKED_IN":
        return "Attended";

      case "IN_PROGRESS":
        return "With Doctor";

      case "COMPLETED":
        return "Completed";

      case "NO_SHOW":
        return "Not Attended";

      case "CANCELLED":
        return "Cancelled";

      default:
        return appointment.status;
    }
  };

  const filteredAppointments =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return appointments.filter(
        (appointment) => {
          const rawStatus =
            appointment.status.toUpperCase();

          const statusLabel =
            appointmentStatusLabel(
              appointment,
            );

          const matchesFilter =
            appointmentFilter ===
              "ALL" ||
            (appointmentFilter ===
              "WAITING" &&
              [
                "SCHEDULED",
                "CONFIRMED",
              ].includes(
                rawStatus,
              )) ||
            (appointmentFilter ===
              "ATTENDED" &&
              rawStatus ===
                "CHECKED_IN") ||
            (appointmentFilter ===
              "IN_PROGRESS" &&
              rawStatus ===
                "IN_PROGRESS") ||
            (appointmentFilter ===
              "COMPLETED" &&
              rawStatus ===
                "COMPLETED") ||
            (appointmentFilter ===
              "NOT_ATTENDED" &&
              rawStatus ===
                "NO_SHOW") ||
            (appointmentFilter ===
              "CANCELLED" &&
              rawStatus ===
                "CANCELLED");

          const matchesSearch =
            !query ||
            [
              appointment.patient_name,
              appointment.patient_email,
              appointment.doctor_name,
              appointment.appointment_date,
              appointment.appointment_type,
              appointment.reason,
              statusLabel,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(query);

          return (
            matchesFilter &&
            matchesSearch
          );
        },
      );
    }, [
      appointments,
      appointmentFilter,
      search,
    ]);

  const appointmentCounts =
    useMemo(() => {
      const counts = {
        all: appointments.length,
        waiting: 0,
        attended: 0,
        inProgress: 0,
        completed: 0,
        notAttended: 0,
        cancelled: 0,
      };

      appointments.forEach(
        (appointment) => {
          const status =
            appointment.status.toUpperCase();

          if (
            status === "SCHEDULED" ||
            status === "CONFIRMED"
          ) {
            counts.waiting += 1;
          } else if (
            status === "CHECKED_IN"
          ) {
            counts.attended += 1;
          } else if (
            status === "IN_PROGRESS"
          ) {
            counts.inProgress += 1;
          } else if (
            status === "COMPLETED"
          ) {
            counts.completed += 1;
          } else if (
            status === "NO_SHOW"
          ) {
            counts.notAttended += 1;
          } else if (
            status === "CANCELLED"
          ) {
            counts.cancelled += 1;
          }
        },
      );

      return counts;
    }, [appointments]);

  const currentDirectoryCount =
    view === "doctors"
      ? filteredDoctors.length
      : view ===
          "receptionists"
        ? filteredReceptionists.length
        : view === "patients"
          ? filteredPatients.length
          : view === "admins"
            ? filteredAdmins.length
            : filteredAppointments.length;

  const pageTitle =
    view === "create"
      ? `Create ${
          ROLE_CARDS.find(
            (role) =>
              role.role ===
              createRole,
          )?.title || "User"
        }`
      : view === "doctors"
        ? "Doctors"
        : view === "receptionists"
          ? "Receptionists"
          : view === "patients"
            ? "Patients"
            : view === "admins"
              ? "Administrators"
              : view ===
                  "appointments"
                ? "Appointment Operations"
                : view === "calendar"
                  ? "Appointment Calendar"
                  : "Administration Overview";

  const pageDescription =
    view === "create"
      ? "Create a role-specific account through the controlled administration workflow."
      : view === "doctors"
        ? "Review registered clinical providers and their professional details."
        : view === "receptionists"
          ? "Review front-desk staff and operational assignments."
          : view === "patients"
            ? "Review registered patients and available demographic and insurance information."
            : view === "admins"
              ? "Review administrator accounts and privileged access."
              : view ===
                  "appointments"
                ? "Manage patient arrival and appointment lifecycle from one live operational view."
                : view === "calendar"
                  ? "View existing patient appointments and book appointments for walk-in patients without affecting the existing administration workflows."
                  : "Manage users, clinical staff, patients and appointment operations from one secure workspace.";

  const roleCount = (
    role: Role,
  ) => {
    if (role === "DOCTOR")
      return doctors.length;

    if (
      role === "RECEPTIONIST"
    )
      return receptionists.length;

    if (role === "PATIENT")
      return patients.length;

    if (role === "ADMIN")
      return admins.length;

    return "—";
  };

  const renderRoleSpecificForm =
    () => {
      if (createRole === "DOCTOR") {
        return (
          <>
            <div className="form-section-heading">
              <span>
                Clinical profile
              </span>

              <h3>
                Professional information
              </h3>

              <p>
                Credentials and clinical information used by scheduling and provider discovery.
              </p>
            </div>

            <div className="field-grid">
              <Field
                label="Full name"
                required
                value={
                  doctorForm.name
                }
                onChange={(value) =>
                  updateDoctor(
                    "name",
                    value,
                  )
                }
              />

              <Field
                label="Email"
                type="email"
                required
                value={
                  doctorForm.email
                }
                onChange={(value) =>
                  updateDoctor(
                    "email",
                    value,
                  )
                }
              />

              <Field
                label="Password"
                type="password"
                required
                minLength={8}
                value={
                  doctorForm.password
                }
                onChange={(value) =>
                  updateDoctor(
                    "password",
                    value,
                  )
                }
              />

              <Field
                label="License number"
                required
                value={
                  doctorForm.license_number
                }
                onChange={(value) =>
                  updateDoctor(
                    "license_number",
                    value,
                  )
                }
              />

              <Field
                label="NPI number"
                value={
                  doctorForm.npi_number
                }
                maxLength={10}
                valueInputMode="numeric"
                onChange={(value) =>
                  updateDoctor(
                    "npi_number",
                    value,
                  )
                }
              />

              <Field
                label="Specialization"
                required
                placeholder="Cardiology"
                value={
                  doctorForm.specialization
                }
                onChange={(value) =>
                  updateDoctor(
                    "specialization",
                    value,
                  )
                }
              />

              <Field
                label="Sub-specialization"
                placeholder="Interventional Cardiology"
                value={
                  doctorForm.sub_specialization
                }
                onChange={(value) =>
                  updateDoctor(
                    "sub_specialization",
                    value,
                  )
                }
              />

              <Field
                label="Qualification"
                required
                placeholder="MD / DO"
                value={
                  doctorForm.qualification
                }
                onChange={(value) =>
                  updateDoctor(
                    "qualification",
                    value,
                  )
                }
              />

              <Field
                label="Medical school"
                value={
                  doctorForm.medical_school
                }
                onChange={(value) =>
                  updateDoctor(
                    "medical_school",
                    value,
                  )
                }
              />

              <Field
                label="Board certification"
                value={
                  doctorForm.board_certification
                }
                onChange={(value) =>
                  updateDoctor(
                    "board_certification",
                    value,
                  )
                }
              />

              <Field
                label="Years of experience"
                type="number"
                min={0}
                max={70}
                value={
                  doctorForm.years_of_experience
                }
                onChange={(value) =>
                  updateDoctor(
                    "years_of_experience",
                    value,
                  )
                }
              />

              <Field
                label="Department"
                value={
                  doctorForm.department
                }
                onChange={(value) =>
                  updateDoctor(
                    "department",
                    value,
                  )
                }
              />
            </div>

            <div className="form-section-heading section-divider">
              <span>Practice</span>

              <h3>
                Clinic and consultation
              </h3>

              <p>
                Practice details used by patients when selecting a provider.
              </p>
            </div>

            <div className="field-grid">
              <Field
                label="Clinic name"
                value={
                  doctorForm.clinic_name
                }
                onChange={(value) =>
                  updateDoctor(
                    "clinic_name",
                    value,
                  )
                }
              />

              <Field
                label="Clinic address"
                value={
                  doctorForm.clinic_address
                }
                onChange={(value) =>
                  updateDoctor(
                    "clinic_address",
                    value,
                  )
                }
              />

              <Field
                label="City"
                value={
                  doctorForm.city
                }
                onChange={(value) =>
                  updateDoctor(
                    "city",
                    value,
                  )
                }
              />

              <Field
                label="State"
                value={
                  doctorForm.state
                }
                onChange={(value) =>
                  updateDoctor(
                    "state",
                    value,
                  )
                }
              />

              <Field
                label="ZIP code"
                value={
                  doctorForm.zip_code
                }
                onChange={(value) =>
                  updateDoctor(
                    "zip_code",
                    value,
                  )
                }
              />

              <Field
                label="Consultation fee"
                type="number"
                min={0}
                step="0.01"
                value={
                  doctorForm.consultation_fee
                }
                onChange={(value) =>
                  updateDoctor(
                    "consultation_fee",
                    value,
                  )
                }
              />

              <SelectField
                label="Consultation mode"
                value={
                  doctorForm.consultation_mode
                }
                onChange={(value) =>
                  updateDoctor(
                    "consultation_mode",
                    value,
                  )
                }
                options={[
                  [
                    "IN_PERSON",
                    "In person",
                  ],
                  [
                    "TELEHEALTH",
                    "Telehealth",
                  ],
                  [
                    "BOTH",
                    "In person + Telehealth",
                  ],
                ]}
              />

              <Field
                label="Languages"
                placeholder="English, Spanish"
                value={
                  doctorForm.languages
                }
                onChange={(value) =>
                  updateDoctor(
                    "languages",
                    value,
                  )
                }
              />

              <TextAreaField
                label="Professional bio"
                full
                value={
                  doctorForm.bio
                }
                onChange={(value) =>
                  updateDoctor(
                    "bio",
                    value,
                  )
                }
              />
            </div>

            <label className="toggle-field">
              <input
                type="checkbox"
                checked={
                  doctorForm.accepting_new_patients
                }
                onChange={(event) =>
                  updateDoctor(
                    "accepting_new_patients",
                    event.target.checked,
                  )
                }
              />

              <span>
                <strong>
                  Accepting new patients
                </strong>

                <small>
                  Make this provider available for new-patient scheduling.
                </small>
              </span>
            </label>
          </>
        );
      }

      if (
        createRole ===
        "RECEPTIONIST"
      ) {
        return (
          <>
            <div className="form-section-heading">
              <span>
                Front desk
              </span>

              <h3>
                Employee information
              </h3>

              <p>
                Create an operational account for scheduling and patient support.
              </p>
            </div>

            <div className="field-grid">
              <Field
                label="Full name"
                required
                value={
                  receptionistForm.name
                }
                onChange={(value) =>
                  updateReceptionist(
                    "name",
                    value,
                  )
                }
              />

              <Field
                label="Email"
                type="email"
                required
                value={
                  receptionistForm.email
                }
                onChange={(value) =>
                  updateReceptionist(
                    "email",
                    value,
                  )
                }
              />

              <Field
                label="Password"
                type="password"
                required
                minLength={8}
                value={
                  receptionistForm.password
                }
                onChange={(value) =>
                  updateReceptionist(
                    "password",
                    value,
                  )
                }
              />

              <Field
                label="Employee ID"
                required
                placeholder="EMP-1001"
                value={
                  receptionistForm.employee_id
                }
                onChange={(value) =>
                  updateReceptionist(
                    "employee_id",
                    value,
                  )
                }
              />

              <Field
                label="Department"
                value={
                  receptionistForm.department
                }
                onChange={(value) =>
                  updateReceptionist(
                    "department",
                    value,
                  )
                }
              />

              <Field
                label="Phone"
                type="tel"
                value={
                  receptionistForm.phone
                }
                onChange={(value) =>
                  updateReceptionist(
                    "phone",
                    value,
                  )
                }
              />

              <Field
                label="Hire date"
                type="date"
                value={
                  receptionistForm.hire_date
                }
                onChange={(value) =>
                  updateReceptionist(
                    "hire_date",
                    value,
                  )
                }
              />

              <SelectField
                label="Shift"
                value={
                  receptionistForm.shift
                }
                onChange={(value) =>
                  updateReceptionist(
                    "shift",
                    value,
                  )
                }
                options={[
                  [
                    "",
                    "Select shift",
                  ],
                  [
                    "MORNING",
                    "Morning",
                  ],
                  [
                    "AFTERNOON",
                    "Afternoon",
                  ],
                  [
                    "EVENING",
                    "Evening",
                  ],
                  [
                    "NIGHT",
                    "Night",
                  ],
                ]}
              />

              <Field
                label="Clinic location"
                value={
                  receptionistForm.clinic_location
                }
                onChange={(value) =>
                  updateReceptionist(
                    "clinic_location",
                    value,
                  )
                }
              />
            </div>
          </>
        );
      }

      if (
        createRole === "PATIENT"
      ) {
        return (
          <>
            <div className="form-section-heading">
              <span>
                Patient profile
              </span>

              <h3>
                Account and demographics
              </h3>

              <p>
                Create the patient portal account and core registration information.
              </p>
            </div>

            <div className="field-grid">
              <Field
                label="Full name"
                required
                value={
                  patientForm.name
                }
                onChange={(value) =>
                  updatePatient(
                    "name",
                    value,
                  )
                }
              />

              <Field
                label="Email"
                type="email"
                required
                value={
                  patientForm.email
                }
                onChange={(value) =>
                  updatePatient(
                    "email",
                    value,
                  )
                }
              />

              <Field
                label="Password"
                type="password"
                required
                minLength={8}
                value={
                  patientForm.password
                }
                onChange={(value) =>
                  updatePatient(
                    "password",
                    value,
                  )
                }
              />

              <Field
                label="Date of birth"
                type="date"
                required
                value={
                  patientForm.date_of_birth
                }
                onChange={(value) =>
                  updatePatient(
                    "date_of_birth",
                    value,
                  )
                }
              />

              <SelectField
                label="Gender"
                required
                value={
                  patientForm.gender
                }
                onChange={(value) =>
                  updatePatient(
                    "gender",
                    value,
                  )
                }
                options={[
                  [
                    "",
                    "Select gender",
                  ],
                  [
                    "MALE",
                    "Male",
                  ],
                  [
                    "FEMALE",
                    "Female",
                  ],
                  [
                    "OTHER",
                    "Other",
                  ],
                  [
                    "PREFER_NOT_TO_SAY",
                    "Prefer not to say",
                  ],
                ]}
              />

              <Field
                label="Phone"
                type="tel"
                required
                value={
                  patientForm.phone
                }
                onChange={(value) =>
                  updatePatient(
                    "phone",
                    value,
                  )
                }
              />

              <Field
                label="City"
                value={
                  patientForm.city
                }
                onChange={(value) =>
                  updatePatient(
                    "city",
                    value,
                  )
                }
              />

              <Field
                label="State"
                value={
                  patientForm.state
                }
                onChange={(value) =>
                  updatePatient(
                    "state",
                    value,
                  )
                }
              />
            </div>

            <div className="form-section-heading section-divider">
              <span>Coverage</span>

              <h3>
                Insurance information
              </h3>

              <p>
                Store the coverage information that can be used during booking and RCM workflows.
              </p>
            </div>

            <div className="field-grid">
              <Field
                label="Insurance provider"
                placeholder="Payer / insurance company"
                value={
                  patientForm.insurance_provider
                }
                onChange={(value) =>
                  updatePatient(
                    "insurance_provider",
                    value,
                  )
                }
              />

              <Field
                label="Member ID"
                placeholder="Insurance member ID"
                value={
                  patientForm.insurance_member_id
                }
                onChange={(value) =>
                  updatePatient(
                    "insurance_member_id",
                    value,
                  )
                }
              />

              <SelectField
                label="Primary care provider"
                value={
                  patientForm.pcp_doctor_id
                }
                onChange={(value) =>
                  updatePatient(
                    "pcp_doctor_id",
                    value,
                  )
                }
                options={[
                  [
                    "",
                    "No PCP selected",
                  ],
                  ...doctors.map<
                    [string, string]
                  >((doctor) => [
                    String(doctor.id),
                    doctor.name,
                  ]),
                ]}
              />
            </div>
          </>
        );
      }

      return (
        <>
          <div className="form-section-heading">
            <span>
              Administration
            </span>

            <h3>
              Administrator account
            </h3>

            <p>
              Grant another user the existing ADMIN role. Use this carefully.
            </p>
          </div>

          <div className="admin-warning">
            <strong>
              Privileged access
            </strong>

            <span>
              An administrator can manage healthcare users and operational data available to the admin role.
            </span>
          </div>

          <div className="field-grid">
            <Field
              label="Full name"
              required
              value={
                adminForm.name
              }
              onChange={(value) =>
                updateAdmin(
                  "name",
                  value,
                )
              }
            />

            <Field
              label="Email"
              type="email"
              required
              value={
                adminForm.email
              }
              onChange={(value) =>
                updateAdmin(
                  "email",
                  value,
                )
              }
            />

            <Field
              label="Password"
              type="password"
              required
              minLength={8}
              value={
                adminForm.password
              }
              onChange={(value) =>
                updateAdmin(
                  "password",
                  value,
                )
              }
            />
          </div>
        </>
      );
    };

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand-area">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen(
                (value) => !value,
              )
            }
            aria-label="Open navigation"
          >
            ☰
          </button>

          <button
            type="button"
            className="admin-brand"
            onClick={
              openDashboard
            }
          >
            <span className="admin-brand-mark">
              +
            </span>

            <span>
              <strong>
                HealthCare+
              </strong>

              <small>
                {currentRole ===
                "RECEPTIONIST"
                  ? "Front Desk"
                  : "Administration"}
              </small>
            </span>
          </button>
        </div>

        <nav
          className={`admin-nav ${
            mobileMenuOpen
              ? "mobile-open"
              : ""
          }`}
        >
          <button
            type="button"
            className={
              view === "dashboard"
                ? "admin-nav-link active"
                : "admin-nav-link"
            }
            onClick={
              openDashboard
            }
          >
            Overview
          </button>

          <button
            type="button"
            className={
              view === "doctors"
                ? "admin-nav-link active"
                : "admin-nav-link"
            }
            onClick={() =>
              openDirectory(
                "doctors",
              )
            }
          >
            Doctors
          </button>

          <button
            type="button"
            className={
              view === "receptionists"
                ? "admin-nav-link active"
                : "admin-nav-link"
            }
            onClick={() =>
              openDirectory(
                "receptionists",
              )
            }
          >
            Receptionists
          </button>

          <button
            type="button"
            className={
              view === "patients"
                ? "admin-nav-link active"
                : "admin-nav-link"
            }
            onClick={() =>
              openDirectory(
                "patients",
              )
            }
          >
            Patients
          </button>

          <button
            type="button"
            className={
              view === "appointments"
                ? "admin-nav-link active"
                : "admin-nav-link"
            }
            onClick={() =>
              openDirectory(
                "appointments",
              )
            }
          >
            Appointments
          </button>

          {(currentRole === "ADMIN" ||
            currentRole === "RECEPTIONIST") && (
            <button
              type="button"
              className={
                view === "calendar"
                  ? "admin-nav-link active"
                  : "admin-nav-link"
              }
              onClick={openCalendar}
            >
              Calendar
            </button>
          )}

          {currentRole ===
            "ADMIN" && (
            <button
              type="button"
              className={
                view === "admins"
                  ? "admin-nav-link active"
                  : "admin-nav-link"
              }
              onClick={() =>
                openDirectory(
                  "admins",
                )
              }
            >
              Admins
            </button>
          )}

          <button
            type="button"
            className="admin-nav-create"
            onClick={() =>
              openCreate("DOCTOR")
            }
          >
            <span>+</span>
            Create user
          </button>
        </nav>

        <div className="admin-top-actions">
          <button
            type="button"
            className="refresh-button"
            onClick={() =>
              void loadDirectories()
            }
            disabled={
              loadingDirectory
            }
            aria-label="Refresh directory"
          >
            ↻
          </button>

          <div className="admin-profile-menu">
            <button
              type="button"
              className="admin-profile-trigger"
              onClick={() =>
                setProfileOpen(
                  (value) =>
                    !value,
                )
              }
              aria-expanded={
                profileOpen
              }
            >
              <span className="admin-avatar">
                {getInitials(
                  admin?.name ||
                    "Administrator",
                )}
              </span>

              <span className="admin-profile-text">
                <strong>
                  {admin?.name ||
                    (currentRole ===
                    "RECEPTIONIST"
                      ? "Receptionist"
                      : "Administrator")}
                </strong>

                <small>
                  {currentRole ===
                  "RECEPTIONIST"
                    ? "Receptionist"
                    : "Administrator"}
                </small>
              </span>

              <span className="profile-caret">
                ⌄
              </span>
            </button>

            {profileOpen && (
              <div className="admin-profile-dropdown">
                <div>
                  <span className="dropdown-label">
                    Signed in as
                  </span>

                  <strong>
                    {admin?.name ||
                      (currentRole ===
                      "RECEPTIONIST"
                        ? "Receptionist"
                        : "Administrator")}
                  </strong>

                  <small>
                    {admin?.email ||
                      (currentRole ===
                      "RECEPTIONIST"
                        ? "Receptionist account"
                        : "Administrator account")}
                  </small>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(
                      "access_token",
                    );

                    navigate(
                      "/login",
                      {
                        replace: true,
                      },
                    );
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-page-heading">
          <div>
            <div className="admin-breadcrumb">
              <span>
                Administration
              </span>

              <b>/</b>

              <span>
                {pageTitle}
              </span>
            </div>

            <h1>
              {pageTitle}
            </h1>

            <p>
              {pageDescription}
            </p>
          </div>

          {view !==
            "dashboard" && (
            <button
              type="button"
              className="heading-secondary-button"
              onClick={
                openDashboard
              }
            >
              ← Overview
            </button>
          )}
        </div>

        {message && (
          <div
            className={`admin-alert ${messageType}`}
            role="status"
          >
            <span>
              {messageType ===
              "success"
                ? "✓"
                : messageType ===
                    "error"
                  ? "!"
                  : "i"}
            </span>

            <p>
              {message}
            </p>

            <button
              type="button"
              onClick={() =>
                setMessage("")
              }
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {view ===
          "dashboard" && (
          <>
            <section className="admin-hero">
              <div>
                <span className="hero-kicker">
                  CONTROL CENTER
                </span>

                <h2>
                  Good{" "}
                  {new Date().getHours() <
                  12
                    ? "morning"
                    : new Date().getHours() <
                        17
                      ? "afternoon"
                      : new Date().getHours() <
                          21
                        ? "evening"
                        : "night"}
                  ,{" "}
                  {getFirstName(
                    admin?.name ||
                      (currentRole ===
                      "RECEPTIONIST"
                        ? "Receptionist"
                        : "Administrator"),
                  )}
                  .
                </h2>

                <p>
                  Manage the people and access layers that keep your appointment platform running.
                </p>
              </div>

              <div className="system-status">
                <span className="status-pulse" />

                <div>
                  <strong>
                    System connected
                  </strong>

                  <small>
                    Live directory data
                  </small>
                </div>
              </div>
            </section>

            <section className="overview-stats">
              <StatCard
                label="Doctors"
                value={
                  doctors.length
                }
                detail="Clinical providers"
                icon="D"
                tone="blue"
                onClick={() =>
                  openDirectory(
                    "doctors",
                  )
                }
              />

              <StatCard
                label="Receptionists"
                value={
                  receptionists.length
                }
                detail="Front-desk staff"
                icon="R"
                tone="green"
                onClick={() =>
                  openDirectory(
                    "receptionists",
                  )
                }
              />

              <StatCard
                label="Patients"
                value={
                  patients.length
                }
                detail="Registered patients"
                icon="P"
                tone="purple"
                onClick={() =>
                  openDirectory(
                    "patients",
                  )
                }
              />

              <StatCard
                label="User roles"
                value={
                  currentRole ===
                  "RECEPTIONIST"
                    ? "3"
                    : "4"
                }
                detail="Available access levels"
                icon="A"
                tone="orange"
              />

              <StatCard
                label="Appointments"
                value={
                  appointments.length
                }
                detail="Live appointment records"
                icon="C"
                tone="cyan"
                onClick={() =>
                  openDirectory(
                    "appointments",
                  )
                }
              />
            </section>

            <section className="admin-section-card">
              <div className="section-top">
                <div>
                  <span className="section-eyebrow">
                    ROLE MANAGEMENT
                  </span>

                  <h2>
                    Create a new account
                  </h2>

                  <p>
                    Select the role first. The next steps automatically show only the fields required for that role.
                  </p>
                </div>
              </div>

              <div className="role-grid">
                {ROLE_CARDS.filter(
                  (role) =>
                    canCreateRole(
                      role.role,
                    ),
                ).map(
                  (role) => (
                    <button
                      type="button"
                      className="role-card"
                      key={
                        role.role
                      }
                      onClick={() =>
                        openCreate(
                          role.role,
                        )
                      }
                    >
                      <span
                        className={`role-icon ${role.role.toLowerCase()}`}
                      >
                        {
                          role.icon
                        }
                      </span>

                      <span className="role-content">
                        <small>
                          {
                            role.level
                          }
                        </small>

                        <strong>
                          {
                            role.title
                          }
                        </strong>

                        <span>
                          {
                            role.description
                          }
                        </span>
                      </span>

                      <span className="role-count">
                        {roleCount(
                          role.role,
                        )}
                      </span>

                      <span className="role-arrow">
                        →
                      </span>
                    </button>
                  ),
                )}
              </div>
            </section>

            <section className="admin-section-card">
              <div className="section-top">
                <div>
                  <span className="section-eyebrow">
                    DIRECTORY
                  </span>

                  <h2>
                    People and access
                  </h2>

                  <p>
                    Open a live directory to review registered users.
                  </p>
                </div>

                <button
                  type="button"
                  className="section-action"
                  onClick={() =>
                    void loadDirectories()
                  }
                >
                  {loadingDirectory
                    ? "Refreshing..."
                    : "Refresh data"}
                </button>
              </div>

              <div className="directory-shortcuts">
                <DirectoryShortcut
                  title="Doctors"
                  count={
                    doctors.length
                  }
                  detail="Clinical providers"
                  tone="blue"
                  onClick={() =>
                    openDirectory(
                      "doctors",
                    )
                  }
                />

                <DirectoryShortcut
                  title="Receptionists"
                  count={
                    receptionists.length
                  }
                  detail="Front desk"
                  tone="green"
                  onClick={() =>
                    openDirectory(
                      "receptionists",
                    )
                  }
                />

                <DirectoryShortcut
                  title="Patients"
                  count={
                    patients.length
                  }
                  detail="Patient accounts"
                  tone="purple"
                  onClick={() =>
                    openDirectory(
                      "patients",
                    )
                  }
                />

                <DirectoryShortcut
                  title="Appointments"
                  count={
                    appointments.length
                  }
                  detail="Lifecycle operations"
                  tone="orange"
                  onClick={() =>
                    openDirectory(
                      "appointments",
                    )
                  }
                />
              </div>
            </section>
          </>
        )}

        {view === "calendar" && (
          <AdminCalendar
            onBookingSuccess={() => {
              void loadDirectories();
            }}
          />
        )}

        {view === "create" && (
          <section className="create-workspace">
            <aside className="create-sidebar">
              <div className="create-sidebar-header">
                <span>
                  ACCOUNT WORKFLOW
                </span>

                <strong>
                  Choose role
                </strong>
              </div>

              <div className="create-role-list">
                {ROLE_CARDS.filter(
                  (role) =>
                    canCreateRole(
                      role.role,
                    ),
                ).map(
                  (role) => (
                    <button
                      type="button"
                      key={
                        role.role
                      }
                      className={
                        createRole ===
                        role.role
                          ? "create-role-item active"
                          : "create-role-item"
                      }
                      onClick={() =>
                        selectCreateRole(
                          role.role,
                        )
                      }
                    >
                      <span
                        className={`role-mini-icon ${role.role.toLowerCase()}`}
                      >
                        {
                          role.icon
                        }
                      </span>

                      <span>
                        <strong>
                          {
                            role.title
                          }
                        </strong>

                        <small>
                          {
                            role.level
                          }
                        </small>
                      </span>
                    </button>
                  ),
                )}
              </div>

              <div className="workflow-note">
                <strong>
                  Controlled access
                </strong>

                <span>
                  Role-specific fields are submitted to the corresponding protected API endpoint.
                </span>
              </div>
            </aside>

            <div className="create-panel">
              <div className="create-panel-header">
                <div>
                  <span className="section-eyebrow">
                    {
                      ROLE_CARDS.find(
                        (role) =>
                          role.role ===
                          createRole,
                      )?.level
                    }
                  </span>

                  <h2>
                    Create{" "}
                    {
                      ROLE_CARDS.find(
                        (role) =>
                          role.role ===
                          createRole,
                      )?.title
                    }
                  </h2>

                  <p>
                    Complete the three-step registration flow.
                  </p>
                </div>

                <div className="step-indicator">
                  {[1, 2, 3].map(
                    (step) => (
                      <span
                        key={step}
                        className={
                          createStep >=
                          step
                            ? "step-dot active"
                            : "step-dot"
                        }
                      >
                        {step}
                      </span>
                    ),
                  )}
                </div>
              </div>

              <div className="workflow-progress">
                <span
                  style={{
                    width: `${
                      (createStep /
                        3) *
                      100
                    }%`,
                  }}
                />
              </div>

              <form
                onSubmit={
                  createUser
                }
                className="create-form"
              >
                {createStep ===
                  1 && (
                  <div className="workflow-step">
                    <div className="workflow-step-heading">
                      <span>
                        STEP 01
                      </span>

                      <h3>
                        Select access level
                      </h3>

                      <p>
                        Choose the account type before entering role-specific information.
                      </p>
                    </div>

                    <div className="role-select-grid">
                      {ROLE_CARDS.filter(
                        (role) =>
                          canCreateRole(
                            role.role,
                          ),
                      ).map(
                        (role) => (
                          <button
                            type="button"
                            key={
                              role.role
                            }
                            className={
                              createRole ===
                              role.role
                                ? "role-select-card selected"
                                : "role-select-card"
                            }
                            onClick={() =>
                              selectCreateRole(
                                role.role,
                              )
                            }
                          >
                            <span
                              className={`role-icon ${role.role.toLowerCase()}`}
                            >
                              {
                                role.icon
                              }
                            </span>

                            <strong>
                              {
                                role.title
                              }
                            </strong>

                            <small>
                              {
                                role.level
                              }
                            </small>

                            <span>
                              {
                                role.description
                              }
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {createStep ===
                  2 && (
                  <div className="workflow-step">
                    <div className="workflow-step-heading">
                      <span>
                        STEP 02
                      </span>

                      <h3>
                        Account setup
                      </h3>

                      <p>
                        Verify the identity and login credentials for this account.
                      </p>
                    </div>

                    <div className="account-summary">
                      <span
                        className={`role-icon ${createRole.toLowerCase()}`}
                      >
                        {
                          ROLE_CARDS.find(
                            (role) =>
                              role.role ===
                              createRole,
                          )?.icon
                        }
                      </span>

                      <div>
                        <strong>
                          {
                            ROLE_CARDS.find(
                              (role) =>
                                role.role ===
                                createRole,
                            )?.title
                          }
                        </strong>

                        <span>
                          {
                            ROLE_CARDS.find(
                              (role) =>
                                role.role ===
                                createRole,
                            )?.description
                          }
                        </span>
                      </div>
                    </div>

                    <div className="field-grid">
                      <Field
                        label="Full name"
                        required
                        value={
                          createRole ===
                          "DOCTOR"
                            ? doctorForm.name
                            : createRole ===
                                "RECEPTIONIST"
                              ? receptionistForm.name
                              : createRole ===
                                  "PATIENT"
                                ? patientForm.name
                                : adminForm.name
                        }
                        onChange={(
                          value,
                        ) => {
                          if (
                            createRole ===
                            "DOCTOR"
                          ) {
                            updateDoctor(
                              "name",
                              value,
                            );
                          } else if (
                            createRole ===
                            "RECEPTIONIST"
                          ) {
                            updateReceptionist(
                              "name",
                              value,
                            );
                          } else if (
                            createRole ===
                            "PATIENT"
                          ) {
                            updatePatient(
                              "name",
                              value,
                            );
                          } else {
                            updateAdmin(
                              "name",
                              value,
                            );
                          }
                        }}
                      />

                      <Field
                        label="Email"
                        type="email"
                        required
                        value={
                          createRole ===
                          "DOCTOR"
                            ? doctorForm.email
                            : createRole ===
                                "RECEPTIONIST"
                              ? receptionistForm.email
                              : createRole ===
                                  "PATIENT"
                                ? patientForm.email
                                : adminForm.email
                        }
                        onChange={(
                          value,
                        ) => {
                          if (
                            createRole ===
                            "DOCTOR"
                          ) {
                            updateDoctor(
                              "email",
                              value,
                            );
                          } else if (
                            createRole ===
                            "RECEPTIONIST"
                          ) {
                            updateReceptionist(
                              "email",
                              value,
                            );
                          } else if (
                            createRole ===
                            "PATIENT"
                          ) {
                            updatePatient(
                              "email",
                              value,
                            );
                          } else {
                            updateAdmin(
                              "email",
                              value,
                            );
                          }
                        }}
                      />

                      <Field
                        label="Password"
                        type="password"
                        required
                        minLength={8}
                        value={
                          createRole ===
                          "DOCTOR"
                            ? doctorForm.password
                            : createRole ===
                                "RECEPTIONIST"
                              ? receptionistForm.password
                              : createRole ===
                                  "PATIENT"
                                ? patientForm.password
                                : adminForm.password
                        }
                        onChange={(
                          value,
                        ) => {
                          if (
                            createRole ===
                            "DOCTOR"
                          ) {
                            updateDoctor(
                              "password",
                              value,
                            );
                          } else if (
                            createRole ===
                            "RECEPTIONIST"
                          ) {
                            updateReceptionist(
                              "password",
                              value,
                            );
                          } else if (
                            createRole ===
                            "PATIENT"
                          ) {
                            updatePatient(
                              "password",
                              value,
                            );
                          } else {
                            updateAdmin(
                              "password",
                              value,
                            );
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {createStep ===
                  3 && (
                  <div className="workflow-step">
                    <div className="workflow-step-heading">
                      <span>
                        STEP 03
                      </span>

                      <h3>
                        {createRole ===
                        "DOCTOR"
                          ? "Clinical profile"
                          : createRole ===
                              "RECEPTIONIST"
                            ? "Staff profile"
                            : createRole ===
                                "PATIENT"
                              ? "Patient profile"
                              : "Administrator profile"}
                      </h3>

                      <p>
                        Enter the information required for this role.
                      </p>
                    </div>

                    {renderRoleSpecificForm()}
                  </div>
                )}

                <div className="workflow-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (
                        createStep ===
                        1
                      ) {
                        openDashboard();
                      } else {
                        setCreateStep(
                          (step) =>
                            (step -
                              1) as
                              | 1
                              | 2
                              | 3,
                        );
                      }
                    }}
                  >
                    {createStep ===
                    1
                      ? "Cancel"
                      : "Back"}
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                  >
                    {loading
                      ? "Creating..."
                      : createStep <
                          3
                        ? "Continue"
                        : `Create ${
                            ROLE_CARDS.find(
                              (role) =>
                                role.role ===
                                createRole,
                            )?.title
                          }`}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {(view === "doctors" ||
          view ===
            "receptionists" ||
          view === "patients" ||
          view === "admins" ||
          view ===
            "appointments") && (
          <section className="directory-card">
            <div className="directory-toolbar">
              <div>
                <span className="section-eyebrow">
                  LIVE DIRECTORY
                </span>

                <h2>
                  {
                    currentDirectoryCount
                  }{" "}
                  matching records
                </h2>

                <p>
                  Search by name, email and role-specific information.
                </p>
              </div>

              <div className="directory-actions">
                <label className="directory-search">
                  <span>
                    ⌕
                  </span>

                  <input
                    type="search"
                    value={search}
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event.target
                          .value,
                      )
                    }
                    placeholder={
                      view ===
                      "patients"
                        ? "Search patients..."
                        : view ===
                            "doctors"
                          ? "Search doctors..."
                          : view ===
                              "receptionists"
                            ? "Search receptionists..."
                            : view ===
                                "appointments"
                              ? "Search patient or doctor..."
                              : "Search administrators..."
                    }
                    aria-label="Search directory"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch("")
                      }
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </label>

                <button
                  type="button"
                  className="section-action"
                  onClick={() =>
                    void loadDirectories()
                  }
                  disabled={
                    loadingDirectory
                  }
                >
                  {loadingDirectory
                    ? "Refreshing..."
                    : "Refresh"}
                </button>
              </div>
            </div>

            {view ===
              "doctors" && (
              <DoctorTable
                doctors={
                  filteredDoctors
                }
              />
            )}

            {view ===
              "receptionists" && (
              <ReceptionistTable
                receptionists={
                  filteredReceptionists
                }
              />
            )}

            {view ===
              "patients" && (
              <PatientTable
                patients={
                  filteredPatients
                }
              />
            )}

            {view ===
              "admins" && (
              <AdminTable
                admins={
                  filteredAdmins
                }
              />
            )}

            {view ===
              "appointments" && (
              <AppointmentOperations
                appointments={
                  filteredAppointments
                }
                counts={
                  appointmentCounts
                }
                filter={
                  appointmentFilter
                }
                onFilterChange={
                  setAppointmentFilter
                }
                updatingAppointmentId={
                  updatingAppointmentId
                }
                onStatusChange={
                  updateAppointmentStatus
                }
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  valueInputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  full?: boolean;
}

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  minLength,
  maxLength,
  min,
  max,
  step,
  valueInputMode,
  full = false,
}: FieldProps) => (
  <label
    className={
      full
        ? "modern-field full"
        : "modern-field"
    }
  >
    <span>
      {label}

      {required && (
        <b aria-hidden="true">
          *
        </b>
      )}
    </span>

    <input
      type={type}
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
      required={required}
      placeholder={
        placeholder ||
        `Enter ${label.toLowerCase()}`
      }
      minLength={minLength}
      maxLength={maxLength}
      min={min}
      max={max}
      step={step}
      inputMode={
        valueInputMode
      }
    />
  </label>
);

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  options: [
    string,
    string,
  ][];
  required?: boolean;
}

const SelectField = ({
  label,
  value,
  onChange,
  options,
  required = false,
}: SelectFieldProps) => (
  <label className="modern-field">
    <span>
      {label}

      {required && (
        <b aria-hidden="true">
          *
        </b>
      )}
    </span>

    <select
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
      required={required}
    >
      {options.map(
        ([
          optionValue,
          optionLabel,
        ]) => (
          <option
            value={
              optionValue
            }
            key={
              optionValue
            }
          >
            {
              optionLabel
            }
          </option>
        ),
      )}
    </select>
  </label>
);

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  full?: boolean;
}

const TextAreaField = ({
  label,
  value,
  onChange,
  full = false,
}: TextAreaProps) => (
  <label
    className={
      full
        ? "modern-field full"
        : "modern-field"
    }
  >
    <span>
      {label}
    </span>

    <textarea
      rows={5}
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
      placeholder={`Enter ${label.toLowerCase()}`}
    />
  </label>
);

interface StatCardProps {
  label: string;
  value: number | string;
  detail: string;
  icon: string;
  tone: string;
  onClick?: () => void;
}

const StatCard = ({
  label,
  value,
  detail,
  icon,
  tone,
  onClick,
}: StatCardProps) => (
  <button
    type="button"
    className={`overview-stat ${tone}`}
    onClick={onClick}
    disabled={!onClick}
  >
    <span className="stat-icon">
      {icon}
    </span>

    <span>
      <small>
        {label}
      </small>

      <strong>
        {value}
      </strong>

      <em>
        {detail}
      </em>
    </span>
  </button>
);

interface DirectoryShortcutProps {
  title: string;
  count: number;
  detail: string;
  tone: string;
  onClick: () => void;
}

const DirectoryShortcut = ({
  title,
  count,
  detail,
  tone,
  onClick,
}: DirectoryShortcutProps) => (
  <button
    type="button"
    className="directory-shortcut"
    onClick={onClick}
  >
    <span
      className={`shortcut-icon ${tone}`}
    >
      {title[0]}
    </span>

    <span>
      <strong>
        {title}
      </strong>

      <small>
        {detail}
      </small>
    </span>

    <b>
      {count}
    </b>

    <i>
      →
    </i>
  </button>
);

const DoctorTable = ({
  doctors,
}: {
  doctors: Doctor[];
}) => {
  if (!doctors.length) {
    return (
      <EmptyDirectory
        title="No doctors found"
        detail="There are no records matching the current search."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>
              Provider
            </th>

            <th>
              Specialization
            </th>

            <th>
              Credentials
            </th>

            <th>
              Location
            </th>

            <th>
              Experience
            </th>

            <th>
              Consultation
            </th>

            <th>
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {doctors.map(
            (doctor) => (
              <tr
                key={
                  doctor.id
                }
              >
                <td>
                  <div className="person-cell">
                    <span className="person-avatar blue">
                      {getInitials(
                        doctor.name,
                      )}
                    </span>

                    <span>
                      <strong>
                        {
                          doctor.name
                        }
                      </strong>

                      <small>
                        {doctor.email ||
                          "Email not available"}
                      </small>
                    </span>
                  </div>
                </td>

                <td>
                  <strong>
                    {doctor.specialization ||
                      "—"}
                  </strong>

                  <small className="table-muted">
                    {doctor.department ||
                      "Department not provided"}
                  </small>
                </td>

                <td>
                  <span>
                    {doctor.qualification ||
                      "—"}
                  </span>

                  <small className="table-muted">
                    License{" "}
                    {doctor.license_number ||
                      "—"}
                  </small>
                </td>

                <td>
                  {[
                    doctor.city,
                    doctor.state,
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ", ",
                    ) || "—"}
                </td>

                <td>
                  {doctor.years_of_experience ??
                    "—"}

                  {doctor.years_of_experience !==
                    null &&
                  doctor.years_of_experience !==
                    undefined
                    ? " yrs"
                    : ""}
                </td>

                <td>
                  <strong>
                    {doctor.consultation_fee !==
                      null &&
                    doctor.consultation_fee !==
                      undefined &&
                    doctor.consultation_fee !==
                      ""
                      ? `$${Number(
                          doctor.consultation_fee,
                        ).toFixed(
                          2,
                        )}`
                      : "—"}
                  </strong>

                  <small className="table-muted">
                    {doctor.consultation_mode ||
                      "Mode not provided"}
                  </small>
                </td>

                <td>
                  <span
                    className={
                      doctor.accepting_new_patients ===
                      false
                        ? "table-status danger"
                        : "table-status success"
                    }
                  >
                    <i />

                    {doctor.accepting_new_patients ===
                    false
                      ? "Not accepting"
                      : "Accepting"}
                  </span>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const ReceptionistTable = ({
  receptionists,
}: {
  receptionists: Receptionist[];
}) => {
  if (
    !receptionists.length
  ) {
    return (
      <EmptyDirectory
        title="No receptionists found"
        detail="There are no records matching the current search."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>
              Staff member
            </th>

            <th>
              Employee ID
            </th>

            <th>
              Department
            </th>

            <th>
              Phone
            </th>

            <th>
              Shift
            </th>

            <th>
              Clinic
            </th>

            <th>
              Hire date
            </th>
          </tr>
        </thead>

        <tbody>
          {receptionists.map(
            (staff) => (
              <tr
                key={
                  staff.id
                }
              >
                <td>
                  <div className="person-cell">
                    <span className="person-avatar green">
                      {getInitials(
                        staff.name,
                      )}
                    </span>

                    <span>
                      <strong>
                        {
                          staff.name
                        }
                      </strong>

                      <small>
                        {staff.email ||
                          "Email not available"}
                      </small>
                    </span>
                  </div>
                </td>

                <td>
                  {staff.employee_id ||
                    "—"}
                </td>

                <td>
                  {staff.department ||
                    "—"}
                </td>

                <td>
                  {staff.phone ||
                    "—"}
                </td>

                <td>
                  <span className="soft-badge">
                    {staff.shift ||
                      "Not assigned"}
                  </span>
                </td>

                <td>
                  {staff.clinic_location ||
                    "—"}
                </td>

                <td>
                  {formatDate(
                    staff.hire_date,
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const PatientTable = ({
  patients,
}: {
  patients: Patient[];
}) => {
  if (!patients.length) {
    return (
      <EmptyDirectory
        title="No patients found"
        detail="There are no records matching the current search."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>
              Patient
            </th>

            <th>
              Date of birth
            </th>

            <th>
              Contact
            </th>

            <th>
              Location
            </th>

            <th>
              Insurance
            </th>

            <th>
              Member ID
            </th>

            <th>
              PCP
            </th>
          </tr>
        </thead>

        <tbody>
          {patients.map(
            (patient) => (
              <tr
                key={
                  patient.id
                }
              >
                <td>
                  <div className="person-cell">
                    <span className="person-avatar purple">
                      {getInitials(
                        patient.name,
                      )}
                    </span>

                    <span>
                      <strong>
                        {
                          patient.name
                        }
                      </strong>

                      <small>
                        {
                          patient.email
                        }
                      </small>
                    </span>
                  </div>
                </td>

                <td>
                  {formatDate(
                    patient.date_of_birth,
                  )}

                  <small className="table-muted">
                    {patient.gender ||
                      "Gender not provided"}
                  </small>
                </td>

                <td>
                  {patient.phone ||
                    "—"}
                </td>

                <td>
                  {[
                    patient.city,
                    patient.state,
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ", ",
                    ) || "—"}
                </td>

                <td>
                  {patient.insurance_provider ||
                    "No insurance on file"}
                </td>

                <td>
                  {patient.insurance_member_id ||
                    "Not provided"}
                </td>

                <td>
                  {patient.pcp_doctor_id
                    ? `Doctor #${patient.pcp_doctor_id}`
                    : "No PCP"}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

interface AppointmentOperationsProps {
  appointments: StaffAppointment[];

  counts: {
    all: number;
    waiting: number;
    attended: number;
    inProgress: number;
    completed: number;
    notAttended: number;
    cancelled: number;
  };

  filter:
    | "ALL"
    | "WAITING"
    | "ATTENDED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "NOT_ATTENDED"
    | "CANCELLED";

  onFilterChange: (
    value:
      | "ALL"
      | "WAITING"
      | "ATTENDED"
      | "IN_PROGRESS"
      | "COMPLETED"
      | "NOT_ATTENDED"
      | "CANCELLED",
  ) => void;

  updatingAppointmentId:
    | number
    | null;

  onStatusChange: (
    appointmentId: number,
    status: string,
  ) => void;
}

const appointmentLabel = (
  appointment: StaffAppointment,
): string => {
  if (
    appointment.status_label &&
    appointment.status_label.trim()
  ) {
    return appointment.status_label;
  }

  switch (
    appointment.status.toUpperCase()
  ) {
    case "SCHEDULED":
    case "CONFIRMED":
      return "Waiting";

    case "CHECKED_IN":
      return "Attended";

    case "IN_PROGRESS":
      return "With Doctor";

    case "COMPLETED":
      return "Completed";

    case "NO_SHOW":
      return "Not Attended";

    case "CANCELLED":
      return "Cancelled";

    default:
      return appointment.status;
  }
};

const appointmentClass = (
  status: string,
): string => {
  switch (status.toUpperCase()) {
    case "SCHEDULED":
    case "CONFIRMED":
      return "waiting";

    /*
     * Keep the existing CSS class name "attempted"
     * so the current AdminDashboard.css remains compatible.
     * The user-facing label is correctly "Attended".
     */
    case "CHECKED_IN":
      return "attempted";

    case "IN_PROGRESS":
      return "in-progress";

    case "COMPLETED":
      return "completed";

    /*
     * Keep the existing CSS class name for styling
     * compatibility. User-facing terminology is "Not Attended".
     */
    case "NO_SHOW":
      return "not-attempted";

    case "CANCELLED":
      return "cancelled";

    default:
      return "unknown";
  }
};

const formatAppointmentTime = (
  value: string,
) => {
  if (!value) return "—";

  const [
    hourPart,
    minutePart,
  ] = value.split(":");

  const hour = Number(
    hourPart,
  );

  if (
    Number.isNaN(hour) ||
    !minutePart
  ) {
    return value;
  }

  const suffix =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${displayHour}:${minutePart.slice(
    0,
    2,
  )} ${suffix}`;
};

const AppointmentOperations = ({
  appointments,
  counts,
  filter,
  onFilterChange,
  updatingAppointmentId,
  onStatusChange,
}: AppointmentOperationsProps) => (
  <div className="appointment-operations">
    <div className="appointment-lifecycle-banner">
      <div>
        <span className="section-eyebrow">
          LIVE APPOINTMENT FLOW
        </span>

        <h3>
          Arrival → Visit → Completion
        </h3>

        <p>
          Waiting becomes Attended when front desk marks the patient as arrived. After the scheduled end time, an unarrived appointment becomes Not Attended automatically.
        </p>
      </div>

      <div className="lifecycle-flow">
        <span className="waiting">
          Waiting
        </span>

        <b>→</b>

        <span className="attempted">
          Attended
        </span>

        <b>→</b>

        <span className="in-progress">
          With Doctor
        </span>

        <b>→</b>

        <span className="completed">
          Completed
        </span>
      </div>
    </div>

    <div className="appointment-status-filters">
      {[
        [
          "ALL",
          "All",
          counts.all,
        ],
        [
          "WAITING",
          "Waiting",
          counts.waiting,
        ],
        [
          "ATTENDED",
          "Attended",
          counts.attended,
        ],
        [
          "IN_PROGRESS",
          "With Doctor",
          counts.inProgress,
        ],
        [
          "COMPLETED",
          "Completed",
          counts.completed,
        ],
        [
          "NOT_ATTENDED",
          "Not Attended",
          counts.notAttended,
        ],
        [
          "CANCELLED",
          "Cancelled",
          counts.cancelled,
        ],
      ].map(
        ([
          value,
          label,
          count,
        ]) => (
          <button
            type="button"
            key={String(
              value,
            )}
            className={
              filter === value
                ? "appointment-filter active"
                : "appointment-filter"
            }
            onClick={() =>
              onFilterChange(
                value as AppointmentOperationsProps["filter"],
              )
            }
          >
            <span>
              {label}
            </span>

            <b>
              {count}
            </b>
          </button>
        ),
      )}
    </div>

    {appointments.length ===
    0 ? (
      <EmptyDirectory
        title="No appointments found"
        detail="There are no appointment records matching the current filter or search."
      />
    ) : (
      <div className="staff-appointment-list">
        {appointments.map(
          (appointment) => {
            const status =
              appointment.status.toUpperCase();

            const busy =
              updatingAppointmentId ===
              appointment.id;

            return (
              <article
                className="staff-appointment-card"
                key={
                  appointment.id
                }
              >
                <div className="appointment-time-block">
                  <strong>
                    {formatAppointmentTime(
                      appointment.start_time,
                    )}
                  </strong>

                  <span>
                    {formatAppointmentTime(
                      appointment.end_time,
                    )}
                  </span>
                </div>

                <div className="appointment-patient-block">
                  <span className="person-avatar purple">
                    {getInitials(
                      appointment.patient_name,
                    )}
                  </span>

                  <div>
                    <strong>
                      {
                        appointment.patient_name
                      }
                    </strong>

                    <small>
                      {appointment.patient_email ||
                        "Patient email not available"}
                    </small>
                  </div>
                </div>

                <div className="appointment-provider-block">
                  <span>
                    Provider
                  </span>

                  <strong>
                    {
                      appointment.doctor_name
                    }
                  </strong>

                  <small>
                    {appointment.appointment_type ||
                      "Appointment"}
                  </small>
                </div>

                <div className="appointment-status-block">
                  <span
                    className={`appointment-lifecycle-status ${appointmentClass(
                      status,
                    )}`}
                  >
                    {appointmentLabel(
                      appointment,
                    )}
                  </span>

                  <small>
                    {formatDate(
                      appointment.appointment_date,
                    )}
                  </small>
                </div>

                <div className="appointment-action-block">
                  {(status ===
                    "SCHEDULED" ||
                    status ===
                      "CONFIRMED") && (
                    <>
                      <button
                        type="button"
                        className="appointment-action primary"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          onStatusChange(
                            appointment.id,
                            "CHECKED_IN",
                          )
                        }
                      >
                        {busy
                          ? "Updating..."
                          : "Mark Arrived"}
                      </button>

                      <button
                        type="button"
                        className="appointment-action danger"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          onStatusChange(
                            appointment.id,
                            "CANCELLED",
                          )
                        }
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {status ===
                    "CHECKED_IN" && (
                    <button
                      type="button"
                      className="appointment-action primary"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        onStatusChange(
                          appointment.id,
                          "IN_PROGRESS",
                        )
                      }
                    >
                      {busy
                        ? "Updating..."
                        : "Start Visit"}
                    </button>
                  )}

                  {status ===
                    "IN_PROGRESS" && (
                    <button
                      type="button"
                      className="appointment-action primary"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        onStatusChange(
                          appointment.id,
                          "COMPLETED",
                        )
                      }
                    >
                      {busy
                        ? "Updating..."
                        : "Complete"}
                    </button>
                  )}

                  {(status ===
                    "COMPLETED" ||
                    status ===
                      "NO_SHOW" ||
                    status ===
                      "CANCELLED") && (
                    <span className="appointment-action-final">
                      No action required
                    </span>
                  )}
                </div>
              </article>
            );
          },
        )}
      </div>
    )}
  </div>
);

const AdminTable = ({
  admins,
}: {
  admins: AdminProfile[];
}) => {
  if (!admins.length) {
    return (
      <EmptyDirectory
        title="No administrators found"
        detail="There are no administrator records matching the current search."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>
              Administrator
            </th>

            <th>
              Email
            </th>

            <th>
              Role
            </th>

            <th>
              Access
            </th>
          </tr>
        </thead>

        <tbody>
          {admins.map(
            (user) => (
              <tr
                key={
                  user.id
                }
              >
                <td>
                  <div className="person-cell">
                    <span className="person-avatar orange">
                      {getInitials(
                        user.name,
                      )}
                    </span>

                    <span>
                      <strong>
                        {
                          user.name
                        }
                      </strong>

                      <small>
                        {
                          user.email
                        }
                      </small>
                    </span>
                  </div>
                </td>

                <td>
                  {
                    user.email
                  }
                </td>

                <td>
                  {user.role ||
                    "ADMIN"}
                </td>

                <td>
                  <span className="table-status success">
                    <i />
                    Privileged
                  </span>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
};

const EmptyDirectory = ({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) => (
  <div className="empty-directory">
    <span>⌕</span>

    <h3>
      {title}
    </h3>

    <p>
      {detail}
    </p>
  </div>
);

export default AdminDashboard;