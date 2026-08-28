from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.database.connection import get_db

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule
from app.models.schedule_exception import ScheduleException
from app.models.patient import Patient

from app.schemas.appointment import AppointmentCreate


router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
)


# ==================================================
# DOCTOR AVAILABILITY
# Patient selects doctor + date
# ==================================================

@router.get("/availability")
def get_doctor_availability(
    doctor_id: int = Query(...),
    appointment_date: date = Query(...),
    current_user=Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
):

    # ----------------------------------------------
    # Check doctor
    # ----------------------------------------------

    doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id == doctor_id,
            Doctor.active == True,
        )
        .first()
    )

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )


    # ----------------------------------------------
    # Find day of week
    # ----------------------------------------------

    day_of_week = appointment_date.strftime("%A")


    # ----------------------------------------------
    # Check schedule exception
    # ----------------------------------------------

    exception = (
        db.query(ScheduleException)
        .filter(
            ScheduleException.doctor_id == doctor_id,
            ScheduleException.exception_date == appointment_date,
        )
        .first()
    )

    if exception and not exception.is_available:

        return {
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.name,
            "date": appointment_date,
            "day": day_of_week,
            "available": False,
            "message": (
                exception.reason
                or "Doctor is unavailable on this date."
            ),
            "slots": [],
        }


    # ----------------------------------------------
    # Find regular schedule
    # ----------------------------------------------

    schedules = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.day_of_week == day_of_week,
            DoctorSchedule.is_available == True,
        )
        .all()
    )

    if not schedules:

        return {
            "doctor_id": doctor_id,
            "doctor_name": doctor.user.name,
            "date": appointment_date,
            "day": day_of_week,
            "available": False,
            "message": "Doctor is not available on this day.",
            "slots": [],
        }


    # ----------------------------------------------
    # Get existing appointments
    # ----------------------------------------------

    existing_appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == appointment_date,
            Appointment.status == "SCHEDULED",
        )
        .all()
    )


    # ----------------------------------------------
    # Generate slots
    # ----------------------------------------------

    slots = []

    for schedule in schedules:

        current_time = datetime.combine(
            appointment_date,
            schedule.start_time,
        )

        schedule_end = datetime.combine(
            appointment_date,
            schedule.end_time,
        )

        while current_time < schedule_end:

            slot_start = current_time.time()

            slot_end_datetime = (
                current_time
                + timedelta(
                    minutes=schedule.slot_duration
                )
            )

            slot_end = slot_end_datetime.time()


            # --------------------------------------
            # Don't create slot beyond schedule
            # --------------------------------------

            if slot_end_datetime > schedule_end:
                break


            # --------------------------------------
            # Check break
            # --------------------------------------

            is_break = False

            if (
                schedule.break_start
                and schedule.break_end
            ):
                if (
                    slot_start >= schedule.break_start
                    and slot_start < schedule.break_end
                ):
                    is_break = True


            if is_break:
                current_time = slot_end_datetime
                continue


            # --------------------------------------
            # Check existing appointment
            # --------------------------------------

            is_booked = False

            for appointment in existing_appointments:

                if (
                    slot_start < appointment.end_time
                    and slot_end > appointment.start_time
                ):
                    is_booked = True
                    break


            # --------------------------------------
            # Slot status
            # --------------------------------------

            if is_booked:
                slot_status = "booked"
            else:
                slot_status = "available"


            slots.append(
                {
                    "start_time": slot_start.strftime("%H:%M"),
                    "end_time": slot_end.strftime("%H:%M"),
                    "status": slot_status,
                }
            )


            current_time = slot_end_datetime


    # ----------------------------------------------
    # Calculate summary
    # ----------------------------------------------

    total_slots = len(slots)

    booked_slots = len(
        [
            slot
            for slot in slots
            if slot["status"] == "booked"
        ]
    )

    available_slots = total_slots - booked_slots


    # ----------------------------------------------
    # Return availability
    # ----------------------------------------------

    return {
        "doctor_id": doctor_id,
        "doctor_name": doctor.user.name,
        "date": appointment_date,
        "day": day_of_week,
        "available": available_slots > 0,
        "total_slots": total_slots,
        "available_slots": available_slots,
        "booked_slots": booked_slots,
        "slots": slots,
    }


# ==================================================
# CREATE APPOINTMENT
# Patient books an available slot
# ==================================================

