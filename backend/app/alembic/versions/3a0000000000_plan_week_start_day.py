"""Add week_start_day to runningplan.

Revision ID: 3a0000000000
Revises: 2a0000000000
Create Date: 2026-10-05
"""

from alembic import op
import sqlalchemy as sa

revision = "3a0000000000"
down_revision = "2a0000000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "runningplan",
        sa.Column(
            "week_start_day",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    # Backfill legacy plans: use the ISO weekday (1=Monday ... 7=Sunday) of the
    # earliest week with a start_date, falling back to the plan start_date.
    op.execute(
        """
        UPDATE runningplan p
        SET week_start_day = EXTRACT(ISODOW FROM COALESCE(
            (SELECT MIN(w.start_date)
             FROM runningweek w
             JOIN runningphase ph ON w.phase_id = ph.id
             WHERE ph.plan_id = p.id AND w.start_date IS NOT NULL),
            p.start_date))
        """
    )


def downgrade() -> None:
    op.drop_column("runningplan", "week_start_day")
