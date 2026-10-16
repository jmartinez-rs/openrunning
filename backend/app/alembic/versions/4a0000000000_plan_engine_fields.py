"""Add engine fields to runningplan.

Adds the algorithmic-engine metadata columns introduced with the V4 engine:
engine_version, baseline and generation_params.

Revision ID: 4a0000000000
Revises: 3a0000000000
Create Date: 2026-10-15
"""

import sqlalchemy as sa
from alembic import op

revision = "4a0000000000"
down_revision = "3a0000000000"
branch_labels = None
depends_on = None


def _existing_columns() -> set[str]:
    """Column names currently present on ``runningplan``."""
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns("runningplan")}


def upgrade() -> None:
    # Idempotent by design: a database created via SQLModel.metadata.create_all
    # (the columns were declared in develop with no migration) already has these
    # columns, and an unconditional op.add_column would raise DuplicateColumn and
    # halt the deploy. Only add what is actually missing.
    existing = _existing_columns()
    if "engine_version" not in existing:
        op.add_column(
            "runningplan",
            sa.Column(
                "engine_version",
                sa.String(length=16),
                nullable=False,
                server_default="v1",
            ),
        )
    if "baseline" not in existing:
        op.add_column(
            "runningplan",
            sa.Column("baseline", sa.JSON(), nullable=True),
        )
    if "generation_params" not in existing:
        op.add_column(
            "runningplan",
            sa.Column("generation_params", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    existing = _existing_columns()
    if "generation_params" in existing:
        op.drop_column("runningplan", "generation_params")
    if "baseline" in existing:
        op.drop_column("runningplan", "baseline")
    if "engine_version" in existing:
        op.drop_column("runningplan", "engine_version")
