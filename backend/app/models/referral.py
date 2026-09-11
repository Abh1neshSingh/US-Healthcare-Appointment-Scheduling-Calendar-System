from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
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

    # ==================================================
    # PATIENT
    # ==================================================

    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )

    # ==================================================
    # REFERRING DOCTOR
    # ==================================================

    referring_doctor_id = Column(
        Integer,
        ForeignKey("doctors.id"),
        nullable=False,
        index=True,
    )

    # ==================================================
    # SPECIALIST DOCTOR
    # ==================================================

    specialist_doctor_id = Column(
        Integer,
        ForeignKey("doctors.id"),
        nullable=False,
        index=True,
    )

    # ==================================================
    # REFERRAL INFORMATION
    # ==================================================

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

    # ==================================================
    # PRIOR AUTHORIZATION
    # ==================================================

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

    # ==================================================
    # TIMESTAMPS
    # ==================================================

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ==================================================
    # RELATIONSHIPS
    # ==================================================

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