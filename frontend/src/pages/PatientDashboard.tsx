import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { useNavigate } from "react-router-dom";

import API_URL from "../config";

import AppointmentBooking from "../components/AppointmentBooking";

import DayView from "../components/DayView";

import type {
  DayViewAppointment,
} from "../components/DayView";

import "./PatientDashboard.css";

interface Appointment {
  id: number;
  doctor_id: number;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  appointment_type: string;
  reason?: string | null;
  notes?: string | null;
}

interface PatientUser {
  id: number;
  patient_id?: number;
  name: string;
  email: string;
  role: string;
  is_active?: boolean;

  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;

  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;

  insurance_provider?: string | null;
  insurance_member_id?: string | null;

  pcp_doctor_id?: number | null;
}

interface PatientProfileForm {
  name: string;
  email: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  insurance_provider: string;
  insurance_member_id: string;
}

type CalendarView =
  | "month"
  | "week"
  | "day";

type DashboardPanel =
  | "profile"
  | "records"
  | "settings"
  | "help"
  | "notifications"
  | null;

const ACTIVE_APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
];

function getTodayDate(): string {
  const today = new Date();

  const year =
    today.getFullYear();

  const month = String(
    today.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    today.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFirstName(
  name: string,
): string {
  const cleanedName =
    name.trim();

  if (!cleanedName) {
    return "Patient";
  }

  return cleanedName
    .split(/\s+/)[0];
}

function getInitials(
  name: string,
): string {
  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length === 0) {
    return "PT";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function getGreeting(
  date = new Date(),
): string {
  const hour =
    date.getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  if (hour >= 17 && hour < 21) {
    return "Good evening";
  }

  return "Good night";
}

function getGreetingIcon(
  date = new Date(),
): string {
  const hour =
    date.getHours();

  if (hour >= 5 && hour < 12) {
    return "☀";
  }

  if (hour >= 12 && hour < 17) {
    return "◐";
  }

  if (hour >= 17 && hour < 21) {
    return "◒";
  }

  return "☾";
}

function PatientDashboard() {
  const navigate = useNavigate();

  const todayDate =
    getTodayDate();

  // ==================================================
  // USER
  // ==================================================

  const [
    patient,
    setPatient,
  ] = useState<PatientUser | null>(
    null,
  );

  const [
    loadingPatient,
    setLoadingPatient,
  ] = useState(true);

  // ==================================================
  // PROFILE EDITING
  // ==================================================

  const [
    editingProfile,
    setEditingProfile,
  ] = useState(false);

  const [
    profileForm,
    setProfileForm,
  ] = useState<PatientProfileForm>({
    name: "",
    email: "",
    date_of_birth: "",
    gender: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    insurance_provider: "",
    insurance_member_id: "",
  });

  const [
    savingProfile,
    setSavingProfile,
  ] = useState(false);

  const [
    profileMessage,
    setProfileMessage,
  ] = useState("");

  const [
    profileError,
    setProfileError,
  ] = useState("");

  // ==================================================
  // LIVE TIME
  // ==================================================

  const [
    currentTime,
    setCurrentTime,
  ] = useState(
    () => new Date(),
  );

  // ==================================================
  // UI PANELS
  // ==================================================

  const [
    activePanel,
    setActivePanel,
  ] = useState<DashboardPanel>(
    null,
  );

  // ==================================================
  // SETTINGS
  // ==================================================

  const [
    autoRefresh,
    setAutoRefresh,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "patient_dashboard_auto_refresh",
      ) !== "false"
    );
  });

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  // ==================================================
  // MODALS
  // ==================================================

  const [
    showBooking,
    setShowBooking,
  ] = useState(false);

  const [
    showAllAppointments,
    setShowAllAppointments,
  ] = useState(false);

  const [
    showDayView,
    setShowDayView,
  ] = useState(false);

  const [
    selectedAppointment,
    setSelectedAppointment,
  ] = useState<Appointment | null>(
    null,
  );

  // ==================================================
  // APPOINTMENTS
  // ==================================================

  const [
    appointments,
    setAppointments,
  ] = useState<Appointment[]>([]);

  const [
    loadingAppointments,
    setLoadingAppointments,
  ] = useState(true);

  const [
    appointmentsError,
    setAppointmentsError,
  ] = useState("");

  // ==================================================
  // CALENDAR
  // ==================================================

  const [
    currentMonth,
    setCurrentMonth,
  ] = useState(() => {
    const today =
      new Date();

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
  });

  const [
    calendarView,
    setCalendarView,
  ] = useState<CalendarView>(
    "month",
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(todayDate);

  // ==================================================
  // BOOKING STATE
  // ==================================================

  const [
    bookingDate,
    setBookingDate,
  ] = useState("");

  const [
    bookingDoctorId,
    setBookingDoctorId,
  ] = useState<number | null>(
    null,
  );

  const [
    bookingStartTime,
    setBookingStartTime,
  ] = useState("");

  // ==================================================
  // LIVE CLOCK
  // ==================================================

  useEffect(() => {
    const timer =
      window.setInterval(() => {
        setCurrentTime(
          new Date(),
        );
      }, 60_000);

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, []);

  // ==================================================
  // LOGOUT
  // ==================================================

  const handleLogout = () => {
    localStorage.removeItem(
      "access_token",
    );

    localStorage.removeItem(
      "patient_user",
    );

    navigate("/login", {
      replace: true,
    });
  };

  // ==================================================
  // LOAD CURRENT PATIENT
  // ==================================================

  const fetchPatient =
    useCallback(
      async () => {
        try {
          setLoadingPatient(true);

          const token =
            localStorage.getItem(
              "access_token",
            );

          if (!token) {
            navigate("/login", {
              replace: true,
            });

            return;
          }

          const response =
            await fetch(
              `${API_URL}/users/me`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              },
            );

          if (
            response.status ===
            401
          ) {
            handleLogout();

            return;
          }

          if (!response.ok) {
            throw new Error(
              "Unable to load patient profile.",
            );
          }

          const data =
            (await response.json()) as PatientUser;

          setPatient(data);

          setProfileForm({
            name:
              data.name || "",
            email:
              data.email || "",
            date_of_birth:
              data.date_of_birth || "",
            gender:
              data.gender || "",
            phone:
              data.phone || "",
            address:
              data.address || "",
            city:
              data.city || "",
            state:
              data.state || "",
            zip_code:
              data.zip_code || "",
            insurance_provider:
              data.insurance_provider || "",
            insurance_member_id:
              data.insurance_member_id || "",
          });

          localStorage.setItem(
            "patient_user",
            JSON.stringify(data),
          );
        } catch (error) {
          console.error(
            "Error loading patient:",
            error,
          );

          const cached =
            localStorage.getItem(
              "patient_user",
            );

          if (cached) {
            try {
              const cachedPatient =
                JSON.parse(
                  cached,
                ) as PatientUser;

              setPatient(
                cachedPatient,
              );

              setProfileForm({
                name:
                  cachedPatient.name ||
                  "",
                email:
                  cachedPatient.email ||
                  "",
                date_of_birth:
                  cachedPatient.date_of_birth ||
                  "",
                gender:
                  cachedPatient.gender ||
                  "",
                phone:
                  cachedPatient.phone ||
                  "",
                address:
                  cachedPatient.address ||
                  "",
                city:
                  cachedPatient.city ||
                  "",
                state:
                  cachedPatient.state ||
                  "",
                zip_code:
                  cachedPatient.zip_code ||
                  "",
                insurance_provider:
                  cachedPatient.insurance_provider ||
                  "",
                insurance_member_id:
                  cachedPatient.insurance_member_id ||
                  "",
              });
            } catch {
              setPatient(null);
            }
          }
        } finally {
          setLoadingPatient(false);
        }
      },
      [navigate],
    );

  // ==================================================
  // LOAD APPOINTMENTS
  // ==================================================

  const fetchAppointments =
    useCallback(
      async (
        showLoader = true,
      ) => {
        try {
          if (showLoader) {
            setLoadingAppointments(
              true,
            );
          }

          setAppointmentsError("");

          const token =
            localStorage.getItem(
              "access_token",
            );

          if (!token) {
            navigate("/login", {
              replace: true,
            });

            return;
          }

          const response =
            await fetch(
              `${API_URL}/appointments/my`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              },
            );

          if (
            response.status ===
            401
          ) {
            handleLogout();

            return;
          }

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.detail ||
                "Unable to load appointments.",
            );
          }

          setAppointments(
            data.appointments || [],
          );
        } catch (error) {
          console.error(
            "Error loading appointments:",
            error,
          );

          setAppointmentsError(
            error instanceof Error
              ? error.message
              : "Unable to load appointments.",
          );
        } finally {
          if (showLoader) {
            setLoadingAppointments(
              false,
            );
          }
        }
      },
      [navigate],
    );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    void fetchPatient();

    void fetchAppointments();
  }, [
    fetchPatient,
    fetchAppointments,
  ]);

  // ==================================================
  // AUTO REFRESH
  // ==================================================

  useEffect(() => {
    localStorage.setItem(
      "patient_dashboard_auto_refresh",
      String(autoRefresh),
    );
  }, [autoRefresh]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval =
      window.setInterval(() => {
        void fetchAppointments(
          false,
        );
      }, 30_000);

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [
    autoRefresh,
    fetchAppointments,
  ]);

  // ==================================================
  // MANUAL REFRESH
  // ==================================================

  const handleRefresh =
    async () => {
      try {
        setRefreshing(true);

        await Promise.all([
          fetchPatient(),
          fetchAppointments(false),
        ]);
      } finally {
        setRefreshing(false);
      }
    };

  // ==================================================
  // PROFILE FORM
  // ==================================================

  const updateProfileField = (
    field: keyof PatientProfileForm,
    value: string,
  ) => {
    setProfileForm(
      (previous) => ({
        ...previous,
        [field]: value,
      }),
    );
  };

  const startProfileEdit = () => {
    if (!patient) {
      return;
    }

    setProfileForm({
      name:
        patient.name || "",
      email:
        patient.email || "",
      date_of_birth:
        patient.date_of_birth || "",
      gender:
        patient.gender || "",
      phone:
        patient.phone || "",
      address:
        patient.address || "",
      city:
        patient.city || "",
      state:
        patient.state || "",
      zip_code:
        patient.zip_code || "",
      insurance_provider:
        patient.insurance_provider || "",
      insurance_member_id:
        patient.insurance_member_id || "",
    });

    setProfileMessage("");
    setProfileError("");
    setEditingProfile(true);
  };

  const cancelProfileEdit = () => {
    setProfileMessage("");
    setProfileError("");
    setEditingProfile(false);
  };

  const saveProfile =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      setSavingProfile(true);
      setProfileMessage("");
      setProfileError("");

      try {
        const token =
          localStorage.getItem(
            "access_token",
          );

        if (!token) {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        const response =
          await fetch(
            `${API_URL}/users/me`,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
              body: JSON.stringify({
                name:
                  profileForm.name.trim(),
                phone:
                  profileForm.phone.trim() ||
                  null,
                date_of_birth:
                  profileForm.date_of_birth ||
                  null,
                gender:
                  profileForm.gender ||
                  null,
                address:
                  profileForm.address.trim() ||
                  null,
                city:
                  profileForm.city.trim() ||
                  null,
                state:
                  profileForm.state.trim() ||
                  null,
                zip_code:
                  profileForm.zip_code.trim() ||
                  null,
                insurance_provider:
                  profileForm.insurance_provider.trim() ||
                  null,
                insurance_member_id:
                  profileForm.insurance_member_id.trim() ||
                  null,
              }),
            },
          );

        if (
          response.status ===
          401
        ) {
          handleLogout();

          return;
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to update profile.",
          );
        }

        const updatedPatient =
          data as PatientUser;

        setPatient(
          updatedPatient,
        );

        setProfileForm({
          name:
            updatedPatient.name ||
            "",
          email:
            updatedPatient.email ||
            "",
          date_of_birth:
            updatedPatient.date_of_birth ||
            "",
          gender:
            updatedPatient.gender ||
            "",
          phone:
            updatedPatient.phone ||
            "",
          address:
            updatedPatient.address ||
            "",
          city:
            updatedPatient.city ||
            "",
          state:
            updatedPatient.state ||
            "",
          zip_code:
            updatedPatient.zip_code ||
            "",
          insurance_provider:
            updatedPatient.insurance_provider ||
            "",
          insurance_member_id:
            updatedPatient.insurance_member_id ||
            "",
        });

        localStorage.setItem(
          "patient_user",
          JSON.stringify(
            updatedPatient,
          ),
        );

        setProfileMessage(
          "Profile updated successfully.",
        );

        setEditingProfile(false);
      } catch (error) {
        console.error(
          "Error updating profile:",
          error,
        );

        setProfileError(
          error instanceof Error
            ? error.message
            : "Unable to update profile.",
        );
      } finally {
        setSavingProfile(false);
      }
    };

  // ==================================================
  // DATE HELPERS
  // ==================================================

  const getDateKey = (
    date: Date,
  ): string => {
    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1,
    ).padStart(2, "0");

    const day = String(
      date.getDate(),
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatTime = (
    time: string,
  ): string => {
    const [
      hours,
      minutes,
    ] = time
      .split(":")
      .map(Number);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return time;
    }

    const date =
      new Date();

    date.setHours(
      hours,
      minutes,
      0,
      0,
    );

    return date.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    );
  };

  const formatDate = (
    dateString: string,
  ): string => {
    const date =
      new Date(
        `${dateString}T00:00:00`,
      );

    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    );
  };

  const formatLongDate =
    (date = new Date()) =>
      date.toLocaleDateString(
        "en-US",
        {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        },
      );

  // ==================================================
  // USER DISPLAY DATA
  // ==================================================

  const patientName =
    patient?.name?.trim() ||
    "Patient";

  const firstName =
    getFirstName(
      patientName,
    );

  const initials =
    getInitials(
      patientName,
    );

  const greeting =
    getGreeting(
      currentTime,
    );

  const greetingIcon =
    getGreetingIcon(
      currentTime,
    );

  const profileName =
    patient?.name ||
    "Patient";

  const profileEmail =
    patient?.email ||
    "Email unavailable";

  // ==================================================
  // MONTH TITLE
  // ==================================================

  const monthTitle =
    currentMonth.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      },
    );

  // ==================================================
  // MONTH CALENDAR DAYS
  // ==================================================

  const calendarDays =
    useMemo(() => {
      const year =
        currentMonth.getFullYear();

      const month =
        currentMonth.getMonth();

      const firstDay =
        new Date(
          year,
          month,
          1,
        ).getDay();

      const daysInMonth =
        new Date(
          year,
          month + 1,
          0,
        ).getDate();

      const previousMonthDays =
        new Date(
          year,
          month,
          0,
        ).getDate();

      const days: {
        date: Date;
        currentMonth: boolean;
      }[] = [];

      for (
        let index =
          firstDay - 1;
        index >= 0;
        index--
      ) {
        days.push({
          date: new Date(
            year,
            month - 1,
            previousMonthDays -
              index,
          ),
          currentMonth: false,
        });
      }

      for (
        let day = 1;
        day <= daysInMonth;
        day++
      ) {
        days.push({
          date: new Date(
            year,
            month,
            day,
          ),
          currentMonth: true,
        });
      }

      let nextDay = 1;

      while (
        days.length < 42
      ) {
        days.push({
          date: new Date(
            year,
            month + 1,
            nextDay,
          ),
          currentMonth: false,
        });

        nextDay++;
      }

      return days;
    }, [currentMonth]);

  // ==================================================
  // GET APPOINTMENTS FOR DATE
  // ==================================================

  const getAppointmentsForDate =
    (
      date: Date,
    ) => {
      const dateKey =
        getDateKey(date);

      return appointments.filter(
        (appointment) =>
          appointment.appointment_date ===
          dateKey,
      );
    };

  // ==================================================
  // UPCOMING APPOINTMENTS
  // ==================================================

  const upcomingAppointments =
    useMemo(() => {
      const now =
        new Date();

      return appointments
        .filter(
          (appointment) => {
            const appointmentDate =
              new Date(
                `${appointment.appointment_date}T${appointment.start_time}`,
              );

            return (
              appointmentDate >=
                now &&
              appointment.status !==
                "CANCELLED"
            );
          },
        )
        .sort(
          (first, second) =>
            `${first.appointment_date}T${first.start_time}`.localeCompare(
              `${second.appointment_date}T${second.start_time}`,
            ),
        );
    }, [appointments]);

  // ==================================================
  // NOTIFICATIONS
  // ==================================================

  const notificationAppointments =
    useMemo(() => {
      return upcomingAppointments
        .filter(
          (appointment) =>
            ACTIVE_APPOINTMENT_STATUSES.includes(
              appointment.status,
            ),
        )
        .slice(0, 5);
    }, [
      upcomingAppointments,
    ]);

  const notificationCount =
    notificationAppointments.length;

  // ==================================================
  // THIS WEEK
  // ==================================================

  const thisWeekAppointments =
    useMemo(() => {
      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0,
      );

      const startOfWeek =
        new Date(today);

      startOfWeek.setDate(
        today.getDate() -
          today.getDay(),
      );

      const endOfWeek =
        new Date(
          startOfWeek,
        );

      endOfWeek.setDate(
        startOfWeek.getDate() +
          7,
      );

      return upcomingAppointments.filter(
        (appointment) => {
          const appointmentDate =
            new Date(
              `${appointment.appointment_date}T00:00:00`,
            );

          return (
            appointmentDate >=
              startOfWeek &&
            appointmentDate <
              endOfWeek
          );
        },
      );
    }, [
      upcomingAppointments,
    ]);

  // ==================================================
  // STATS
  // ==================================================

  const upcomingCount =
    upcomingAppointments.length;

  const completedCount =
    appointments.filter(
      (appointment) =>
        appointment.status ===
        "COMPLETED",
    ).length;

  const cancelledCount =
    appointments.filter(
      (appointment) =>
        appointment.status ===
        "CANCELLED",
    ).length;

  const doctorsConsulted =
    new Set(
      appointments
        .filter(
          (appointment) =>
            appointment.status ===
            "COMPLETED",
        )
        .map(
          (appointment) =>
            appointment.doctor_id,
        ),
    ).size;

  // ==================================================
  // CALENDAR NAVIGATION
  // ==================================================

  const goToPreviousMonth =
    () => {
      setCurrentMonth(
        (previous) =>
          new Date(
            previous.getFullYear(),
            previous.getMonth() -
              1,
            1,
          ),
      );
    };

  const goToNextMonth =
    () => {
      setCurrentMonth(
        (previous) =>
          new Date(
            previous.getFullYear(),
            previous.getMonth() +
              1,
            1,
          ),
      );
    };

  const goToToday = () => {
    const today =
      new Date();

    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      ),
    );

    setSelectedDate(
      getDateKey(today),
    );

    setCalendarView(
      "month",
    );

    setShowDayView(
      false,
    );
  };

  // ==================================================
  // DAY VIEW — CONTROLLED DATE
  // ==================================================

  const openDayView = (dateKey: string) => {
    const parsedDate = new Date(`${dateKey}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }

    // The selected date is the single source of truth.
    setSelectedDate(dateKey);

    setCurrentMonth(
      new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        1,
      ),
    );

    setCalendarView("day");
    setShowDayView(true);
  };

  const openTodayDayView =
    () => {
      const today =
        new Date();

      openDayView(getDateKey(today));
    };

  const closeDayView = () => {
    setShowDayView(
      false,
    );

    setCalendarView(
      "month",
    );
  };

  const handleDayDateChange = (date: string) => {
    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }

    // Day View navigation updates the same parent-controlled date.
    setSelectedDate(date);
    setCurrentMonth(
      new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        1,
      ),
    );
  };

  // ==================================================
  // BOOKING
  // ==================================================

  const openBooking = (
    date?: string,
    doctorId?: number,
    startTime?: string,
  ) => {
    setShowDayView(
      false,
    );

    // Preserve the date selected in Month / Week / Day View.
    setBookingDate(
      date || selectedDate || todayDate,
    );

    setBookingDoctorId(
      doctorId ?? null,
    );

    setBookingStartTime(
      startTime || "",
    );

    setShowBooking(
      true,
    );
  };

  const closeBooking = () => {
    setShowBooking(
      false,
    );

    setBookingDate(
      "",
    );

    setBookingDoctorId(
      null,
    );

    setBookingStartTime(
      "",
    );
  };

  const handleBookingSuccess =
    async () => {
      closeBooking();

      setShowDayView(
        false,
      );

      setCalendarView(
        "month",
      );

      await fetchAppointments(
        false,
      );
    };

  // ==================================================
  // APPOINTMENT DETAILS
  // ==================================================

  const openAppointmentDetails =
    (
      appointment: DayViewAppointment,
    ) => {
      const existing =
        appointments.find(
          (item) =>
            item.id ===
            appointment.id,
        );

      setSelectedAppointment(
        existing || {
          ...appointment,
        },
      );
    };

  const closeAppointmentDetails =
    () => {
      setSelectedAppointment(
        null,
      );
    };

  // ==================================================
  // PANELS
  // ==================================================

  const openPanel = (
    panel: DashboardPanel,
  ) => {
    setActivePanel(
      panel,
    );

    setShowAllAppointments(
      false,
    );

    setSelectedAppointment(
      null,
    );
  };

  const closePanel = () => {
    setActivePanel(
      null,
    );

    setEditingProfile(
      false,
    );

    setProfileMessage("");
    setProfileError("");
  };

  const handleProfile = () => {
    openPanel("profile");
  };

  const handleMedicalRecords =
    () => {
      openPanel("records");
    };

  const handleSettings = () => {
    openPanel("settings");
  };

  const handleHelp = () => {
    openPanel("help");
  };

  const handleNotifications =
    () => {
      openPanel("notifications");
    };

  const handleHealthRecords =
    () => {
      openPanel("records");
    };

  const handleUploadRecord =
    () => {
      openPanel("records");
    };

  const handleHealthSummary =
    () => {
      openPanel("profile");
    };

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="patient-dashboard">

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <aside className="patient-sidebar">

        <div className="sidebar-brand">

          <div className="brand-icon">
            ♥
          </div>

          <div>
            <h2>
              HealthCare
            </h2>

            <span>
              Appointment System
            </span>
          </div>

        </div>

        <nav className="sidebar-nav">

          <button
            type="button"
            className="nav-item active"
          >
            <span>⌂</span>
            Dashboard
          </button>

          <div className="nav-section-title">
            APPOINTMENTS
          </div>

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              navigate(
                "/patient/doctors",
              )
            }
          >
            <span>♙</span>
            Find Doctor
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              setShowAllAppointments(
                true,
              )
            }
          >
            <span>▣</span>
            My Appointments
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={goToToday}
          >
            <span>□</span>
            Calendar
          </button>

          <div className="sidebar-divider" />

          <div className="nav-section-title">
            ACCOUNT
          </div>

          <button
            type="button"
            className="nav-item"
            onClick={handleProfile}
          >
            <span>♙</span>
            Profile
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={
              handleMedicalRecords
            }
          >
            <span>▤</span>
            Medical Records
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={handleSettings}
          >
            <span>⚙</span>
            Settings
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={handleHelp}
          >
            <span>?</span>
            Help & Support
          </button>

        </nav>

        <div className="sidebar-user">

          <div
            className="user-info"
            onClick={handleProfile}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                handleProfile();
              }
            }}
          >

            <div className="user-avatar">
              {loadingPatient
                ? "..."
                : initials}
            </div>

            <div>
              <strong>
                {loadingPatient
                  ? "Loading..."
                  : profileName}
              </strong>

              <span>
                {profileEmail}
              </span>
            </div>

          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            ↪ Logout
          </button>

        </div>

      </aside>

      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="patient-main">

        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="dashboard-header">

          <div>

            <p className="dashboard-label">
              PATIENT DASHBOARD
            </p>

            <h1>
              {greeting},{" "}
              {firstName}!{" "}
              <span aria-hidden="true">
                {greetingIcon}
              </span>
            </h1>

            <p className="dashboard-subtitle">
              {formatLongDate(
                currentTime,
              )}
              {" · "}
              Here's your healthcare
              overview for today.
            </p>

          </div>

          <div className="header-actions">

            <button
              type="button"
              className="notification-button"
              onClick={
                handleNotifications
              }
              aria-label="Notifications"
            >
              ♧

              {notificationCount >
                0 && (
                <span className="notification-count">
                  {notificationCount >
                  9
                    ? "9+"
                    : notificationCount}
                </span>
              )}

            </button>

            <button
              type="button"
              className="header-avatar"
              onClick={handleProfile}
              aria-label="Open profile"
            >
              {loadingPatient
                ? "..."
                : initials}
            </button>

          </div>

        </header>

        {/* ==================================================
            STATUS / REFRESH
        ================================================== */}

        <div className="dashboard-status-bar">

          <div className="dashboard-live-status">

            <span
              className={
                autoRefresh
                  ? "live-dot active"
                  : "live-dot"
              }
            />

            <span>
              {autoRefresh
                ? "Dashboard updates automatically"
                : "Automatic refresh is off"}
            </span>

          </div>

          <button
            type="button"
            className="dashboard-refresh-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

        </div>

        {/* ==================================================
            ERROR
        ================================================== */}

        {appointmentsError && (
          <div className="dashboard-inline-error">

            <span>
              {appointmentsError}
            </span>

            <button
              type="button"
              onClick={() =>
                void fetchAppointments()
              }
            >
              Try Again
            </button>

          </div>
        )}

        {/* ==================================================
            STATS
        ================================================== */}

        <section className="stats-grid">

          <button
            type="button"
            className="stat-card"
            onClick={() =>
              setShowAllAppointments(
                true,
              )
            }
          >
            <div className="stat-icon blue">
              ▣
            </div>

            <div className="stat-content">

              <span>
                Upcoming Appointments
              </span>

              <strong>
                {upcomingCount}
              </strong>

              <small>
                Across your schedule
              </small>

            </div>
          </button>

          <button
            type="button"
            className="stat-card"
            onClick={() =>
              setShowAllAppointments(
                true,
              )
            }
          >
            <div className="stat-icon green">
              ✓
            </div>

            <div className="stat-content">

              <span>
                Completed Appointments
              </span>

              <strong>
                {completedCount}
              </strong>

              <small>
                Completed visits
              </small>

            </div>
          </button>

          <button
            type="button"
            className="stat-card"
            onClick={() =>
              navigate(
                "/patient/doctors",
              )
            }
          >
            <div className="stat-icon purple">
              ♙
            </div>

            <div className="stat-content">

              <span>
                Doctors Consulted
              </span>

              <strong>
                {doctorsConsulted}
              </strong>

              <small>
                Based on completed visits
              </small>

            </div>
          </button>

          <button
            type="button"
            className="stat-card"
            onClick={
              handleHealthRecords
            }
          >
            <div className="stat-icon orange">
              ▤
            </div>

            <div className="stat-content">

              <span>
                Health Records
              </span>

              <strong>—</strong>

              <small>
                Open medical records
              </small>

            </div>
          </button>

        </section>

        {/* ==================================================
            MAIN CONTENT
        ================================================== */}

        <section className="dashboard-content-grid">

          {/* ==================================================
              CALENDAR
          ================================================== */}

          <div className="calendar-card">

            <div className="section-header">

              <h2>
                Calendar
              </h2>

              <div className="calendar-header-actions">

                <button
                  type="button"
                  className="book-calendar-button"
                  onClick={() =>
                    openBooking()
                  }
                >
                  + Book Appointment
                </button>

                <button
                  type="button"
                  className="today-button"
                  onClick={goToToday}
                >
                  Today
                </button>

              </div>

            </div>

            <div className="calendar-toolbar">

              <div className="calendar-navigation">

                <button
                  type="button"
                  onClick={
                    goToPreviousMonth
                  }
                  disabled={
                    calendarView ===
                    "day"
                  }
                  aria-label="Previous month"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={
                    goToNextMonth
                  }
                  disabled={
                    calendarView ===
                    "day"
                  }
                  aria-label="Next month"
                >
                  ›
                </button>

              </div>

              <strong>

                {calendarView ===
                "day"
                  ? formatDate(
                      selectedDate,
                    )
                  : monthTitle}

              </strong>

              <div className="calendar-view">

                <button
                  type="button"
                  className={
                    calendarView ===
                    "month"
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    setCalendarView(
                      "month",
                    );

                    setShowDayView(
                      false,
                    );
                  }}
                >
                  Month
                </button>

                <button
                  type="button"
                  className={
                    calendarView ===
                    "week"
                      ? "selected"
                      : ""
                  }
                  onClick={() => {
                    setCalendarView(
                      "week",
                    );

                    setShowDayView(
                      false,
                    );
                  }}
                >
                  Week
                </button>

                <button
                  type="button"
                  className={
                    calendarView ===
                    "day"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    openDayView(selectedDate)
                  }
                >
                  Day
                </button>

              </div>

            </div>

            {/* ==================================================
                MONTH
            ================================================== */}

            {calendarView ===
              "month" && (
              <>

                <div className="calendar-weekdays">

                  {[
                    "Sun",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                  ].map(
                    (day) => (
                      <span
                        key={day}
                      >
                        {day}
                      </span>
                    ),
                  )}

                </div>

                <div className="calendar-grid">

                  {calendarDays.map(
                    (
                      calendarDay,
                    ) => {
                      const dateKey =
                        getDateKey(
                          calendarDay.date,
                        );

                      const dayAppointments =
                        getAppointmentsForDate(
                          calendarDay.date,
                        );

                      const isToday =
                        dateKey ===
                        todayDate;

                      return (
                        <button
                          type="button"
                          key={dateKey}
                          aria-current={
                            dateKey === selectedDate
                              ? "date"
                              : undefined
                          }
                          className={`calendar-day ${
                            calendarDay.currentMonth
                              ? ""
                              : "muted"
                          } ${
                            dayAppointments.length >
                            0
                              ? "has-appointment"
                              : ""
                          } ${
                            isToday
                              ? "today"
                              : ""
                          } ${
                            dateKey === selectedDate
                              ? "selected-day"
                              : ""
                          }`}
                          onClick={() =>
                            openDayView(dateKey)
                          }
                        >

                          <span className="calendar-day-number">
                            {
                              calendarDay.date.getDate()
                            }
                          </span>

                          {dayAppointments.length >
                            0 && (
                            <div className="calendar-appointments">

                              {dayAppointments
                                .slice(
                                  0,
                                  2,
                                )
                                .map(
                                  (
                                    appointment,
                                  ) => (
                                    <span
                                      key={
                                        appointment.id
                                      }
                                      className="calendar-appointment"
                                      onClick={(
                                        event,
                                      ) => {
                                        event.stopPropagation();

                                        openAppointmentDetails(
                                          appointment,
                                        );
                                      }}
                                    >

                                      <strong>
                                        {formatTime(
                                          appointment.start_time,
                                        )}
                                      </strong>

                                      <span>
                                        {
                                          appointment.doctor_name
                                        }
                                      </span>

                                    </span>
                                  ),
                                )}

                              {dayAppointments.length >
                                2 && (
                                <small>
                                  +
                                  {
                                    dayAppointments.length -
                                    2
                                  }{" "}
                                  more
                                </small>
                              )}

                            </div>
                          )}

                        </button>
                      );
                    },
                  )}

                </div>

              </>
            )}

            {/* ==================================================
                WEEK
            ================================================== */}

            {calendarView ===
              "week" && (
              <div className="week-calendar-view">

                <div className="week-calendar-grid">

                  {Array.from(
                    {
                      length: 7,
                    },
                    (_, index) => {
                      // Build the visible week from the selected calendar date,
                      // not from today's system date.
                      const referenceDate =
                        new Date(
                          `${selectedDate}T00:00:00`,
                        );

                      referenceDate.setHours(
                        0,
                        0,
                        0,
                        0,
                      );

                      const sunday =
                        new Date(
                          referenceDate,
                        );

                      sunday.setDate(
                        referenceDate.getDate() -
                          referenceDate.getDay(),
                      );

                      const date =
                        new Date(
                          sunday,
                        );

                      date.setDate(
                        sunday.getDate() +
                          index,
                      );

                      const dateKey =
                        getDateKey(
                          date,
                        );

                      const dayAppointments =
                        getAppointmentsForDate(
                          date,
                        );

                      const isToday =
                        dateKey ===
                        todayDate;

                      return (
                        <div
                          key={dateKey}
                          className={`week-day-column ${
                            isToday
                              ? "today"
                              : ""
                          } ${
                            dateKey === selectedDate
                              ? "selected-day"
                              : ""
                          }`}
                        >

                          <button
                            type="button"
                            className="week-day-header"
                            aria-current={
                              dateKey === selectedDate
                                ? "date"
                                : undefined
                            }
                            onClick={() =>
                              openDayView(dateKey)
                            }
                          >
                            <span>
                              {date.toLocaleDateString(
                                "en-US",
                                {
                                  weekday:
                                    "short",
                                },
                              )}
                            </span>

                            <strong>
                              {date.getDate()}
                            </strong>
                          </button>

                          <div className="week-day-body">

                            {dayAppointments.length ===
                            0 ? (
                              <div className="week-no-appointment">
                                No appointments
                              </div>
                            ) : (
                              dayAppointments.map(
                                (
                                  appointment,
                                ) => (
                                  <button
                                    type="button"
                                    key={
                                      appointment.id
                                    }
                                    className="week-calendar-appointment"
                                    onClick={() =>
                                      openAppointmentDetails(
                                        appointment,
                                      )
                                    }
                                  >
                                    <strong>
                                      {formatTime(
                                        appointment.start_time,
                                      )}
                                    </strong>

                                    <span>
                                      {
                                        appointment.doctor_name
                                      }
                                    </span>

                                    <small>
                                      {
                                        appointment.status
                                      }
                                    </small>
                                  </button>
                                ),
                              )
                            )}

                            <button
                              type="button"
                              className="week-book-button"
                              onClick={() =>
                                openBooking(
                                  dateKey,
                                )
                              }
                            >
                              + Book
                            </button>

                          </div>

                        </div>
                      );
                    },
                  )}

                </div>

              </div>
            )}

          </div>

          {/* ==================================================
              UPCOMING
          ================================================== */}

          <div className="upcoming-card">

            <div className="section-header">

              <h2>
                Upcoming Appointments
              </h2>

              <div className="upcoming-header-actions">

                <button
                  type="button"
                  className="book-header-button"
                  onClick={() =>
                    openBooking()
                  }
                >
                  + Book Appointment
                </button>

                <button
                  type="button"
                  className="view-all-button"
                  onClick={() =>
                    setShowAllAppointments(
                      true,
                    )
                  }
                >
                  View All
                </button>

              </div>

            </div>

            {loadingAppointments ? (
              <div className="upcoming-empty">
                <p>
                  Loading your appointments...
                </p>
              </div>
            ) : upcomingAppointments.length ===
              0 ? (
              <div className="upcoming-empty">

                <div className="empty-icon">
                  ✓
                </div>

                <h3>
                  No upcoming appointments
                </h3>

                <p>
                  Your upcoming visits
                  will appear here.
                </p>

                <button
                  type="button"
                  className="book-button"
                  onClick={() =>
                    openBooking()
                  }
                >
                  + Book New Appointment
                </button>

              </div>
            ) : (
              <div className="upcoming-list">

                {upcomingAppointments
                  .slice(0, 4)
                  .map(
                    (
                      appointment,
                    ) => (
                      <button
                        type="button"
                        className="upcoming-appointment"
                        key={
                          appointment.id
                        }
                        onClick={() =>
                          openAppointmentDetails(
                            appointment,
                          )
                        }
                      >

                        <div className="appointment-date-box">

                          <strong>
                            {new Date(
                              `${appointment.appointment_date}T00:00:00`,
                            ).toLocaleDateString(
                              "en-US",
                              {
                                month:
                                  "short",
                              },
                            )}
                          </strong>

                          <span>
                            {new Date(
                              `${appointment.appointment_date}T00:00:00`,
                            ).getDate()}
                          </span>

                        </div>

                        <div className="appointment-info">

                          <strong>
                            {
                              appointment.doctor_name
                            }
                          </strong>

                          <span>
                            {formatDate(
                              appointment.appointment_date,
                            )}
                          </span>

                          <span>

                            {formatTime(
                              appointment.start_time,
                            )}

                            {" - "}

                            {formatTime(
                              appointment.end_time,
                            )}

                          </span>

                        </div>

                        <span className="appointment-status">
                          {
                            appointment.status
                          }
                        </span>

                      </button>
                    ),
                  )}

              </div>
            )}

          </div>

        </section>

        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

        <section className="quick-actions-card">

          <div className="section-header">

            <div>
              <h2>
                Quick Actions
              </h2>
            </div>

          </div>

          <div className="quick-actions-grid">

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/patient/doctors",
                )
              }
            >
              <span className="quick-icon blue">
                ♙
              </span>

              <span>
                Find Doctor
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                openBooking()
              }
            >
              <span className="quick-icon green">
                ▣
              </span>

              <span>
                Book Appointment
              </span>
            </button>

            <button
              type="button"
              onClick={
                handleUploadRecord
              }
            >
              <span className="quick-icon purple">
                ↑
              </span>

              <span>
                Medical Records
              </span>
            </button>

            <button
              type="button"
              onClick={
                handleHealthSummary
              }
            >
              <span className="quick-icon orange">
                ▤
              </span>

              <span>
                Health Summary
              </span>
            </button>

          </div>

        </section>

        {/* ==================================================
            THIS WEEK
        ================================================== */}

        <section className="week-card">

          <div className="section-header">

            <div>

              <h2>
                Upcoming This Week
              </h2>

              <p className="section-meta">
                {
                  thisWeekAppointments.length
                }{" "}
                scheduled{" "}
                {thisWeekAppointments.length ===
                1
                  ? "visit"
                  : "visits"}
              </p>

            </div>

            <button
              type="button"
              className="view-all-button"
              onClick={() =>
                setShowAllAppointments(
                  true,
                )
              }
            >
              View All
            </button>

          </div>

          {thisWeekAppointments.length ===
          0 ? (
            <div className="week-empty">
              No appointments scheduled
              for this week.
            </div>
          ) : (
            <div className="week-appointments">

              {thisWeekAppointments.map(
                (
                  appointment,
                ) => (
                  <button
                    type="button"
                    className="week-appointment"
                    key={
                      appointment.id
                    }
                    onClick={() =>
                      openAppointmentDetails(
                        appointment,
                      )
                    }
                  >
                    <strong>
                      {
                        appointment.doctor_name
                      }
                    </strong>

                    <span>
                      {formatDate(
                        appointment.appointment_date,
                      )}
                    </span>

                    <span>
                      {formatTime(
                        appointment.start_time,
                      )}
                      {" - "}
                      {formatTime(
                        appointment.end_time,
                      )}
                    </span>
                  </button>
                ),
              )}

            </div>
          )}

        </section>

      </main>

      {/* ==================================================
          DAY VIEW
      ================================================== */}

      {showDayView && (
        <DayView
          key={selectedDate}
          selectedDate={
            selectedDate
          }
          appointments={
            appointments
          }
          loading={
            loadingAppointments
          }
          onDateChange={
            handleDayDateChange
          }
          onBook={
            openBooking
          }
          onAppointmentClick={
            openAppointmentDetails
          }
          formatTime={
            formatTime
          }
          onClose={
            closeDayView
          }
        />
      )}

      {/* ==================================================
          BOOKING MODAL
      ================================================== */}

      {showBooking && (
        <div
          className="booking-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeBooking();
            }
          }}
        >

          <div
            className="booking-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              className="booking-modal-close"
              onClick={
                closeBooking
              }
              aria-label="Close booking"
            >
              ×
            </button>

            <AppointmentBooking
              initialDate={
                bookingDate
              }
              initialDoctorId={
                bookingDoctorId
              }
              initialStartTime={
                bookingStartTime
              }
              onBookingSuccess={
                handleBookingSuccess
              }
            />

          </div>

        </div>
      )}

      {/* ==================================================
          APPOINTMENT DETAILS
      ================================================== */}

      {selectedAppointment && (
        <div
          className="appointment-details-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAppointmentDetails();
            }
          }}
        >

          <div
            className="appointment-details-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              className="appointment-details-close"
              onClick={
                closeAppointmentDetails
              }
              aria-label="Close appointment details"
            >
              ×
            </button>

            <p className="appointment-details-label">
              APPOINTMENT DETAILS
            </p>

            <h2>
              {
                selectedAppointment.doctor_name
              }
            </h2>

            <div className="appointment-details-status">
              {
                selectedAppointment.status
              }
            </div>

            <div className="appointment-details-grid">

              <div>
                <span>
                  Date
                </span>

                <strong>
                  {formatDate(
                    selectedAppointment.appointment_date,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Time
                </span>

                <strong>
                  {formatTime(
                    selectedAppointment.start_time,
                  )}
                  {" - "}
                  {formatTime(
                    selectedAppointment.end_time,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Appointment Type
                </span>

                <strong>
                  {
                    selectedAppointment.appointment_type
                  }
                </strong>
              </div>

              <div>
                <span>
                  Reason
                </span>

                <strong>
                  {
                    selectedAppointment.reason ||
                    "Not provided"
                  }
                </strong>
              </div>

            </div>

            {selectedAppointment.notes && (
              <div className="appointment-details-notes">

                <span>
                  Notes
                </span>

                <p>
                  {
                    selectedAppointment.notes
                  }
                </p>

              </div>
            )}

            <div className="appointment-details-actions">

              <button
                type="button"
                className="confirmation-cancel"
                onClick={
                  closeAppointmentDetails
                }
              >
                Close
              </button>

              <button
                type="button"
                className="confirmation-submit"
                onClick={() => {
                  const date =
                    selectedAppointment.appointment_date;

                  const doctorId =
                    selectedAppointment.doctor_id;

                  closeAppointmentDetails();

                  openBooking(
                    date,
                    doctorId,
                  );
                }}
              >
                Book Another
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ==================================================
          ALL APPOINTMENTS
      ================================================== */}

      {showAllAppointments && (
        <div
          className="appointments-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowAllAppointments(
                false,
              );
            }
          }}
        >

          <div
            className="appointments-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="appointments-modal-header">

              <div>

                <p>
                  APPOINTMENTS
                </p>

                <h2>
                  All Appointments
                </h2>

                <span>
                  {appointments.length}{" "}
                  {appointments.length ===
                  1
                    ? "appointment"
                    : "appointments"}
                </span>

              </div>

              <button
                type="button"
                className="appointments-modal-close"
                onClick={() =>
                  setShowAllAppointments(
                    false,
                  )
                }
                aria-label="Close appointments"
              >
                ×
              </button>

            </div>

            {loadingAppointments ? (
              <div className="all-appointments-empty">
                Loading appointments...
              </div>
            ) : appointments.length ===
              0 ? (
              <div className="all-appointments-empty">

                <div className="all-empty-icon">
                  ✓
                </div>

                <h3>
                  No appointments yet
                </h3>

                <p>
                  Your booked appointments
                  will appear here.
                </p>

                <button
                  type="button"
                  className="book-button"
                  onClick={() => {
                    setShowAllAppointments(
                      false,
                    );

                    openBooking();
                  }}
                >
                  + Book New Appointment
                </button>

              </div>
            ) : (
              <div className="all-appointments-list">

                {appointments
                  .slice()
                  .sort(
                    (
                      first,
                      second,
                    ) =>
                      `${first.appointment_date}T${first.start_time}`.localeCompare(
                        `${second.appointment_date}T${second.start_time}`,
                      ),
                  )
                  .map(
                    (
                      appointment,
                    ) => (
                      <button
                        type="button"
                        className="all-appointment-item"
                        key={
                          appointment.id
                        }
                        onClick={() =>
                          openAppointmentDetails(
                            appointment,
                          )
                        }
                      >

                        <div className="all-appointment-date">

                          <strong>
                            {new Date(
                              `${appointment.appointment_date}T00:00:00`,
                            ).toLocaleDateString(
                              "en-US",
                              {
                                month:
                                  "short",
                              },
                            )}
                          </strong>

                          <span>
                            {new Date(
                              `${appointment.appointment_date}T00:00:00`,
                            ).getDate()}
                          </span>

                        </div>

                        <div className="all-appointment-info">

                          <strong>
                            {
                              appointment.doctor_name
                            }
                          </strong>

                          <span>
                            {formatDate(
                              appointment.appointment_date,
                            )}
                          </span>

                          <span>
                            {formatTime(
                              appointment.start_time,
                            )}
                            {" - "}
                            {formatTime(
                              appointment.end_time,
                            )}
                          </span>

                        </div>

                        <span className="appointment-status">
                          {
                            appointment.status
                          }
                        </span>

                      </button>
                    ),
                  )}

              </div>
            )}

            <div className="appointments-modal-footer">

              <button
                type="button"
                className="confirmation-cancel"
                onClick={() =>
                  setShowAllAppointments(
                    false,
                  )
                }
              >
                Close
              </button>

              <button
                type="button"
                className="confirmation-submit"
                onClick={() => {
                  setShowAllAppointments(
                    false,
                  );

                  openBooking();
                }}
              >
                + Book New Appointment
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ==================================================
          DYNAMIC DASHBOARD PANELS
      ================================================== */}

      {activePanel && (
        <div
          className="patient-panel-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePanel();
            }
          }}
        >

          <div
            className="patient-panel"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              className="patient-panel-close"
              onClick={closePanel}
              aria-label="Close panel"
            >
              ×
            </button>

            {/* ==================================================
                PROFILE
            ================================================== */}

            {activePanel ===
              "profile" && (
              <>

                <p className="patient-panel-kicker">
                  MY ACCOUNT
                </p>

                <h2>
                  Patient Profile
                </h2>

                <p className="patient-panel-description">
                  Your account and insurance
                  information from your
                  authenticated healthcare
                  account.
                </p>

                {profileMessage && (
                  <div className="dashboard-inline-error">
                    <span>
                      {profileMessage}
                    </span>
                  </div>
                )}

                {profileError && (
                  <div className="dashboard-inline-error">
                    <span>
                      {profileError}
                    </span>
                  </div>
                )}

                {!editingProfile ? (
                  <>

                    <div className="profile-hero">

                      <div className="profile-large-avatar">
                        {initials}
                      </div>

                      <div>
                        <strong>
                          {profileName}
                        </strong>

                        <span>
                          {profileEmail}
                        </span>

                        <small>
                          Patient Account
                        </small>
                      </div>

                    </div>

                    <div className="patient-panel-grid">

                      <div>
                        <span>
                          Full Name
                        </span>

                        <strong>
                          {profileName}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Email
                        </span>

                        <strong>
                          {profileEmail}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Date of Birth
                        </span>

                        <strong>
                          {patient?.date_of_birth
                            ? formatDate(
                                patient.date_of_birth,
                              )
                            : "Not provided"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Gender
                        </span>

                        <strong>
                          {patient?.gender ||
                            "Not provided"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Phone
                        </span>

                        <strong>
                          {patient?.phone ||
                            "Not provided"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Location
                        </span>

                        <strong>
                          {[
                            patient?.city,
                            patient?.state,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                            "Not provided"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Insurance Provider
                        </span>

                        <strong>
                          {patient?.insurance_provider ||
                            "No insurance on file"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Insurance Member ID
                        </span>

                        <strong>
                          {patient?.insurance_member_id ||
                            "Not provided"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Account Role
                        </span>

                        <strong>
                          {patient?.role ||
                            "PATIENT"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Account Status
                        </span>

                        <strong>
                          {patient?.is_active ===
                          false
                            ? "Inactive"
                            : "Active"}
                        </strong>
                      </div>

                    </div>

                    <div className="patient-panel-summary">

                      <div>
                        <strong>
                          {upcomingCount}
                        </strong>

                        <span>
                          Upcoming
                        </span>
                      </div>

                      <div>
                        <strong>
                          {completedCount}
                        </strong>

                        <span>
                          Completed
                        </span>
                      </div>

                      <div>
                        <strong>
                          {doctorsConsulted}
                        </strong>

                        <span>
                          Doctors
                        </span>
                      </div>

                      <div>
                        <strong>
                          {cancelledCount}
                        </strong>

                        <span>
                          Cancelled
                        </span>
                      </div>

                    </div>

                    <button
                      type="button"
                      className="panel-primary-button"
                      onClick={
                        startProfileEdit
                      }
                    >
                      Edit Profile
                    </button>

                  </>
                ) : (
                  <form
                    className="patient-profile-edit-form"
                    onSubmit={
                      saveProfile
                    }
                  >

                    <div className="profile-hero">

                      <div className="profile-large-avatar">
                        {getInitials(
                          profileForm.name ||
                            profileName,
                        )}
                      </div>

                      <div>
                        <strong>
                          Edit your profile
                        </strong>

                        <span>
                          Update your personal
                          and insurance details.
                        </span>
                      </div>

                    </div>

                    <div className="patient-panel-grid">

                      <div className="profile-edit-field">

                        <label htmlFor="profile-name">
                          Full Name
                        </label>

                        <input
                          id="profile-name"
                          type="text"
                          value={
                            profileForm.name
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "name",
                              event.target.value,
                            )
                          }
                          required
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-email">
                          Email
                        </label>

                        <input
                          id="profile-email"
                          type="email"
                          value={
                            profileForm.email
                          }
                          disabled
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-dob">
                          Date of Birth
                        </label>

                        <input
                          id="profile-dob"
                          type="date"
                          value={
                            profileForm.date_of_birth
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "date_of_birth",
                              event.target.value,
                            )
                          }
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-gender">
                          Gender
                        </label>

                        <select
                          id="profile-gender"
                          value={
                            profileForm.gender
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "gender",
                              event.target.value,
                            )
                          }
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

                      <div className="profile-edit-field">

                        <label htmlFor="profile-phone">
                          Phone
                        </label>

                        <input
                          id="profile-phone"
                          type="tel"
                          value={
                            profileForm.phone
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "phone",
                              event.target.value,
                            )
                          }
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-address">
                          Address
                        </label>

                        <input
                          id="profile-address"
                          type="text"
                          value={
                            profileForm.address
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "address",
                              event.target.value,
                            )
                          }
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-city">
                          City
                        </label>

                        <input
                          id="profile-city"
                          type="text"
                          value={
                            profileForm.city
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "city",
                              event.target.value,
                            )
                          }
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-state">
                          State
                        </label>

                        <input
                          id="profile-state"
                          type="text"
                          value={
                            profileForm.state
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "state",
                              event.target.value,
                            )
                          }
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-zip">
                          ZIP Code
                        </label>

                        <input
                          id="profile-zip"
                          type="text"
                          value={
                            profileForm.zip_code
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "zip_code",
                              event.target.value,
                            )
                          }
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-insurance-provider">
                          Insurance Provider
                        </label>

                        <input
                          id="profile-insurance-provider"
                          type="text"
                          placeholder="Enter insurance provider"
                          value={
                            profileForm.insurance_provider
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "insurance_provider",
                              event.target.value,
                            )
                          }
                        />

                      </div>

                      <div className="profile-edit-field">

                        <label htmlFor="profile-insurance-member-id">
                          Insurance Member ID
                        </label>

                        <input
                          id="profile-insurance-member-id"
                          type="text"
                          placeholder="Enter insurance member ID"
                          value={
                            profileForm.insurance_member_id
                          }
                          onChange={(event) =>
                            updateProfileField(
                              "insurance_member_id",
                              event.target.value,
                            )
                          }
                        />

                      </div>

                    </div>

                    <div className="appointment-details-actions">

                      <button
                        type="button"
                        className="confirmation-cancel"
                        onClick={
                          cancelProfileEdit
                        }
                        disabled={
                          savingProfile
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="confirmation-submit"
                        disabled={
                          savingProfile
                        }
                      >
                        {savingProfile
                          ? "Saving..."
                          : "Save Profile"}
                      </button>

                    </div>

                  </form>
                )}

              </>
            )}

            {/* ==================================================
                RECORDS
            ================================================== */}

            {activePanel ===
              "records" && (
              <>

                <p className="patient-panel-kicker">
                  HEALTHCARE
                </p>

                <h2>
                  Medical Records
                </h2>

                <p className="patient-panel-description">
                  Your medical records area
                  is ready for document
                  integration.
                </p>

                <div className="records-status-card">

                  <div className="records-status-icon">
                    ▤
                  </div>

                  <div>

                    <strong>
                      No records connected
                    </strong>

                    <span>
                      There is currently no
                      medical-record document
                      endpoint connected to
                      this dashboard.
                    </span>

                  </div>

                </div>

                <div className="records-info-grid">

                  <div>
                    <strong>
                      {appointments.length}
                    </strong>

                    <span>
                      Appointment history
                    </span>
                  </div>

                  <div>
                    <strong>
                      {doctorsConsulted}
                    </strong>

                    <span>
                      Doctors consulted
                    </span>
                  </div>

                </div>

                <button
                  type="button"
                  className="panel-primary-button"
                  onClick={() => {
                    closePanel();

                    navigate(
                      "/patient/doctors",
                    );
                  }}
                >
                  Find a Doctor
                </button>

              </>
            )}

            {/* ==================================================
                SETTINGS
            ================================================== */}

            {activePanel ===
              "settings" && (
              <>

                <p className="patient-panel-kicker">
                  PREFERENCES
                </p>

                <h2>
                  Dashboard Settings
                </h2>

                <p className="patient-panel-description">
                  Control how your patient
                  dashboard behaves.
                </p>

                <div className="setting-row">

                  <div>

                    <strong>
                      Automatic refresh
                    </strong>

                    <span>
                      Refresh appointments
                      every 30 seconds while
                      this dashboard is open.
                    </span>

                  </div>

                  <button
                    type="button"
                    className={`settings-toggle ${
                      autoRefresh
                        ? "enabled"
                        : ""
                    }`}
                    onClick={() =>
                      setAutoRefresh(
                        (value) =>
                          !value,
                      )
                    }
                    aria-pressed={
                      autoRefresh
                    }
                  >
                    <span />
                  </button>

                </div>

                <div className="settings-info-card">

                  <strong>
                    Live dashboard
                  </strong>

                  <span>
                    Appointment data is loaded
                    from your authenticated
                    patient account.
                  </span>

                </div>

                <button
                  type="button"
                  className="panel-primary-button"
                  onClick={() =>
                    void handleRefresh()
                  }
                >
                  Refresh My Dashboard
                </button>

              </>
            )}

            {/* ==================================================
                HELP
            ================================================== */}

            {activePanel ===
              "help" && (
              <>

                <p className="patient-panel-kicker">
                  SUPPORT
                </p>

                <h2>
                  Help & Support
                </h2>

                <p className="patient-panel-description">
                  Everything currently
                  available from your patient
                  dashboard.
                </p>

                <div className="help-list">

                  <button
                    type="button"
                    onClick={() => {
                      closePanel();

                      navigate(
                        "/patient/doctors",
                      );
                    }}
                  >
                    <strong>
                      Find a Doctor
                    </strong>

                    <span>
                      Browse available doctors
                      and start appointment
                      booking.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      closePanel();

                      openBooking();
                    }}
                  >
                    <strong>
                      Book Appointment
                    </strong>

                    <span>
                      Select a doctor, date
                      and available time slot.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      closePanel();

                      setShowAllAppointments(
                        true,
                      );
                    }}
                  >
                    <strong>
                      View Appointments
                    </strong>

                    <span>
                      Review your complete
                      appointment history.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      closePanel();

                      openTodayDayView();
                    }}
                  >
                    <strong>
                      Open Day View
                    </strong>

                    <span>
                      See today's appointment
                      schedule.
                    </span>
                  </button>

                </div>

              </>
            )}

            {/* ==================================================
                NOTIFICATIONS
            ================================================== */}

            {activePanel ===
              "notifications" && (
              <>

                <p className="patient-panel-kicker">
                  UPDATES
                </p>

                <h2>
                  Notifications
                </h2>

                <p className="patient-panel-description">
                  Appointment updates generated
                  from your current schedule.
                </p>

                {notificationAppointments.length ===
                0 ? (
                  <div className="notification-empty">

                    <div>
                      ✓
                    </div>

                    <strong>
                      You're all caught up
                    </strong>

                    <span>
                      There are no active
                      appointment notifications.
                    </span>

                  </div>
                ) : (
                  <div className="notification-list">

                    {notificationAppointments.map(
                      (
                        appointment,
                      ) => (
                        <button
                          type="button"
                          key={
                            appointment.id
                          }
                          onClick={() => {
                            closePanel();

                            openAppointmentDetails(
                              appointment,
                            );
                          }}
                        >

                          <div className="notification-item-icon">
                            ▣
                          </div>

                          <div>

                            <strong>
                              {
                                appointment.doctor_name
                              }
                            </strong>

                            <span>
                              {formatDate(
                                appointment.appointment_date,
                              )}
                              {" · "}
                              {formatTime(
                                appointment.start_time,
                              )}
                            </span>

                            <small>
                              {
                                appointment.status
                              }
                            </small>

                          </div>

                        </button>
                      ),
                    )}

                  </div>
                )}

              </>
            )}

          </div>

        </div>
      )}

    </div>
  );
}

export default PatientDashboard;