@router.post(
    "",
    status_code=201,
)
def create_appointment(
    appointment_data: AppointmentCreate,
    current_user=Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
):

    # ----------------------------------------------
    # Find logged-in patient
    # ----------------------------------------------

    patient = (
        db.query(Patient)
        .filter(
            Patient.user_id
            == int(current_user["user_id"])
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found",
        )


    # ----------------------------------------------
    # Check doctor
    # ----------------------------------------------

    doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id == appointment_data.doctor_id,
            Doctor.active == True,
        )
        .first()
    )

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found",
        )


    # ----------------------------------------------
    # Check schedule exception
    # ----------------------------------------------

    exception = (
        db.query(ScheduleException)
        .filter(
            ScheduleException.doctor_id
            == appointment_data.doctor_id,

            ScheduleException.exception_date
            == appointment_data.appointment_date,
        )
        .first()
    )

    if exception and not exception.is_available:
        raise HTTPException(
            status_code=400,
            detail=(
                exception.reason
                or "Doctor is unavailable on this date."
            ),
        )


    # ----------------------------------------------
    # Find regular schedule
    # ----------------------------------------------

    day_of_week = (
        appointment_data.appointment_date
        .strftime("%A")
    )

    schedules = (
        db.query(DoctorSchedule)
        .filter(
            DoctorSchedule.doctor_id
            == appointment_data.doctor_id,

            DoctorSchedule.day_of_week
            == day_of_week,

            DoctorSchedule.is_available == True,
        )
        .all()
    )

    if not schedules:
        raise HTTPException(
            status_code=400,
            detail="Doctor is not available on this day.",
        )


    # ----------------------------------------------
    # Validate selected time slot
    # ----------------------------------------------

    valid_slot = False

    for schedule in schedules:

        current_time = datetime.combine(
            appointment_data.appointment_date,
            schedule.start_time,
        )

        schedule_end = datetime.combine(
            appointment_data.appointment_date,
            schedule.end_time,
        )

        while current_time < schedule_end:

            slot_start = current_time.time()

            slot_end_datetime = (
                current_time
                + timedelta(
                    minutes=schedule.slot_duration
                )
            )

            slot_end = slot_end_datetime.time()


            if slot_end_datetime > schedule_end:
                break


            # --------------------------------------
            # Skip break
            # --------------------------------------

            is_break = False

            if (
                schedule.break_start
                and schedule.break_end
            ):
                if (
                    slot_start >= schedule.break_start
                    and slot_start < schedule.break_end
                ):
                    is_break = True


            if not is_break:

                if (
                    appointment_data.start_time
                    == slot_start
                    and appointment_data.end_time
                    == slot_end
                ):
                    valid_slot = True
                    break


            current_time = slot_end_datetime


        if valid_slot:
            break


    if not valid_slot:
        raise HTTPException(
            status_code=400,
            detail="Selected time slot is not available.",
        )


    # ----------------------------------------------
    # Check overlapping appointment
    # ----------------------------------------------

    overlapping_appointment = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id
            == appointment_data.doctor_id,

            Appointment.appointment_date
            == appointment_data.appointment_date,

            Appointment.status == "SCHEDULED",

            Appointment.start_time
            < appointment_data.end_time,

            Appointment.end_time
            > appointment_data.start_time,
        )
        .first()
    )

    if overlapping_appointment:
        raise HTTPException(
            status_code=409,
            detail="This appointment slot is already booked.",
        )


    # ----------------------------------------------
    # Create appointment
    # ----------------------------------------------

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=appointment_data.doctor_id,
        appointment_date=(
            appointment_data.appointment_date
        ),
        start_time=appointment_data.start_time,
        end_time=appointment_data.end_time,
        status="SCHEDULED",
        appointment_type=(
            appointment_data.appointment_type
        ),
        reason=appointment_data.reason,
        notes=appointment_data.notes,
        created_by=patient.user_id,
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)


    # ----------------------------------------------
    # Return appointment
    # ----------------------------------------------

    return {
        "message": "Appointment booked successfully",

        "appointment": {
            "id": appointment.id,
            "patient_id": appointment.patient_id,
            "doctor_id": appointment.doctor_id,
            "appointment_date": (
                appointment.appointment_date
            ),
            "start_time": appointment.start_time,
            "end_time": appointment.end_time,
            "status": appointment.status,
            "appointment_type": (
                appointment.appointment_type
            ),
            "reason": appointment.reason,
            "notes": appointment.notes,
        },
    }


# ==================================================
# GET MY APPOINTMENTS
# Patient dashboard calendar
# ==================================================

@router.get("/my")
def get_my_appointments(
    current_user=Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
):

    # ----------------------------------------------
    # Find logged-in patient
    # ----------------------------------------------

    patient = (
        db.query(Patient)
        .filter(
            Patient.user_id
            == int(current_user["user_id"])
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found",
        )


    # ----------------------------------------------
    # Get patient appointments
    # ----------------------------------------------

    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient.id,
        )
        .order_by(
            Appointment.appointment_date,
            Appointment.start_time,
        )
        .all()
    )


    # ----------------------------------------------
    # Return appointments
    # ----------------------------------------------

    return {
        "count": len(appointments),

        "appointments": [
            {
                "id": appointment.id,
                "doctor_id": appointment.doctor_id,
                "doctor_name": (
                    appointment.doctor.user.name
                ),
                "appointment_date": (
                    appointment.appointment_date
                ),
                "start_time": (
                    appointment.start_time
                ),
                "end_time": (
                    appointment.end_time
                ),
                "status": appointment.status,
                "appointment_type": (
                    appointment.appointment_type
                ),
                "reason": appointment.reason,
                "notes": appointment.notes,
            }
            for appointment in appointments
        ],
    }