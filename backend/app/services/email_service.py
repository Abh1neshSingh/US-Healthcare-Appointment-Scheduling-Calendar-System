import os
import smtplib
from email.message import EmailMessage


SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


def send_appointment_confirmation_email(
    patient_email: str,
    patient_name: str,
    doctor_name: str,
    appointment_date: str,
    start_time: str,
    end_time: str,
    appointment_type: str,
    appointment_id: int,
):
    """
    Send appointment confirmation email to patient.
    """

    message = EmailMessage()

    message["Subject"] = (
        "Appointment Confirmation"
    )

    message["From"] = SMTP_EMAIL
    message["To"] = patient_email

    message.set_content(
        f"""
Hello {patient_name},

Your appointment has been successfully booked.

Appointment Details
-------------------
Appointment ID: #{appointment_id}
Doctor: {doctor_name}
Date: {appointment_date}
Time: {start_time} - {end_time}
Appointment Type: {appointment_type}

Please arrive on time for your appointment.

Thank you,
US Healthcare Appointment Scheduling Calendar
"""
    )

    try:
        with smtplib.SMTP(
            "smtp.gmail.com",
            587,
        ) as server:

            server.starttls()

            server.login(
                SMTP_EMAIL,
                SMTP_PASSWORD,
            )

            server.send_message(message)

        print(
            f"Appointment confirmation email sent to "
            f"{patient_email}"
        )

        return True

    except Exception as error:

        print(
            f"Failed to send appointment email: {error}"
        )

        return False
