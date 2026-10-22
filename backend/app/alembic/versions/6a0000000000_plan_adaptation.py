"""Add planadaptation audit table.

Stores one append-only row per applied adaptation rule (R1-R5):
low adherence, missed long run, high perceived effort, under-stimulation,
and injury/fatigue recovery adjustments.

Revision ID: 6a0000000000
Revises: 5a0000000000
Create Date: 2026-10-22
"""

import sqlalchemy as sa
from alembic import op

revision = "6a0000000000"
down_revision = "5a0000000000"
branch_labels = None
depends_on = None

TABLE_NAME = "planadaptation"
INDEXES = (
    ("ix_planadaptation_plan_id", "plan_id"),
    ("ix_planadaptation_user_id", "user_id"),
)


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _existing_indexes() -> set[str]:
    inspector = _inspector()
    if TABLE_NAME not in inspector.get_table_names():
        return set()
    return {index["name"] for index in inspector.get_indexes(TABLE_NAME)}


def upgrade() -> None:
    if TABLE_NAME not in _inspector().get_table_names():
        op.create_table(
            TABLE_NAME,
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("plan_id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("rule_code", sa.String(length=64), nullable=False),
            sa.Column("reason", sa.String(length=1000), nullable=False),
            sa.Column("before_summary", sa.String(length=1000), nullable=True),
            sa.Column("after_summary", sa.String(length=1000), nullable=True),
            sa.Column("changes_json", sa.JSON(), nullable=True),
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
    if TABLE_NAME not in _inspector().get_table_names():
        return
    existing = _existing_indexes()
    for name, _column in reversed(INDEXES):
        if name in existing:
            op.drop_index(op.f(name), table_name=TABLE_NAME)
    op.drop_table(TABLE_NAME)
