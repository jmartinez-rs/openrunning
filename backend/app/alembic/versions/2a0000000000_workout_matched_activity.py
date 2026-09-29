"""Add matched_activity_id to runningworkout.

Revision ID: 2a0000000000
Revises: 1a0000000000
Create Date: 2026-09-29
"""

from alembic import op
import sqlalchemy as sa

revision = "2a0000000000"
down_revision = "1a0000000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "runningworkout",
        sa.Column("matched_activity_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_runningworkout_matched_activity_id"),
        "runningworkout",
        ["matched_activity_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_runningworkout_matched_activity_id_activity",
        "runningworkout",
        "activity",
        ["matched_activity_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_runningworkout_matched_activity_id_activity",
        "runningworkout",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_runningworkout_matched_activity_id"),
        table_name="runningworkout",
    )
    op.drop_column("runningworkout", "matched_activity_id")