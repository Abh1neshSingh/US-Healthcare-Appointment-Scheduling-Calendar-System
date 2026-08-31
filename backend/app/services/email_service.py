import os
import requests


BREVO_API_KEY = os.getenv("BREVO_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_NAME = "US Healthcare Appointment Scheduler"


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
    Send appointment confirmation email using Brevo API.
    """

    url = "https://api.brevo.com/v3/smtp/email"

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
                "name": patient_name,
            }
        ],
        "subject": "Appointment Confirmation",
        "htmlContent": f"""
        <html>
            <body>
                <h2>Appointment Confirmed</h2>

                <p>Hello {patient_name},</p>

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
                        {doctor_name}
                    </li>

                    <li>
                        <strong>Date:</strong>
                        {appointment_date}
                    </li>

                    <li>
                        <strong>Time:</strong>
                        {start_time} - {end_time}
                    </li>

                    <li>
                        <strong>Appointment Type:</strong>
                        {appointment_type}
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
            url,
            headers=headers,
            json=payload,
            timeout=15,
        )

        response.raise_for_status()

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