from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.database.connection import get_db

from app.schemas.user import (
    PatientRegister,
    AdminCreate,
    PatientProfileUpdate,
)
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
from app.models.user import User


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

    if existing_user is not None:
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
# CURRENT LOGGED-IN PATIENT
# ==================================================

@router.get("/me")
def get_current_user_profile(
    current_user=Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["user_id"])

    patient = (
        db.query(Patient)
        .filter(
            Patient.user_id == user_id
        )
        .first()
    )

    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    return {
        "id": patient.user.id,
        "patient_id": patient.id,
        "name": patient.user.name,
        "email": patient.user.email,
        "role": patient.user.role,
        "date_of_birth": patient.date_of_birth,
        "gender": patient.gender,
        "phone": patient.phone,
        "address": patient.address,
        "city": patient.city,
        "state": patient.state,
        "zip_code": patient.zip_code,
        "insurance_provider": patient.insurance_provider,
        "insurance_member_id": patient.insurance_member_id,
        "pcp_doctor_id": patient.pcp_doctor_id,
    }


# ==================================================
# UPDATE CURRENT LOGGED-IN PATIENT
# ==================================================

@router.put("/me")
def update_current_user_profile(
    user_data: PatientProfileUpdate,
    current_user=Depends(
        require_roles(["PATIENT"])
    ),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["user_id"])

    patient = (
        db.query(Patient)
        .filter(
            Patient.user_id == user_id
        )
        .first()
    )

    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found",
        )

    # --------------------------------------------------
    # ACCOUNT / PERSONAL INFORMATION
    # --------------------------------------------------

    if user_data.name is not None:
        # sourcery skip: use-named-expression
        if cleaned_name := user_data.name.strip():
            user.name = cleaned_name
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Name cannot be empty",
            )

    if user_data.phone is not None:
        patient.phone = (
            user_data.phone.strip()
            or None
        )

    if user_data.date_of_birth is not None:
        patient.date_of_birth = (
            user_data.date_of_birth
        )

    if user_data.gender is not None:
        patient.gender = user_data.gender

    # --------------------------------------------------
    # ADDRESS
    # --------------------------------------------------

    if user_data.address is not None:
        patient.address = (
            user_data.address.strip()
            or None
        )

    if user_data.city is not None:
        patient.city = (
            user_data.city.strip()
            or None
        )

    if user_data.state is not None:
        patient.state = (
            user_data.state.strip()
            or None
        )

    if user_data.zip_code is not None:
        patient.zip_code = (
            user_data.zip_code.strip()
            or None
        )

    # --------------------------------------------------
    # INSURANCE
    # --------------------------------------------------

    if user_data.insurance_provider is not None:
        patient.insurance_provider = (
            user_data.insurance_provider.strip()
            or None
        )

    if user_data.insurance_member_id is not None:
        patient.insurance_member_id = (
            user_data.insurance_member_id.strip()
            or None
        )

    db.commit()

    db.refresh(user)
    db.refresh(patient)

    return {
        "message": "Patient profile updated successfully",
        "user": {
            "id": user.id,
            "patient_id": patient.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "phone": patient.phone,
            "address": patient.address,
            "city": patient.city,
            "state": patient.state,
            "zip_code": patient.zip_code,
            "insurance_provider": patient.insurance_provider,
            "insurance_member_id": patient.insurance_member_id,
            "pcp_doctor_id": patient.pcp_doctor_id,
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
    _current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        doctor_data.email,
    )

    if existing_user is not None:
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
            "requires_referral": doctor.requires_referral,
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
    _current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        receptionist_data.email,
    )

    if existing_user is not None:
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
    _current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(
        db,
        user_data.email,
    )

    if existing_user is not None:
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
# CURRENT LOGGED-IN ADMIN
# ==================================================

@router.get("/admin/me")
def get_current_admin_profile(
    current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["user_id"])

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin account not found",
        )

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }


# ==================================================
# ADMIN CREATES PATIENT
# ==================================================

