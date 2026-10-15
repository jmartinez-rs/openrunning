"""Add planrecalibration audit table.

Stores one append-only row per explicit VDOT recalibration (R22/R23): the
source of the new VDOT, before/after paces, the effective future week and the
derived delta used to flag suspicious or declining recalibrations.

Revision ID: 5a0000000000
Revises: 4a0000000000
Create Date: 2026-10-15
"""

import sqlalchemy as sa
from alembic import op

revision = "5a0000000000"
down_revision = "4a0000000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "planrecalibration",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("source_ref", sa.JSON(), nullable=True),
        sa.Column("old_vdot", sa.Float(), nullable=False),
        sa.Column("new_vdot", sa.Float(), nullable=False),
        sa.Column("delta_vdot", sa.Float(), nullable=False),
        sa.Column("old_paces", sa.JSON(), nullable=False),
        sa.Column("new_paces", sa.JSON(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("suspicious", sa.Boolean(), nullable=False),
        sa.Column("effective_from_week", sa.Integer(), nullable=False),
        sa.Column("effective_from_date", sa.Date(), nullable=False),
        sa.Column("affected_workouts", sa.Integer(), nullable=False),
        sa.Column("affected_blocks", sa.Integer(), nullable=False),
        sa.Column("engine_version", sa.String(length=16), nullable=False),
        sa.Column("applied", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["plan_id"], ["runningplan.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_planrecalibration_plan_id"),
        "planrecalibration",
        ["plan_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_planrecalibration_user_id"),
        "planrecalibration",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_planrecalibration_user_id"), table_name="planrecalibration"
    )
    op.drop_index(
        op.f("ix_planrecalibration_plan_id"), table_name="planrecalibration"
    )
    op.drop_table("planrecalibration")
