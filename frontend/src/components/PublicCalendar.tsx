import React, { useMemo, useState } from "react";
import "./PublicCalendar.css";

interface CalendarDoctor {
  id: number;
  name: string;
  specialization?: string | null;
  department?: string | null;
  profile_photo?: string | null;
  requires_referral: boolean;
}

interface CalendarSlot {
  start_time: string;
  end_time: string;
  status:
    | "available"
    | "booked"
    | "break"
    | "not_available";
}

interface CalendarDay {
  date: string;
  day: string;
  available_slots: number;
  booked_slots: number;
  break_slots: number;
  not_available_slots: number;
  doctors: Record<
    string,
    Record<string, CalendarSlot>
  >;
}

export interface PublicCalendarResponse {
  start_date: string;
  end_date: string;
  doctors: CalendarDoctor[];
  days: Record<string, CalendarDay>;
  time_slots: string[];
}

interface PublicCalendarProps {
  data: PublicCalendarResponse;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onLogin: () => void;
  onRegister: () => void;
}

type CalendarView = "day" | "week" | "month";

interface SelectedSlot {
  doctorId: number;
  doctorName: string;
  date: string;
  slot: CalendarSlot;
}

const PublicCalendar: React.FC<PublicCalendarProps> = ({
  data,
  selectedDate,
  onDateChange,
  onLogin,
  onRegister,
}) => {
  const [view, setView] =
    useState<CalendarView>("day");

  const [selectedSlot, setSelectedSlot] =
    useState<SelectedSlot | null>(null);

  // ==========================================================
  // DATE HELPERS
  // ==========================================================

  const parseDate = (date: string) => {
    return new Date(`${date}T00:00:00`);
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const addDays = (
    dateString: string,
    amount: number
  ) => {
    const date = parseDate(dateString);

    date.setDate(
      date.getDate() + amount
    );

    return formatDate(date);
  };

  const startOfWeek = (
    dateString: string
  ) => {
    const date = parseDate(dateString);

    const day = date.getDay();

    date.setDate(
      date.getDate() - day
    );

    return formatDate(date);
  };

  const endOfWeek = (
    dateString: string
  ) => {
    return addDays(
      startOfWeek(dateString),
      6
    );
  };

  const getMonthName = (
    dateString: string
  ) => {
    return parseDate(
      dateString
    ).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const getLongDate = (
    dateString: string
  ) => {
    return parseDate(
      dateString
    ).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDisplayTime = (
    time: string
  ) => {
    const [hours, minutes] =
      time.split(":").map(Number);

    const period =
      hours >= 12 ? "PM" : "AM";

    const displayHour =
      hours % 12 || 12;

    return `${displayHour}:${String(
      minutes
    ).padStart(2, "0")} ${period}`;
  };

  // ==========================================================
  // TODAY
  // ==========================================================

  const today = formatDate(new Date());

  // ==========================================================
  // SELECTED DAY DATA
  // ==========================================================

  const selectedDay =
    data.days[selectedDate];

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary = useMemo(() => {
    if (!selectedDay) {
      return {
        available: 0,
        booked: 0,
        breaks: 0,
        unavailable: 0,
      };
    }

    return {
      available:
        selectedDay.available_slots,
      booked:
        selectedDay.booked_slots,
      breaks:
        selectedDay.break_slots,
      unavailable:
        selectedDay.not_available_slots,
    };
  }, [selectedDay]);

  // ==========================================================
  // MINI CALENDAR DATES
  // ==========================================================

  const miniCalendarDates = useMemo(() => {
    const selected =
      parseDate(selectedDate);

    const year =
      selected.getFullYear();

    const month =
      selected.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    );

    const firstWeekday =
      firstDay.getDay();

    const lastDay = new Date(
      year,
      month + 1,
      0
    );

    const totalDays =
      lastDay.getDate();

    const dates: string[] = [];

    // Previous month dates
    for (
      let index = firstWeekday - 1;
      index >= 0;
      index--
    ) {
      const date = new Date(
        year,
        month,
        -index
      );

      dates.push(
        formatDate(date)
      );
    }

    // Current month dates
    for (
      let day = 1;
      day <= totalDays;
      day++
    ) {
      dates.push(
        formatDate(
          new Date(
            year,
            month,
            day
          )
        )
      );
    }

    // Next month dates
    let nextDay = 1;

    while (
      dates.length % 7 !== 0
    ) {
      dates.push(
        formatDate(
          new Date(
            year,
            month + 1,
            nextDay
          )
        )
      );

      nextDay++;
    }

    return dates;
  }, [selectedDate]);

  // ==========================================================
  // MONTH VIEW DATES
  // ==========================================================

  const monthDates = useMemo(() => {
    const selected =
      parseDate(selectedDate);

    const year =
      selected.getFullYear();

    const month =
      selected.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    );

    const firstWeekday =
      firstDay.getDay();

    const lastDay = new Date(
      year,
      month + 1,
      0
    );

    const totalDays =
      lastDay.getDate();

    const dates: string[] = [];

    // Previous month dates
    for (
      let index = firstWeekday - 1;
      index >= 0;
      index--
    ) {
      dates.push(
        formatDate(
          new Date(
            year,
            month,
            -index
          )
        )
      );
    }

    // Current month dates
    for (
      let day = 1;
      day <= totalDays;
      day++
    ) {
      dates.push(
        formatDate(
          new Date(
            year,
            month,
            day
          )
        )
      );
    }

    // Next month dates
    let nextDay = 1;

    while (
      dates.length % 7 !== 0
    ) {
      dates.push(
        formatDate(
          new Date(
            year,
            month + 1,
            nextDay
          )
        )
      );

      nextDay++;
    }

    return dates;
  }, [selectedDate]);

  // ==========================================================
  // WEEK DATES
  // ==========================================================

  const weekDates = useMemo(() => {
    const firstDay =
      startOfWeek(selectedDate);

    return Array.from(
      { length: 7 },
      (_, index) =>
        addDays(
          firstDay,
          index
        )
    );
  }, [selectedDate]);

  // ==========================================================
  // MINI CALENDAR NAVIGATION
  // ==========================================================

  const changeMiniCalendarMonth = (
    amount: number
  ) => {
    const date =
      parseDate(selectedDate);

    date.setMonth(
      date.getMonth() + amount
    );

    onDateChange(
      formatDate(date)
    );
  };

  // ==========================================================
  // MAIN NAVIGATION
  // ==========================================================

  const handlePrevious = () => {
    if (view === "day") {
      onDateChange(
        addDays(
          selectedDate,
          -1
        )
      );

      return;
    }

    if (view === "week") {
      onDateChange(
        addDays(
          selectedDate,
          -7
        )
      );

      return;
    }

    const date =
      parseDate(selectedDate);

    date.setMonth(
      date.getMonth() - 1
    );

    onDateChange(
      formatDate(date)
    );
  };

  const handleNext = () => {
    if (view === "day") {
      onDateChange(
        addDays(
          selectedDate,
          1
        )
      );

      return;
    }

    if (view === "week") {
      onDateChange(
        addDays(
          selectedDate,
          7
        )
      );

      return;
    }

    const date =
      parseDate(selectedDate);

    date.setMonth(
      date.getMonth() + 1
    );

    onDateChange(
      formatDate(date)
    );
  };

  const handleToday = () => {
    onDateChange(today);
  };

  // ==========================================================
  // SLOT HELPERS
  // ==========================================================

  const getDoctorSlot = (
    date: string,
    doctorId: number,
    time: string
  ) => {
    return (
      data.days[date]
        ?.doctors[
          String(doctorId)
        ]?.[time] || null
    );
  };

  const getInitials = (
    name: string
  ) => {
    const parts =
      name.trim().split(" ");

    if (parts.length === 1) {
      return parts[0]
        .substring(0, 2)
        .toUpperCase();
    }

    return (
      parts[0][0] +
      parts[parts.length - 1][0]
    ).toUpperCase();
  };

  // ==========================================================
  // SLOT CLICK
  // ==========================================================

  const handleSlotClick = (
    doctor: CalendarDoctor,
    date: string,
    slot: CalendarSlot
  ) => {
    if (
      slot.status !==
      "available"
    ) {
      return;
    }

    setSelectedSlot({
      doctorId: doctor.id,
      doctorName: doctor.name,
      date,
      slot,
    });
  };

  const savePendingAppointment = () => {
    if (!selectedSlot) {
      return;
    }

    sessionStorage.setItem(
      "pendingAppointment",
      JSON.stringify(
        selectedSlot
      )
    );
  };

  const handleBookWithLogin = () => {
    savePendingAppointment();
    onLogin();
  };

  const handleBookWithRegister = () => {
    savePendingAppointment();
    onRegister();
  };

  // ==========================================================
  // CALENDAR TITLE
  // ==========================================================

  const calendarTitle = () => {
    if (view === "month") {
      return getMonthName(
        selectedDate
      );
    }

    if (view === "week") {
      const start =
        parseDate(
          startOfWeek(
            selectedDate
          )
        );

      const end =
        parseDate(
          endOfWeek(
            selectedDate
          )
        );

      if (
        start.getMonth() ===
        end.getMonth()
      ) {
        return `${start.toLocaleDateString(
          "en-US",
          {
            month: "long",
          }
        )} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
      }

      return `${start.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
        }
      )} – ${end.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
      )}`;
    }

    return getLongDate(
      selectedDate
    );
  };

  // ==========================================================
  // LEFT MINI CALENDAR
  // ==========================================================

  const renderMiniCalendar = () => {
    const selected =
      parseDate(selectedDate);

    const selectedMonth =
      selected.getMonth();

    const selectedYear =
      selected.getFullYear();

    return (
      <aside className="public-calendar-sidebar">

        <div className="mini-calendar-section">

          <h3>
            Select a Date
          </h3>

          <div className="mini-calendar-header">

            <button
              type="button"
              onClick={() =>
                changeMiniCalendarMonth(-1)
              }
              aria-label="Previous month"
            >
              ‹
            </button>

            <strong>
              {getMonthName(
                selectedDate
              )}
            </strong>

            <button
              type="button"
              onClick={() =>
                changeMiniCalendarMonth(1)
              }
              aria-label="Next month"
            >
              ›
            </button>

          </div>

          <div className="mini-calendar-weekdays">

            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].map((day) => (
              <span key={day}>
                {day}
              </span>
            ))}

          </div>

          <div className="mini-calendar-grid">

            {miniCalendarDates.map(
              (date) => {
                const parsed =
                  parseDate(date);

                const isCurrentMonth =
                  parsed.getMonth() ===
                    selectedMonth &&
                  parsed.getFullYear() ===
                    selectedYear;

                const isSelected =
                  date ===
                  selectedDate;

                const isToday =
                  date === today;

                return (
                  <button
                    key={date}
                    type="button"
                    className={[
                      "mini-calendar-day",
                      !isCurrentMonth
                        ? "outside-month"
                        : "",
                      isSelected
                        ? "selected"
                        : "",
                      isToday
                        ? "today"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      onDateChange(
                        date
                      )
                    }
                  >
                    {parsed.getDate()}
                  </button>
                );
              }
            )}

          </div>

        </div>

        {/* SELECTED DATE CARD */}

        <div className="public-selected-date-card">

          <div className="selected-date-icon">
            ▣
          </div>

          <div>
            <span>
              Selected Date
            </span>

            <strong>
              {getLongDate(
                selectedDate
              )}
            </strong>

            <small>
              Showing all doctors'
              schedules
            </small>
          </div>

        </div>

        {/* DAY OVERVIEW */}

        <div className="public-sidebar-overview">

          <h3>
            Day Overview
          </h3>

          <div className="sidebar-summary-grid">

            <div className="sidebar-summary available">
              <strong>
                {summary.available}
              </strong>

              <span>
                Available
                <br />
                slots
              </span>
            </div>

            <div className="sidebar-summary booked">
              <strong>
                {summary.booked}
              </strong>

              <span>
                Booked
                <br />
                slots
              </span>
            </div>

            <div className="sidebar-summary break">
              <strong>
                {summary.breaks}
              </strong>

              <span>
                Break
                <br />
                slots
              </span>
            </div>

            <div className="sidebar-summary unavailable">
              <strong>
                {summary.unavailable}
              </strong>

              <span>
                Not
                <br />
                Available
              </span>
            </div>

          </div>

        </div>

        {/* INFORMATION CARD */}

        <div className="public-sidebar-info">

          <strong>
            Better Healthcare
            <br />
            Starts Here
          </strong>

          <span>
            Compassionate care.
            Advanced treatments.
            A healthier you.
          </span>

        </div>

      </aside>
    );
  };

  // ==========================================================
  // MONTH VIEW
  // ==========================================================

  const renderMonthView = () => {
    return (
      <div className="public-month-view">

        <div className="public-month-weekdays">

          {[
            "Sun",
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
          ].map((day) => (
            <div
              key={day}
              className="public-month-weekday"
            >
              {day}
            </div>
          ))}

        </div>

        <div className="public-month-grid">

          {monthDates.map(
            (date) => {
              const day =
                data.days[date];

              const selected =
                parseDate(
                  selectedDate
                );

              const parsed =
                parseDate(date);

              const currentMonth =
                parsed.getMonth() ===
                  selected.getMonth() &&
                parsed.getFullYear() ===
                  selected.getFullYear();

              const isSelected =
                date ===
                selectedDate;

              return (
                <button
                  key={date}
                  type="button"
                  className={[
                    "public-month-day",
                    !currentMonth
                      ? "outside-month"
                      : "",
                    isSelected
                      ? "selected-day"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() =>
                    onDateChange(
                      date
                    )
                  }
                >

                  <span className="month-day-number">
                    {parsed.getDate()}
                  </span>

                  {day && (
                    <div className="month-day-stats">

                      {day.available_slots >
                        0 && (
                        <span className="month-stat available">
                          {day.available_slots}{" "}
                          available
                        </span>
                      )}

                      {day.booked_slots >
                        0 && (
                        <span className="month-stat booked">
                          {day.booked_slots}{" "}
                          booked
                        </span>
                      )}

                      {day.break_slots >
                        0 && (
                        <span className="month-stat break">
                          {day.break_slots}{" "}
                          break
                        </span>
                      )}

                    </div>
                  )}

                </button>
              );
            }
          )}

        </div>

      </div>
    );
  };

  // ==========================================================
  // WEEK VIEW
  // ==========================================================

  const renderWeekView = () => {
    return (
      <div className="public-week-view">

        <div className="public-week-header">

          <div className="public-time-column">
            Time
          </div>

          {weekDates.map(
            (date) => {
              const day =
                data.days[date];

              const isSelected =
                date ===
                selectedDate;

              return (
                <button
                  key={date}
                  type="button"
                  className={[
                    "public-week-day-header",
                    isSelected
                      ? "selected"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() =>
                    onDateChange(
                      date
                    )
                  }
                >

                  <span>
                    {parseDate(
                      date
                    ).toLocaleDateString(
                      "en-US",
                      {
                        weekday:
                          "short",
                      }
                    )}
                  </span>

                  <strong>
                    {parseDate(
                      date
                    ).getDate()}
                  </strong>

                  {day && (
                    <small>
                      {day.available_slots}{" "}
                      available
                    </small>
                  )}

                </button>
              );
            }
          )}

        </div>

        <div className="public-week-body">

          {data.time_slots.map(
            (time) => (
              <div
                className="public-week-row"
                key={time}
              >

                <div className="public-time-cell">
                  {formatDisplayTime(
                    time
                  )}
                </div>

                {weekDates.map(
                  (date) => {

                    const availableDoctors =
                      data.doctors.filter(
                        (doctor) => {
                          const slot =
                            getDoctorSlot(
                              date,
                              doctor.id,
                              time
                            );

                          return (
                            slot?.status ===
                            "available"
                          );
                        }
                      );

                    const bookedDoctors =
                      data.doctors.filter(
                        (doctor) => {
                          const slot =
                            getDoctorSlot(
                              date,
                              doctor.id,
                              time
                            );

                          return (
                            slot?.status ===
                            "booked"
                          );
                        }
                      );

                    const breakDoctors =
                      data.doctors.filter(
                        (doctor) => {
                          const slot =
                            getDoctorSlot(
                              date,
                              doctor.id,
                              time
                            );

                          return (
                            slot?.status ===
                            "break"
                          );
                        }
                      );

                    const firstAvailable =
                      availableDoctors[0];

                    const firstSlot =
                      firstAvailable
                        ? getDoctorSlot(
                            date,
                            firstAvailable.id,
                            time
                          )
                        : null;

                    return (
                      <div
                        key={`${date}-${time}`}
                        className="public-week-cell"
                      >

                        {availableDoctors.length >
                          0 && (
                          <button
                            type="button"
                            className="week-available"
                            onClick={() => {
                              if (
                                firstAvailable &&
                                firstSlot
                              ) {
                                handleSlotClick(
                                  firstAvailable,
                                  date,
                                  firstSlot
                                );
                              }
                            }}
                          >
                            <span>
                              +
                            </span>

                            {
                              availableDoctors.length
                            }{" "}
                            available
                          </button>
                        )}

                        {bookedDoctors.length >
                          0 && (
                          <div className="week-booked">
                            {
                              bookedDoctors.length
                            }{" "}
                            booked
                          </div>
                        )}

                        {breakDoctors.length >
                          0 && (
                          <div className="week-break">
                            Break
                          </div>
                        )}

                        {availableDoctors.length ===
                            0 &&
                          bookedDoctors.length ===
                            0 &&
                          breakDoctors.length ===
                            0 && (
                            <div className="week-unavailable">
                              —
                            </div>
                          )}

                      </div>
                    );
                  }
                )}

              </div>
            )
          )}

        </div>

      </div>
    );
  };

  // ==========================================================
  // DAY VIEW
  // ==========================================================

  const renderDayView = () => {
    return (
      <div className="public-day-view">

        <div
          className="public-schedule-header"
          style={
            {
              "--doctor-count":
                data.doctors.length,
            } as React.CSSProperties
          }
        >

          <div className="public-time-header">
            Time
          </div>

          {data.doctors.map(
            (doctor) => (
              <div
                className="public-doctor-header"
                key={doctor.id}
              >

                <div className="doctor-avatar">

                  {doctor.profile_photo ? (
                    <img
                      src={
                        doctor.profile_photo
                      }
                      alt={
                        doctor.name
                      }
                    />
                  ) : (
                    getInitials(
                      doctor.name
                    )
                  )}

                </div>

                <div className="doctor-header-info">

                  <strong>
                    {doctor.name}
                  </strong>

                  <span>
                    {doctor.specialization ||
                      doctor.department ||
                      "Healthcare Provider"}
                  </span>

                </div>

              </div>
            )
          )}

        </div>

        <div className="public-schedule-body">

          {data.time_slots.map(
            (time) => (
              <div
                className="public-schedule-row"
                key={time}
                style={
                  {
                    "--doctor-count":
                      data.doctors.length,
                  } as React.CSSProperties
                }
              >

                <div className="public-time-cell">
                  {formatDisplayTime(
                    time
                  )}
                </div>

                {data.doctors.map(
                  (doctor) => {

                    const slot =
                      getDoctorSlot(
                        selectedDate,
                        doctor.id,
                        time
                      );

                    if (!slot) {
                      return (
                        <div
                          key={doctor.id}
                          className="public-slot-cell"
                        >
                          <button
                            type="button"
                            disabled
                            className="slot-status not_available"
                          >
                            <span className="status-icon">
                              —
                            </span>
                            Not Available
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={doctor.id}
                        className="public-slot-cell"
                      >

                        <button
                          type="button"
                          disabled={
                            slot.status !==
                            "available"
                          }
                          className={`slot-status ${slot.status}`}
                          onClick={() =>
                            handleSlotClick(
                              doctor,
                              selectedDate,
                              slot
                            )
                          }
                        >

                          {slot.status ===
                            "available" && (
                            <>
                              <span className="status-icon">
                                ✓
                              </span>
                              Available
                            </>
                          )}

                          {slot.status ===
                            "booked" && (
                            <>
                              <span className="status-icon">
                                ×
                              </span>
                              Booked
                            </>
                          )}

                          {slot.status ===
                            "break" && (
                            <>
                              <span className="status-icon">
                                •
                              </span>
                              Break
                            </>
                          )}

                          {slot.status ===
                            "not_available" && (
                            <>
                              <span className="status-icon">
                                —
                              </span>
                              Not Available
                            </>
                          )}

                        </button>

                      </div>
                    );
                  }
                )}

              </div>
            )
          )}

        </div>

      </div>
    );
  };

  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <div className="public-calendar">

      <div className="public-calendar-layout">

        {/* LEFT SIDEBAR */}

        {renderMiniCalendar()}

        {/* RIGHT MAIN CALENDAR */}

        <div className="public-calendar-main">

          <div className="public-calendar-top">

            <div className="public-calendar-title">

              <span className="calendar-label">
                APPOINTMENT CALENDAR
              </span>

              <h2>
                {calendarTitle()}
              </h2>

              <p>
                All doctors' availability
                for this date
              </p>

            </div>

            <div className="public-calendar-controls">

              <div className="view-switcher">

                <button
                  type="button"
                  className={
                    view === "day"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setView("day")
                  }
                >
                  Day
                </button>

                <button
                  type="button"
                  className={
                    view === "week"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setView("week")
                  }
                >
                  Week
                </button>

                <button
                  type="button"
                  className={
                    view === "month"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setView("month")
                  }
                >
                  Month
                </button>

              </div>

              <div className="calendar-navigation">

                <button
                  type="button"
                  onClick={
                    handlePrevious
                  }
                  aria-label="Previous"
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="today-button"
                  onClick={
                    handleToday
                  }
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={
                    handleNext
                  }
                  aria-label="Next"
                >
                  ›
                </button>

              </div>

            </div>

          </div>

          {/* LEGEND */}

          {view !== "month" && (
            <div className="public-status-legend">

              <span>
                <i className="legend-dot available" />
                Available
              </span>

              <span>
                <i className="legend-dot booked" />
                Booked
              </span>

              <span>
                <i className="legend-dot break" />
                Break
              </span>

              <span>
                <i className="legend-dot not-available" />
                Not Available
              </span>

            </div>
          )}

          {/* CALENDAR CONTENT */}

          <div className="public-calendar-content">

            {view === "day" &&
              renderDayView()}

            {view === "week" &&
              renderWeekView()}

            {view === "month" &&
              renderMonthView()}

          </div>

          {/* BOOKING CTA */}

          <div className="public-booking-cta">

            <div className="booking-cta-icon">
              🔒
            </div>

            <div className="booking-cta-content">

              <strong>
                Ready to book an appointment?
              </strong>

              <span>
                Login to your account or create
                a new account to book an appointment.
              </span>

            </div>

            <div className="booking-cta-actions">

              <button
                type="button"
                className="cta-login"
                onClick={onLogin}
              >
                Login
              </button>

              <button
                type="button"
                className="cta-register"
                onClick={onRegister}
              >
                Register
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* SLOT MODAL */}

      {selectedSlot && (
        <div
          className="public-slot-overlay"
          onClick={() =>
            setSelectedSlot(null)
          }
        >

          <div
            className="public-slot-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              className="slot-modal-close"
              onClick={() =>
                setSelectedSlot(null)
              }
              aria-label="Close"
            >
              ×
            </button>

            <div className="slot-modal-icon">
              ✓
            </div>

            <span className="slot-modal-label">
              AVAILABLE APPOINTMENT
            </span>

            <h3>
              {selectedSlot.doctorName}
            </h3>

            <p className="slot-modal-date">
              {getLongDate(
                selectedSlot.date
              )}
            </p>

            <div className="slot-modal-time">

              <span>
                {formatDisplayTime(
                  selectedSlot.slot
                    .start_time
                )}
              </span>

              <small>
                to
              </small>

              <span>
                {formatDisplayTime(
                  selectedSlot.slot
                    .end_time
                )}
              </span>

            </div>

            <div className="slot-modal-message">

              <strong>
                Login required
              </strong>

              <p>
                Please login or register
                before booking this
                appointment.
              </p>

            </div>

            <div className="slot-modal-actions">

              <button
                type="button"
                className="slot-modal-login"
                onClick={
                  handleBookWithLogin
                }
              >
                Login & Continue
              </button>

              <button
                type="button"
                className="slot-modal-register"
                onClick={
                  handleBookWithRegister
                }
              >
                Create Account
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default PublicCalendar;