@router.post(
    "/patients",
    status_code=status.HTTP_201_CREATED,
)
def create_patient_by_admin(
    patient_data: PatientRegister,
    _current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    """
    Create a patient portal account from the admin console.

    Uses the same PatientRegister schema/service as public
    patient registration so both flows create the same
    Patient + User records and preserve all supported
    patient fields, including insurance and PCP.
    """

    existing_user = get_user_by_email(
        db,
        patient_data.email,
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # --------------------------------------------------
    # PCP VALIDATION
    # --------------------------------------------------

    if patient_data.pcp_doctor_id is not None:
        pcp = (
            db.query(Doctor)
            .filter(
                Doctor.id == patient_data.pcp_doctor_id
            )
            .first()
        )

        if pcp is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected PCP doctor not found",
            )

        if not pcp.active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected PCP doctor is inactive",
            )

        if not pcp.user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected PCP doctor account is inactive",
            )

    patient = create_patient(
        db,
        patient_data,
    )

    return {
        "message": "Patient created successfully",
        "patient": {
            "id": patient.id,
            "user_id": patient.user_id,
            "name": patient.user.name,
            "email": patient.user.email,
            "role": patient.user.role,
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "phone": patient.phone,
            "address": patient.address,
            "city": patient.city,
            "state": patient.state,
            "zip_code": patient.zip_code,
            "insurance_provider": patient.insurance_provider,
            "insurance_member_id": patient.insurance_member_id,
            "pcp_doctor_id": patient.pcp_doctor_id,
        },
    }


# ==================================================
# VIEW ADMINS
# ADMIN ONLY
# ==================================================

@router.get("/admins")
def get_admins(
    _current_user=Depends(
        require_roles(["ADMIN"])
    ),
    db: Session = Depends(get_db),
):
    admins = (
        db.query(User)
        .filter(
            User.role == UserRole.ADMIN.value
        )
        .order_by(User.name.asc())
        .all()
    )

    return {
        "admins": [
            {
                "id": admin.id,
                "name": admin.name,
                "email": admin.email,
                "role": admin.role,
                "is_active": admin.is_active,
            }
            for admin in admins
        ]
    }


# ==================================================
# VIEW DOCTORS
# ADMIN + RECEPTIONIST + PATIENT
# ==================================================

@router.get("/doctors")
def get_doctors(
    current_user=Depends(
        require_roles(
            ["ADMIN", "RECEPTIONIST", "PATIENT"]
        )
    ),
    db: Session = Depends(get_db),
):
    doctors_query = (
        db.query(Doctor)
        .join(Doctor.user)
        .filter(
            User.role == UserRole.DOCTOR.value
        )
    )

    # Patients should only see doctors who are
    # currently active and able to receive bookings.
    if current_user["role"] == UserRole.PATIENT.value:
        doctors_query = doctors_query.filter(
            Doctor.active.is_(True),
            User.is_active.is_(True),
        )

    doctors = (
        doctors_query
        .order_by(User.name.asc(), Doctor.id.asc())
        .all()
    )

    response = []

    for doctor in doctors:
        doctor_data = {
            "id": doctor.id,
            "user_id": doctor.user_id,
            "name": doctor.user.name,
            "email": doctor.user.email,
            "specialization": doctor.specialization,
            "department": doctor.department,
            "requires_referral": doctor.requires_referral,
            "active": doctor.active,
            "state": doctor.state,
            "profile_photo": doctor.profile_photo,
        }

        # Credential information is restricted to admins.
        if current_user["role"] == UserRole.ADMIN.value:
            doctor_data.update(
                {
                    "license_number": doctor.license_number,
                    "npi_number": doctor.npi_number,
                }
            )

        response.append(doctor_data)

    return {
        "doctors": response
    }


# ==================================================
# VIEW PATIENTS
# ADMIN + RECEPTIONIST
# ==================================================

@router.get("/patients")
def get_patients(
    _current_user=Depends(
        require_roles(["ADMIN", "RECEPTIONIST"])
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
        .order_by(User.name.asc(), Patient.id.asc())
        .all()
    )

    return {
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
                "insurance_provider": patient.insurance_provider,
                "insurance_member_id": patient.insurance_member_id,
                "pcp_doctor_id": patient.pcp_doctor_id,
            }
            for patient in patients
        ]
    }


# ==================================================
# VIEW RECEPTIONISTS
# ADMIN ONLY
# ==================================================

@router.get("/receptionists")
def get_receptionists(
    _current_user=Depends(
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
        .order_by(User.name.asc(), Receptionist.id.asc())
        .all()
    )

    return {
        "receptionists": [
            {
                "id": receptionist.id,
                "user_id": receptionist.user_id,
                "name": receptionist.user.name,
                "email": receptionist.user.email,
                "employee_id": receptionist.employee_id,
                "department": receptionist.department,
            }
            for receptionist in receptionists
        ]
    }