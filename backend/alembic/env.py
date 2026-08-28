from logging.config import fileConfig

from alembic import context

from app.database.connection import engine, Base

# Import all models so Alembic can detect them
from app.models.user import User
from app.models.doctor import Doctor
from app.models.receptionist import Receptionist
from app.models.patient import Patient
from app.models.doctor_schedule import DoctorSchedule
from app.models.schedule_exception import ScheduleException
from app.models.appointment import Appointment


# Alembic Config object
config = context.config


# Logging configuration
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# SQLAlchemy models metadata
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in offline mode."""

    url = str(engine.url)

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in online mode."""

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()