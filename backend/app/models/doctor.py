from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Professional information
    license_number = Column(String, unique=True, nullable=False, index=True)
    npi_number = Column(String, unique=True, nullable=True, index=True)
    specialization = Column(String, nullable=False)
    sub_specialization = Column(String, nullable=True)
    qualification = Column(String, nullable=False)
    medical_school = Column(String, nullable=True)
    board_certification = Column(String, nullable=True)
    years_of_experience = Column(Integer, nullable=True)
    department = Column(String, nullable=True)

    # Practice information
    clinic_name = Column(String, nullable=True)
    clinic_address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    consultation_fee = Column(Float, nullable=True)
    consultation_mode = Column(String, nullable=True)

    # Professional profile
    bio = Column(Text, nullable=True)
    languages = Column(String, nullable=True)
    profile_photo = Column(String, nullable=True)
    accepting_new_patients = Column(Boolean, default=True, nullable=False)

    # Status
    active = Column(Boolean, default=True, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="doctor")
    schedules = relationship(
        "DoctorSchedule",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )
    schedule_exceptions = relationship(
        "ScheduleException",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )
    appointments = relationship(
        "Appointment",
        back_populates="doctor",
    )