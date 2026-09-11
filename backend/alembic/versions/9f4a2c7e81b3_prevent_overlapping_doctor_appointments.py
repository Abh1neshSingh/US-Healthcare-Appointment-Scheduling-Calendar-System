"""prevent overlapping doctor appointments

Revision ID: 9f4a2c7e81b3
Revises: b645bd6e54b3
Create Date: 2026-09-10
"""

from typing import Sequence, Union

from alembic import op


revision: str = "9f4a2c7e81b3"

down_revision: Union[str, Sequence[str], None] = "b645bd6e54b3"

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL extension required for using an integer
    # column inside an exclusion constraint.
    op.execute(
        "CREATE EXTENSION IF NOT EXISTS btree_gist"
    )

    # PostgreSQL exclusion constraint.
    #
    # Prevents overlapping appointments for the same doctor
    # while the appointment is still occupying the schedule.
    #
    # [) means:
    # start is included
    # end is excluded
    #
    # 10:00 - 10:30
    # 10:30 - 11:00  -> allowed
    #
    # 10:00 - 10:30
    # 10:15 - 10:45  -> blocked
    #
    # Terminal statuses do not block future appointments:
    # COMPLETED, CANCELLED, NO_SHOW

    op.execute(
        """
        ALTER TABLE appointments
        ADD CONSTRAINT appointments_doctor_time_no_overlap
        EXCLUDE USING gist (
            doctor_id WITH =,
            (
                tsrange(
                    appointment_date + start_time,
                    appointment_date + end_time,
                    '[)'
                )
            ) WITH &&
        )
        WHERE (
            status IN (
                'SCHEDULED',
                'CONFIRMED',
                'CHECKED_IN',
                'IN_PROGRESS'
            )
        )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE appointments
        DROP CONSTRAINT IF EXISTS
        appointments_doctor_time_no_overlap
        """
    )