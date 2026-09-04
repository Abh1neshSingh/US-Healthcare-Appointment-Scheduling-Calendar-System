from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.database.connection import get_db

from app.models.referral import Referral
from app.models.patient import Patient
from app.models.doctor import Doctor

from app.schemas.referral import ReferralCreate


router = APIRouter(
    prefix="/referrals",
    tags=["Referrals"],
)


# ==================================================
# CREATE REFERRAL
# Admin + Receptionist + Doctor
# ==================================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_referral(
    referral_data: ReferralCreate,
    _current_user=Depends(
        require_roles(
            ["ADMIN", "RECEPTIONIST", "DOCTOR"]
        )
    ),
    db: Session = Depends(get_db),
):
    # ----------------------------------------------
    # Check patient
    # ----------------------------------------------

    patient = (
        db.query(Patient)
        .filter(
            Patient.id == referral_data.patient_id
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    # ----------------------------------------------
    # Check referring doctor
    # ----------------------------------------------

    referring_doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id
            == referral_data.referring_doctor_id
        )
        .first()
    )

    if not referring_doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referring doctor not found",
        )

    # ----------------------------------------------
    # Check specialist doctor
    # ----------------------------------------------

    specialist_doctor = (
        db.query(Doctor)
        .filter(
            Doctor.id
            == referral_data.specialist_doctor_id
        )
        .first()
    )

    if not specialist_doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specialist doctor not found",
        )

    # ----------------------------------------------
    # Referring doctor and specialist
    # cannot be the same
    # ----------------------------------------------

    if (
        referral_data.referring_doctor_id
        == referral_data.specialist_doctor_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Referring doctor and specialist "
                "doctor cannot be the same"
            ),
        )

    # ----------------------------------------------
    # Check referral number uniqueness
    # ----------------------------------------------

    if referral_data.referral_number:
        
     if existing_referral := (
        db.query(Referral)
        .filter(
            Referral.referral_number
            == referral_data.referral_number
        )
        .first()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Referral number already exists",
        )

    # ----------------------------------------------
    # Validate dates
    # ----------------------------------------------

    if (
        referral_data.expiry_date
        and referral_data.expiry_date
        < referral_data.issued_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Expiry date cannot be before "
                "issued date"
            ),
        )

    # ----------------------------------------------
    # Create referral
    # ----------------------------------------------

    referral = Referral(
        patient_id=referral_data.patient_id,
        referring_doctor_id=(
            referral_data.referring_doctor_id
        ),
        specialist_doctor_id=(
            referral_data.specialist_doctor_id
        ),
        referral_number=(
            referral_data.referral_number
        ),
        status=referral_data.status,
        issued_date=referral_data.issued_date,
        expiry_date=referral_data.expiry_date,
        reason=referral_data.reason,
        authorization_required=(
            referral_data.authorization_required
        ),
        authorization_status=(
            referral_data.authorization_status
        ),
        notes=referral_data.notes,
    )

    db.add(referral)
    db.commit()
    db.refresh(referral)

    return {
        "message": "Referral created successfully",
        "referral": {
            "id": referral.id,
            "patient_id": referral.patient_id,
            "referring_doctor_id":
                referral.referring_doctor_id,
            "specialist_doctor_id":
                referral.specialist_doctor_id,
            "referral_number":
                referral.referral_number,
            "status": referral.status,
            "issued_date": referral.issued_date,
            "expiry_date": referral.expiry_date,
            "reason": referral.reason,
            "authorization_required":
                referral.authorization_required,
            "authorization_status":
                referral.authorization_status,
            "notes": referral.notes,
            "created_at": referral.created_at,
        },
    }


# ==================================================
# GET PATIENT REFERRALS
# Patient + Admin + Receptionist + Doctor
# ==================================================

