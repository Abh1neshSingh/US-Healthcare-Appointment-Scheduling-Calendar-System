from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    text,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False,
        index=True,
    )

    doctor_id = Column(
        Integer,
        ForeignKey("doctors.id"),
        nullable=False,
        index=True,
    )

    appointment_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    start_time = Column(
        Time,
        nullable=False,
    )

    end_time = Column(
        Time,
        nullable=False,
    )

    status = Column(
        String,
        nullable=False,
        default="SCHEDULED",
        index=True,
    )

    appointment_type = Column(
        String,
        nullable=False,
        default="IN_PERSON",
    )

    reason = Column(
        Text,
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    cancellation_reason = Column(
        Text,
        nullable=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ==================================================
    # DATABASE-LEVEL APPOINTMENT OVERLAP PROTECTION
    # ==================================================
    #
    # PostgreSQL prevents two appointments belonging to
    # the same doctor from occupying overlapping time.
    #
    # [) means:
    #   start is included
    #   end is excluded
    #
    # Therefore:
    #
    # 10:00 - 10:30
    # 10:30 - 11:00
    #
    # are allowed.
    #
    # But:
    #
    # 10:00 - 10:30
    # 10:15 - 10:45
    #
    # is rejected.
    #
    # Only active appointments are protected:
    #
    #   SCHEDULED
    #   CONFIRMED
    #   CHECKED_IN
    #   IN_PROGRESS
    #
    # Terminal statuses:
    #
    #   COMPLETED
    #   CANCELLED
    #   NO_SHOW
    #
    # do not block future booking.
    # ==================================================

    __table_args__ = (
        ExcludeConstraint(
            (
                "doctor_id",
                "=",
            ),
            (
                text(
                    """
                    tsrange(
                        appointment_date + start_time,
                        appointment_date + end_time,
                        '[)'
                    )
                    """
                ),
                "&&",
            ),
            where=text(
                """
                status IN (
                    'SCHEDULED',
                    'CONFIRMED',
                    'CHECKED_IN',
                    'IN_PROGRESS'
                )
                """
            ),
            name="appointments_doctor_time_no_overlap",
        ),
    )

    # ==================================================
    # RELATIONSHIPS
    # ==================================================

    patient = relationship(
        "Patient",
        back_populates="appointments",
    )

    doctor = relationship(
        "Doctor",
        back_populates="appointments",
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
    )