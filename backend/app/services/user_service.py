from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.models.doctor import Doctor
from app.models.receptionist import Receptionist
from app.models.patient import Patient

from app.schemas.user import UserCreate, PatientRegister
from app.schemas.doctor import DoctorCreate
from app.schemas.receptionist import ReceptionistCreate


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:

    return (
        db.query(User)
        .filter(User.email == email)
        .first()
    )


# ==================================================
# CREATE USER
# ==================================================

def create_user(
    db: Session,
    user_data: UserCreate,
) -> User:

    hashed_password = hash_password(
        user_data.password
    )

    user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_password,
        role=user_data.role.value,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ==================================================
# CREATE PATIENT
# ==================================================

def create_patient(
    db: Session,
    patient_data: PatientRegister,
) -> User:

    hashed_password = hash_password(
        patient_data.password
    )

    # Create User
    user = User(
        name=patient_data.name,
        email=patient_data.email,
        password_hash=hashed_password,
        role=UserRole.PATIENT.value,
    )

    db.add(user)

    # Get user.id before creating Patient
    db.flush()

    # Create Patient profile
    patient = Patient(
        user_id=user.id,

        date_of_birth=patient_data.date_of_birth,
        gender=patient_data.gender,
        phone=patient_data.phone,

        city=patient_data.city,
        state=patient_data.state,

        insurance_provider=(
            patient_data.insurance_provider
        ),
    )

    db.add(patient)

    db.commit()

    db.refresh(user)

    return user


# ==================================================
# CREATE DOCTOR
# ==================================================

def create_doctor(
    db: Session,
    doctor_data: DoctorCreate,
) -> Doctor:

    hashed_password = hash_password(
        doctor_data.password
    )

    user = User(
        name=doctor_data.name,
        email=doctor_data.email,
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
        sub_specialization=(
            doctor_data.sub_specialization
        ),
        qualification=doctor_data.qualification,
        medical_school=(
            doctor_data.medical_school
        ),
        board_certification=(
            doctor_data.board_certification
        ),
        years_of_experience=(
            doctor_data.years_of_experience
        ),
        department=doctor_data.department,

        clinic_name=doctor_data.clinic_name,
        clinic_address=(
            doctor_data.clinic_address
        ),
        city=doctor_data.city,
        state=doctor_data.state,
        zip_code=doctor_data.zip_code,

        consultation_fee=(
            doctor_data.consultation_fee
        ),
        consultation_mode=(
            doctor_data.consultation_mode
        ),

        bio=doctor_data.bio,
        languages=doctor_data.languages,
        profile_photo=doctor_data.profile_photo,

        accepting_new_patients=(
            doctor_data.accepting_new_patients
        ),
    )

    db.add(doctor)

    db.commit()
    db.refresh(doctor)

    return doctor


# ==================================================
# CREATE RECEPTIONIST
# ==================================================

def create_receptionist(
    db: Session,
    receptionist_data: ReceptionistCreate,
) -> Receptionist:

    hashed_password = hash_password(
        receptionist_data.password
    )

    user = User(
        name=receptionist_data.name,
        email=receptionist_data.email,
        password_hash=hashed_password,
        role=UserRole.RECEPTIONIST.value,
    )

    db.add(user)
    db.flush()

    receptionist = Receptionist(
        user_id=user.id,

        employee_id=(
            receptionist_data.employee_id
        ),

        department=(
            receptionist_data.department
        ),

        phone=(
            receptionist_data.phone
        ),

        hire_date=(
            receptionist_data.hire_date
        ),

        shift=(
            receptionist_data.shift
        ),

        clinic_location=(
            receptionist_data.clinic_location
        ),
    )

    db.add(receptionist)

    db.commit()
    db.refresh(receptionist)

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

    hashed_password = hash_password(
        password
    )

    user = User(
        name=name,
        email=email,
        password_hash=hashed_password,
        role=UserRole.ADMIN.value,
    )

    db.add(user)

    db.commit()
    db.refresh(user)

    return user