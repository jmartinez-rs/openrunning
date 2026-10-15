"""Add engine fields to runningplan.

Adds the algorithmic-engine metadata columns introduced with the V4 engine:
engine_version, baseline and generation_params.

Revision ID: 4a0000000000
Revises: 3a0000000000
Create Date: 2026-10-15
"""

from alembic import op
import sqlalchemy as sa

revision = "4a0000000000"
down_revision = "3a0000000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "runningplan",
        sa.Column(
            "engine_version",
            sa.String(length=16),
            nullable=False,
            server_default="v1",
        ),
    )
    op.add_column(
        "runningplan",
        sa.Column("baseline", sa.JSON(), nullable=True),
    )
    op.add_column(
        "runningplan",
        sa.Column("generation_params", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("runningplan", "generation_params")
    op.drop_column("runningplan", "baseline")
    op.drop_column("runningplan", "engine_version")
