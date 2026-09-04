"""add referral fields

Revision ID: b645bd6e54b3
Revises: bd9985856781
Create Date: 2026-09-03 15:32:30.391570

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b645bd6e54b3"
down_revision: Union[str, Sequence[str], None] = "bd9985856781"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ==================================================
    # CREATE REFERRALS TABLE
    # ==================================================

    op.create_table(
        "referrals",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "patient_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "referring_doctor_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "specialist_doctor_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "referral_number",
            sa.String(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column(
            "issued_date",
            sa.Date(),
            nullable=False,
        ),
        sa.Column(
            "expiry_date",
            sa.Date(),
            nullable=True,
        ),
        sa.Column(
            "reason",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "authorization_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "authorization_status",
            sa.String(),
            nullable=False,
            server_default="NOT_REQUIRED",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
        ),
        sa.ForeignKeyConstraint(
            ["referring_doctor_id"],
            ["doctors.id"],
        ),
        sa.ForeignKeyConstraint(
            ["specialist_doctor_id"],
            ["doctors.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ==================================================
    # REFERRAL INDEXES
    # ==================================================

    op.create_index(
        op.f("ix_referrals_id"),
        "referrals",
        ["id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_referrals_patient_id"),
        "referrals",
        ["patient_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_referrals_referral_number"),
        "referrals",
        ["referral_number"],
        unique=True,
    )

    op.create_index(
        op.f("ix_referrals_referring_doctor_id"),
        "referrals",
        ["referring_doctor_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_referrals_specialist_doctor_id"),
        "referrals",
        ["specialist_doctor_id"],
        unique=False,
    )

    # ==================================================
    # ADD REFERRAL REQUIREMENT TO DOCTORS
    # ==================================================

    op.add_column(
        "doctors",
        sa.Column(
            "requires_referral",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # ==================================================
    # ADD PCP DOCTOR TO PATIENTS
    # ==================================================

    op.add_column(
        "patients",
        sa.Column(
            "pcp_doctor_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_patients_pcp_doctor_id_doctors",
        "patients",
        "doctors",
        ["pcp_doctor_id"],
        ["id"],
    )


def downgrade() -> None:
    """Downgrade schema."""

    # ==================================================
    # REMOVE PATIENT PCP FOREIGN KEY
    # ==================================================

    op.drop_constraint(
        "fk_patients_pcp_doctor_id_doctors",
        "patients",
        type_="foreignkey",
    )

    # ==================================================
    # REMOVE PATIENT PCP COLUMN
    # ==================================================

    op.drop_column(
        "patients",
        "pcp_doctor_id",
    )

    # ==================================================
    # REMOVE DOCTOR REFERRAL COLUMN
    # ==================================================

    op.drop_column(
        "doctors",
        "requires_referral",
    )

    # ==================================================
    # REMOVE REFERRAL INDEXES
    # ==================================================

    op.drop_index(
        op.f("ix_referrals_specialist_doctor_id"),
        table_name="referrals",
    )

    op.drop_index(
        op.f("ix_referrals_referring_doctor_id"),
        table_name="referrals",
    )

    op.drop_index(
        op.f("ix_referrals_referral_number"),
        table_name="referrals",
    )

    op.drop_index(
        op.f("ix_referrals_patient_id"),
        table_name="referrals",
    )

    op.drop_index(
        op.f("ix_referrals_id"),
        table_name="referrals",
    )

    # ==================================================
    # REMOVE REFERRALS TABLE
    # ==================================================

    op.drop_table(
        "referrals",
    )