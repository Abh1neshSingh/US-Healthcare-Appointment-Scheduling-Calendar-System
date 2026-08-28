from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)

    doctor_id = Column(
        Integer,
        ForeignKey("doctors.id"),
        nullable=False,
        index=True,
    )

    day_of_week = Column(String, nullable=False)

    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    slot_duration = Column(
        Integer,
        nullable=False,
        default=30,
    )

    break_start = Column(Time, nullable=True)
    break_end = Column(Time, nullable=True)

    is_available = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    effective_from = Column(Date, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    doctor = relationship(
        "Doctor",
        back_populates="schedules",
    )