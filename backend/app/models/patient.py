from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    date_of_birth = Column(Date, nullable=True)
    gender = Column(String, nullable=True)

    phone = Column(String, nullable=True)

    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)

    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)

    # Insurance information
    insurance_provider = Column(String, nullable=True)
    insurance_member_id = Column(String, nullable=True)

    # Primary Care Provider (PCP)
    pcp_doctor_id = Column(
        Integer,
        ForeignKey("doctors.id"),
        nullable=True,
    )

    active = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationship with User
    user = relationship(
        "User",
        back_populates="patient",
    )

    # Relationship with PCP / Primary Care Provider
    pcp_doctor = relationship(
        "Doctor",
        foreign_keys=[pcp_doctor_id],
    )

    # Relationship with appointments
    appointments = relationship(
        "Appointment",
        back_populates="patient",
    )