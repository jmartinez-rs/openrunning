"""Add planrecalibration audit table.

Stores one append-only row per explicit VDOT recalibration (R22/R23): the
source of the new VDOT, before/after paces, the effective future week and the
derived delta used to flag suspicious or declining recalibrations.

Supported deploy path: a virgin PostgreSQL database provisioned through
``backend/scripts/prestart.sh`` (``python app/backend_pre_start.py`` →
``alembic upgrade head`` → ``python app/initial_data.py``). ``upgrade()`` is
additionally idempotent, so it also survives a database whose schema was first
built by ``SQLModel.metadata.create_all`` (the table and its indexes would
already exist).

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

TABLE_NAME = "planrecalibration"
# (index name, indexed column), in creation order.
INDEXES = (
    ("ix_planrecalibration_plan_id", "plan_id"),
    ("ix_planrecalibration_user_id", "user_id"),
)


def _inspector() -> sa.Inspector:
    """A fresh inspector for the migration's bind.

    Fresh on purpose: the upgrade creates the table and then needs to see which
    of its indexes already exist, so a cached inspector would read stale state.
    """
    return sa.inspect(op.get_bind())


def _existing_indexes() -> set[str]:
    inspector = _inspector()
    if TABLE_NAME not in inspector.get_table_names():
        return set()
    return {index["name"] for index in inspector.get_indexes(TABLE_NAME)}


def upgrade() -> None:
    # Idempotent by design (mirrors 4a0000000000): a database created via
    # SQLModel.metadata.create_all already has the table and indexes, and an
    # unconditional op.create_table would raise "table already exists" and halt
    # the whole deploy. Create only what is missing.
    if TABLE_NAME not in _inspector().get_table_names():
        op.create_table(
            TABLE_NAME,
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

    existing = _existing_indexes()
    for name, column in INDEXES:
        if name not in existing:
            op.create_index(op.f(name), TABLE_NAME, [column], unique=False)


def downgrade() -> None:
    # Drop only what exists, so a downgrade on a partly-migrated database (or one
    # without the table at all) does not raise.
    if TABLE_NAME not in _inspector().get_table_names():
        return
    existing = _existing_indexes()
    for name, _column in reversed(INDEXES):
        if name in existing:
            op.drop_index(op.f(name), table_name=TABLE_NAME)
    op.drop_table(TABLE_NAME)