@router.get(
    "/patient/{patient_id}",
)
def get_patient_referrals(
    patient_id: int,
    current_user=Depends(
        require_roles(
            [
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
                "PATIENT",
            ]
        )
    ),
    db: Session = Depends(get_db),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    # ----------------------------------------------
    # Patient can only view own referrals
    # ----------------------------------------------

    if (
        current_user["role"] == "PATIENT"
        and patient.user_id
        != int(current_user["user_id"])
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own referrals",
        )

    referrals = (
        db.query(Referral)
        .filter(
            Referral.patient_id == patient_id
        )
        .order_by(
            Referral.created_at.desc()
        )
        .all()
    )

    return {
        "patient_id": patient_id,
        "count": len(referrals),
        "referrals": [
            {
                "id": referral.id,
                "patient_id":
                    referral.patient_id,
                "referring_doctor_id":
                    referral.referring_doctor_id,
                "referring_doctor_name":
                    referral.referring_doctor.user.name,
                "specialist_doctor_id":
                    referral.specialist_doctor_id,
                "specialist_doctor_name":
                    referral.specialist_doctor.user.name,
                "referral_number":
                    referral.referral_number,
                "status":
                    referral.status,
                "issued_date":
                    referral.issued_date,
                "expiry_date":
                    referral.expiry_date,
                "reason":
                    referral.reason,
                "authorization_required":
                    referral.authorization_required,
                "authorization_status":
                    referral.authorization_status,
                "notes":
                    referral.notes,
                "created_at":
                    referral.created_at,
            }
            for referral in referrals
        ],
    }


# ==================================================
# GET REFERRAL BY ID
# ==================================================

@router.get(
    "/{referral_id}",
)
def get_referral(
    referral_id: int,
    current_user=Depends(
        require_roles(
            [
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
                "PATIENT",
            ]
        )
    ),
    db: Session = Depends(get_db),
):
    referral = (
        db.query(Referral)
        .filter(
            Referral.id == referral_id
        )
        .first()
    )

    if not referral:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referral not found",
        )

    # ----------------------------------------------
    # Patient can only view own referral
    # ----------------------------------------------

    if (
        current_user["role"] == "PATIENT"
        and referral.patient.user_id
        != int(current_user["user_id"])
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own referral",
        )

    return {
        "id": referral.id,
        "patient_id": referral.patient_id,
        "referring_doctor_id":
            referral.referring_doctor_id,
        "referring_doctor_name":
            referral.referring_doctor.user.name,
        "specialist_doctor_id":
            referral.specialist_doctor_id,
        "specialist_doctor_name":
            referral.specialist_doctor.user.name,
        "referral_number":
            referral.referral_number,
        "status": referral.status,
        "issued_date":
            referral.issued_date,
        "expiry_date":
            referral.expiry_date,
        "reason": referral.reason,
        "authorization_required":
            referral.authorization_required,
        "authorization_status":
            referral.authorization_status,
        "notes": referral.notes,
        "created_at":
            referral.created_at,
    }


# ==================================================
# UPDATE REFERRAL STATUS
# Admin + Receptionist + Doctor
# ==================================================

@router.patch(
    "/{referral_id}/status",
)
def update_referral_status(
    referral_id: int,
    status_value: str,
    _current_user=Depends(
        require_roles(
            [
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
            ]
        )
    ),
    db: Session = Depends(get_db),
):
    referral = (
        db.query(Referral)
        .filter(
            Referral.id == referral_id
        )
        .first()
    )

    if not referral:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referral not found",
        )

    allowed_statuses = {
        "ACTIVE",
        "USED",
        "EXPIRED",
        "CANCELLED",
        "PENDING",
    }

    normalized_status = status_value.upper()

    if normalized_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid referral status. "
                "Allowed values: "
                "ACTIVE, USED, EXPIRED, "
                "CANCELLED, PENDING"
            ),
        )

    referral.status = normalized_status

    db.commit()
    db.refresh(referral)

    return {
        "message": "Referral status updated successfully",
        "referral": {
            "id": referral.id,
            "patient_id": referral.patient_id,
            "specialist_doctor_id":
                referral.specialist_doctor_id,
            "referral_number":
                referral.referral_number,
            "status":
                referral.status,
            "issued_date":
                referral.issued_date,
            "expiry_date":
                referral.expiry_date,
        },
    }