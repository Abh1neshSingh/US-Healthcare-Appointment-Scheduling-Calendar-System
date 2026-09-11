import logging
from html import escape

import requests

from app.database.connection import settings


logger = logging.getLogger(__name__)

BREVO_API_KEY = settings.BREVO_API_KEY
SENDER_EMAIL = settings.SENDER_EMAIL
SENDER_NAME = "US Healthcare Appointment Scheduler"

BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email"
REQUEST_TIMEOUT = 15


def send_appointment_confirmation_email(
    patient_email: str,
    patient_name: str,
    doctor_name: str,
    appointment_date: str,
    start_time: str,
    end_time: str,
    appointment_type: str,
    appointment_id: int,
) -> bool:
    """
    Send appointment confirmation email using the Brevo API.
    """

    # Escape dynamic values before inserting them into HTML.
    safe_patient_name = escape(patient_name)
    safe_doctor_name = escape(doctor_name)
    safe_appointment_date = escape(appointment_date)
    safe_start_time = escape(start_time)
    safe_end_time = escape(end_time)
    safe_appointment_type = escape(appointment_type)

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    payload = {
        "sender": {
            "name": SENDER_NAME,
            "email": SENDER_EMAIL,
        },
        "to": [
            {
                "email": patient_email,
                "name": safe_patient_name,
            }
        ],
        "subject": "Appointment Confirmation",
        "htmlContent": f"""
        <html>
            <body>
                <h2>Appointment Confirmed</h2>

                <p>Hello {safe_patient_name},</p>

                <p>
                    Your appointment has been successfully booked.
                </p>

                <h3>Appointment Details</h3>

                <ul>
                    <li>
                        <strong>Appointment ID:</strong>
                        #{appointment_id}
                    </li>

                    <li>
                        <strong>Doctor:</strong>
                        {safe_doctor_name}
                    </li>

                    <li>
                        <strong>Date:</strong>
                        {safe_appointment_date}
                    </li>

                    <li>
                        <strong>Time:</strong>
                        {safe_start_time} - {safe_end_time}
                    </li>

                    <li>
                        <strong>Appointment Type:</strong>
                        {safe_appointment_type}
                    </li>
                </ul>

                <p>Please arrive on time for your appointment.</p>

                <br>

                <p>
                    Thank you,<br>
                    <strong>
                        US Healthcare Appointment Scheduling Calendar
                    </strong>
                </p>
            </body>
        </html>
        """,
    }

    try:
        response = requests.post(
            BREVO_EMAIL_URL,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )

        response.raise_for_status()

        logger.info(
            "Appointment confirmation email sent successfully "
            "for appointment_id=%s",
            appointment_id,
        )

        return True

    except requests.RequestException as exc:
        logger.error(
            "Failed to send appointment confirmation email "
            "for appointment_id=%s: %s",
            appointment_id,
            exc,
        )
        return False