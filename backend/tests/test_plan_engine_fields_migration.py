"""Unit tests for the engine-fields Alembic migration idempotency (F-a / BLOCKER).

Migration ``4a0000000000`` must be safe to run against a database where the
``engine_version`` / ``baseline`` / ``generation_params`` columns already exist
(for example a database created via ``SQLModel.metadata.create_all``, because
``develop`` declared those columns with no migration). Unconditional
``op.add_column`` calls raise ``DuplicateColumn`` and halt the whole deploy, so
``upgrade()`` guards every add with an inspector check.
"""

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine

BACKEND_DIR = Path(__file__).resolve().parent.parent
MIGRATION_PATH = (
    BACKEND_DIR / "app" / "alembic" / "versions" / "4a0000000000_plan_engine_fields.py"
)
ENGINE_COLUMNS = {"engine_version", "baseline", "generation_params"}


def _load_migration():
    spec = importlib.util.spec_from_file_location("plan_engine_fields_migration", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _bind_operations(module, conn) -> None:
    context = MigrationContext.configure(conn)
    module.op = Operations(context)  # type: ignore[assignment]


def test_upgrade_is_idempotent_when_run_twice():
    module = _load_migration()

    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        conn.exec_driver_sql("CREATE TABLE runningplan (id CHAR(32) PRIMARY KEY)")
        conn.commit()
        _bind_operations(module, conn)

        module.upgrade()
        conn.commit()
        assert ENGINE_COLUMNS <= {
            column["name"] for column in sa.inspect(conn).get_columns("runningplan")
        }

        # A second run (a re-chained deploy, or a schema that already had them)
        # must not raise DuplicateColumn.
        module.upgrade()
        conn.commit()
        assert ENGINE_COLUMNS <= {
            column["name"] for column in sa.inspect(conn).get_columns("runningplan")
        }


def test_upgrade_is_a_noop_when_columns_already_exist():
    module = _load_migration()

    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        # Simulates a database built by SQLModel.metadata.create_all (the columns
        # already exist, declared in develop with no migration).
        conn.exec_driver_sql(
            "CREATE TABLE runningplan ("
            "id CHAR(32) PRIMARY KEY, "
            "engine_version VARCHAR(16) NOT NULL DEFAULT 'v3', "
            "baseline JSON, "
            "generation_params JSON)"
        )
        conn.exec_driver_sql(
            "INSERT INTO runningplan (id, engine_version) VALUES ('plan-1', 'v3')"
        )
        conn.commit()
        _bind_operations(module, conn)

        module.upgrade()
        conn.commit()

        columns = {column["name"] for column in sa.inspect(conn).get_columns("runningplan")}
        assert ENGINE_COLUMNS <= columns
        # Existing data is preserved untouched.
        row = conn.exec_driver_sql(
            "SELECT engine_version FROM runningplan WHERE id = 'plan-1'"
        ).one()
        assert row[0] == "v3"


def test_downgrade_drops_the_engine_columns():
    module = _load_migration()

    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        conn.exec_driver_sql("CREATE TABLE runningplan (id CHAR(32) PRIMARY KEY)")
        conn.commit()
        _bind_operations(module, conn)

        module.upgrade()
        conn.commit()
        module.downgrade()
        conn.commit()

        columns = {column["name"] for column in sa.inspect(conn).get_columns("runningplan")}
        assert ENGINE_COLUMNS.isdisjoint(columns)
