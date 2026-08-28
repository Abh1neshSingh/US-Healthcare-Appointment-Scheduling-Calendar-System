from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.database.connection import get_db

from app.schemas.user import PatientRegister, AdminCreate
from app.schemas.doctor import DoctorCreate
from app.schemas.receptionist import ReceptionistCreate

from app.services.user_service import (
    create_patient,
    create_doctor,
    create_receptionist,
    create_admin,
    get_user_by_email,
)

from app.models.doctor import Doctor
from app.models.receptionist import Receptionist
from app.models.patient import Patient
from app.models.enums import UserRole


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


# ==================================================
# PATIENT SELF REGISTRATION
# ==================================================

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
def register_patient(
    user_data: PatientRegister,
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        user_data.email,
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = create_patient(
        db,
        user_data,
    )

    return {
        "message": "Patient registered successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


# ==================================================
# ADMIN CREATES DOCTOR
# ==================================================

@router.post(
    "/doctors",
    status_code=status.HTTP_201_CREATED,
)
def create_doctor_by_admin(
    doctor_data: DoctorCreate,
    current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        doctor_data.email,
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    doctor = create_doctor(
        db,
        doctor_data,
    )

    return {
        "message": "Doctor created successfully",
        "doctor": {
            "id": doctor.id,
            "user_id": doctor.user_id,
            "name": doctor.user.name,
            "email": doctor.user.email,
            "role": doctor.user.role,
            "specialization": doctor.specialization,
            "license_number": doctor.license_number,
            "npi_number": doctor.npi_number,
            "department": doctor.department,
        },
    }


# ==================================================
# ADMIN CREATES RECEPTIONIST
# ==================================================

@router.post(
    "/receptionists",
    status_code=status.HTTP_201_CREATED,
)
def create_receptionist_by_admin(
    receptionist_data: ReceptionistCreate,
    current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        receptionist_data.email,
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    receptionist = create_receptionist(
        db,
        receptionist_data,
    )

    return {
        "message": "Receptionist created successfully",
        "receptionist": {
            "id": receptionist.id,
            "user_id": receptionist.user_id,
            "name": receptionist.user.name,
            "email": receptionist.user.email,
            "role": receptionist.user.role,
            "employee_id": receptionist.employee_id,
            "department": receptionist.department,
        },
    }


# ==================================================
# ADMIN CREATES ADMIN
# ==================================================

@router.post(
    "/admin",
    status_code=status.HTTP_201_CREATED,
)
def create_admin_by_admin(
    user_data: AdminCreate,
    current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        user_data.email,
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = create_admin(
        db,
        name=user_data.name,
        email=user_data.email,
        password=user_data.password,
    )

    return {
        "message": "Admin user created successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }

# ==================================================
# VIEW DOCTORS
# Admin + Patient
# ==================================================

@router.get(
    "/doctors",
)
def get_doctors(
    current_user=Depends(
        require_roles(["ADMIN", "PATIENT"])
    ),
    db: Session = Depends(get_db),
):
    doctors = (
        db.query(Doctor)
        .join(Doctor.user)
        .filter(
            Doctor.user.has(
                role=UserRole.DOCTOR.value
            )
        )
        .all()
    )

    # ----------------------------------------------
    # Patient view
    # ----------------------------------------------

    if current_user["role"] == "PATIENT":
        return {
            "count": len(doctors),
            "doctors": [
                {
                    "id": doctor.id,
                    "name": doctor.user.name,
                    "specialization": doctor.specialization,
                    "sub_specialization":
                        doctor.sub_specialization,
                    "qualification":
                        doctor.qualification,
                    "years_of_experience":
                        doctor.years_of_experience,
                    "department":
                        doctor.department,
                    "clinic_name":
                        doctor.clinic_name,
                    "city":
                        doctor.city,
                    "state":
                        doctor.state,
                    "consultation_fee":
                        doctor.consultation_fee,
                    "consultation_mode":
                        doctor.consultation_mode,
                    "bio": doctor.bio,
                    "languages": doctor.languages,
                    "profile_photo":
                        doctor.profile_photo,
                    "accepting_new_patients":
                        doctor.accepting_new_patients,
                }
                for doctor in doctors
            ],
        }

    # ----------------------------------------------
    # Admin view
    # ----------------------------------------------

    return {
        "count": len(doctors),
        "doctors": [
            {
                "id": doctor.id,
                "user_id": doctor.user_id,
                "name": doctor.user.name,
                "email": doctor.user.email,
                "specialization":
                    doctor.specialization,
                "sub_specialization":
                    doctor.sub_specialization,
                "license_number":
                    doctor.license_number,
                "npi_number":
                    doctor.npi_number,
                "qualification":
                    doctor.qualification,
                "department":
                    doctor.department,
                "years_of_experience":
                    doctor.years_of_experience,
                "clinic_name":
                    doctor.clinic_name,
                "city": doctor.city,
                "state": doctor.state,
                "consultation_fee":
                    doctor.consultation_fee,
                "consultation_mode":
                    doctor.consultation_mode,
                "accepting_new_patients":
                    doctor.accepting_new_patients,
            }
            for doctor in doctors
        ],
    }


# ==================================================
# VIEW RECEPTIONISTS
# Admin only
# ==================================================

@router.get(
    "/receptionists",
)
def get_receptionists(
    current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    receptionists = (
        db.query(Receptionist)
        .join(Receptionist.user)
        .filter(
            Receptionist.user.has(
                role=UserRole.RECEPTIONIST.value
            )
        )
        .all()
    )

    return {
        "count": len(receptionists),
        "receptionists": [
            {
                "id": receptionist.id,
                "user_id": receptionist.user_id,
                "name": receptionist.user.name,
                "email": receptionist.user.email,
                "employee_id": receptionist.employee_id,
                "department": receptionist.department,
                "phone": receptionist.phone,
                "hire_date": receptionist.hire_date,
                "shift": receptionist.shift,
                "clinic_location": receptionist.clinic_location,
            }
            for receptionist in receptionists
        ],
    }


# ==================================================
# VIEW PATIENTS
# Admin only
# ==================================================

@router.get(
    "/patients",
)
def get_patients(
    current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    patients = (
        db.query(Patient)
        .join(Patient.user)
        .filter(
            Patient.user.has(
                role=UserRole.PATIENT.value
            )
        )
        .all()
    )

    return {
        "count": len(patients),
        "patients": [
            {
                "id": patient.id,
                "user_id": patient.user_id,
                "name": patient.user.name,
                "email": patient.user.email,
                "date_of_birth": patient.date_of_birth,
                "gender": patient.gender,
                "phone": patient.phone,
                "address": patient.address,
                "city": patient.city,
                "state": patient.state,
                "zip_code": patient.zip_code,
                "emergency_contact_name": patient.emergency_contact_name,
                "emergency_contact_phone": patient.emergency_contact_phone,
                "insurance_provider": patient.insurance_provider,
                "insurance_member_id": patient.insurance_member_id,
            }
            for patient in patients
        ],
    }