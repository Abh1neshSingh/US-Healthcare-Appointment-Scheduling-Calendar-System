from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class Receptionist(Base):
    __tablename__ = "receptionists"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    employee_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True,
    )

    department = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    hire_date = Column(Date, nullable=True)
    shift = Column(String, nullable=True)
    clinic_location = Column(String, nullable=True)

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
        back_populates="receptionist",
    )