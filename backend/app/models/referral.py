from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Patient receiving the referral
    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )

    # Doctor who issued the referral (usually PCP)
    referring_doctor_id = Column(
        Integer,
        ForeignKey("doctors.id"),
        nullable=False,
        index=True,
    )

    # Specialist doctor the patient is being referred to
    specialist_doctor_id = Column(
        Integer,
        ForeignKey("doctors.id"),
        nullable=False,
        index=True,
    )

    # Referral information
    referral_number = Column(
        String,
        unique=True,
        nullable=True,
        index=True,
    )

    status = Column(
        String,
        default="ACTIVE",
        nullable=False,
    )

    issued_date = Column(
        Date,
        nullable=False,
    )

    expiry_date = Column(
        Date,
        nullable=True,
    )

    reason = Column(
        Text,
        nullable=True,
    )

    # Prior authorization information
    authorization_required = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    authorization_status = Column(
        String,
        default="NOT_REQUIRED",
        nullable=False,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    patient = relationship(
        "Patient",
        foreign_keys=[patient_id],
    )

    referring_doctor = relationship(
        "Doctor",
        foreign_keys=[referring_doctor_id],
    )

    specialist_doctor = relationship(
        "Doctor",
        foreign_keys=[specialist_doctor_id],
    )