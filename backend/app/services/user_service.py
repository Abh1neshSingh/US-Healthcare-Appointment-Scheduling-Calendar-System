from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.doctor import Doctor
from app.models.enums import UserRole
from app.models.patient import Patient
from app.models.receptionist import Receptionist
from app.models.user import User
from app.schemas.doctor import DoctorCreate
from app.schemas.receptionist import ReceptionistCreate
from app.schemas.user import PatientRegister, UserCreate


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    normalized_email = email.strip().lower()

    return (
        db.query(User)
        .filter(User.email == normalized_email)
        .first()
    )


# ==================================================
# CREATE USER
# ==================================================

def create_user(
    db: Session,
    user_data: UserCreate,
) -> User:
    normalized_email = str(user_data.email).strip().lower()

    if get_user_by_email(db, normalized_email):
        raise ValueError("A user with this email already exists")

    hashed_password = hash_password(user_data.password)

    user = User(
        name=user_data.name,
        email=normalized_email,
        password_hash=hashed_password,
        role=user_data.role.value,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Unable to create user because the provided information "
            "already exists"
        ) from exc

    return user


# ==================================================
# CREATE PATIENT
# ==================================================

def create_patient(
    db: Session,
    patient_data: PatientRegister,
) -> User:
    normalized_email = str(patient_data.email).strip().lower()

    if get_user_by_email(db, normalized_email):
        raise ValueError("A user with this email already exists")

    if patient_data.pcp_doctor_id is not None:
        doctor = db.get(
            Doctor,
            patient_data.pcp_doctor_id,
        )

        if doctor is None:
            raise ValueError("Selected PCP doctor was not found")

        if not doctor.active:
            raise ValueError("Selected PCP doctor is inactive")

        if not doctor.user.is_active:
            raise ValueError("Selected PCP doctor is inactive")

    hashed_password = hash_password(
        patient_data.password
    )

    user = User(
        name=patient_data.name,
        email=normalized_email,
        password_hash=hashed_password,
        role=UserRole.PATIENT.value,
    )

    db.add(user)

    # Get user.id before creating Patient
    db.flush()

    patient = Patient(
        user_id=user.id,
        date_of_birth=patient_data.date_of_birth,
        gender=patient_data.gender,
        phone=patient_data.phone,
        city=patient_data.city,
        state=patient_data.state,
        insurance_provider=patient_data.insurance_provider,
        insurance_member_id=patient_data.insurance_member_id,
        pcp_doctor_id=patient_data.pcp_doctor_id,
    )

    db.add(patient)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Unable to create patient because the provided information "
            "already exists"
        ) from exc

    return user


# ==================================================
# CREATE DOCTOR
# ==================================================

def create_doctor(
    db: Session,
    doctor_data: DoctorCreate,
) -> Doctor:
    normalized_email = str(doctor_data.email).strip().lower()

    if get_user_by_email(db, normalized_email):
        raise ValueError("A user with this email already exists")

    hashed_password = hash_password(
        doctor_data.password
    )

    user = User(
        name=doctor_data.name,
        email=normalized_email,
        password_hash=hashed_password,
        role=UserRole.DOCTOR.value,
    )

    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        license_number=doctor_data.license_number,
        npi_number=doctor_data.npi_number,
        specialization=doctor_data.specialization,
        sub_specialization=doctor_data.sub_specialization,
        qualification=doctor_data.qualification,
        medical_school=doctor_data.medical_school,
        board_certification=doctor_data.board_certification,
        years_of_experience=doctor_data.years_of_experience,
        department=doctor_data.department,
        requires_referral=doctor_data.requires_referral,
        clinic_name=doctor_data.clinic_name,
        clinic_address=doctor_data.clinic_address,
        city=doctor_data.city,
        state=doctor_data.state,
        zip_code=doctor_data.zip_code,
        consultation_fee=doctor_data.consultation_fee,
        consultation_mode=doctor_data.consultation_mode,
        bio=doctor_data.bio,
        languages=doctor_data.languages,
        profile_photo=doctor_data.profile_photo,
        accepting_new_patients=doctor_data.accepting_new_patients,
    )

    db.add(doctor)

    try:
        db.commit()
        db.refresh(doctor)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Unable to create doctor because the email, license number, "
            "or NPI number may already exist"
        ) from exc

    return doctor


# ==================================================
# CREATE RECEPTIONIST
# ==================================================

def create_receptionist(
    db: Session,
    receptionist_data: ReceptionistCreate,
) -> Receptionist:
    normalized_email = str(
        receptionist_data.email
    ).strip().lower()

    if get_user_by_email(db, normalized_email):
        raise ValueError("A user with this email already exists")

    hashed_password = hash_password(
        receptionist_data.password
    )

    user = User(
        name=receptionist_data.name,
        email=normalized_email,
        password_hash=hashed_password,
        role=UserRole.RECEPTIONIST.value,
    )

    db.add(user)
    db.flush()

    receptionist = Receptionist(
        user_id=user.id,
        employee_id=receptionist_data.employee_id,
        department=receptionist_data.department,
        phone=receptionist_data.phone,
        hire_date=receptionist_data.hire_date,
        shift=receptionist_data.shift,
        clinic_location=receptionist_data.clinic_location,
    )

    db.add(receptionist)

    try:
        db.commit()
        db.refresh(receptionist)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Unable to create receptionist because the email or "
            "employee ID may already exist"
        ) from exc

    return receptionist


# ==================================================
# CREATE ADMIN
# ==================================================

def create_admin(
    db: Session,
    name: str,
    email: str,
    password: str,
) -> User:
    normalized_email = email.strip().lower()

    if get_user_by_email(db, normalized_email):
        raise ValueError("A user with this email already exists")

    hashed_password = hash_password(password)

    user = User(
        name=name.strip(),
        email=normalized_email,
        password_hash=hashed_password,
        role=UserRole.ADMIN.value,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Unable to create admin because the email may already exist"
        ) from exc

    return user