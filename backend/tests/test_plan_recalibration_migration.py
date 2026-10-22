"""Unit tests for the planrecalibration Alembic migration (R22, R23).

Also covers idempotency (G2): a database first built by
``SQLModel.metadata.create_all`` already has the ``planrecalibration`` table and
its indexes, so ``upgrade()`` must create only what is missing and
``downgrade()`` must drop only what exists.
"""

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlmodel import SQLModel

import app.models  # noqa: F401  # registers every table on SQLModel.metadata

BACKEND_DIR = Path(__file__).resolve().parent.parent
VERSIONS_DIR = BACKEND_DIR / "app" / "alembic" / "versions"
MIGRATION_PATH = VERSIONS_DIR / "5a0000000000_plan_recalibration.py"
REVISION = "5a0000000000"
DOWN_REVISION = "4a0000000000"
TABLE = "planrecalibration"
INDEX_NAMES = {
    "ix_planrecalibration_plan_id",
    "ix_planrecalibration_user_id",
}


def _load_migration():
    spec = importlib.util.spec_from_file_location("plan_recalibration_migration", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _script_directory() -> ScriptDirectory:
    config = Config()
    config.set_main_option("script_location", str(BACKEND_DIR / "app" / "alembic"))
    return ScriptDirectory.from_config(config)


def _bind_operations(module, conn) -> None:
    context = MigrationContext.configure(conn)
    module.op = Operations(context)  # type: ignore[assignment]



def test_migration_revision_metadata():
    module = _load_migration()
    assert module.revision == REVISION
    assert module.down_revision == DOWN_REVISION


def test_revision_is_the_only_head():
    script = _script_directory()
    assert script.get_revision(REVISION) is not None
    assert script.get_revision(REVISION).down_revision == DOWN_REVISION


def test_upgrade_creates_table_indexes_and_downgrade_reverses():
    module = _load_migration()

    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        conn.exec_driver_sql("CREATE TABLE user (id CHAR(32) PRIMARY KEY)")
        conn.exec_driver_sql("CREATE TABLE runningplan (id CHAR(32) PRIMARY KEY)")
        conn.commit()

        context = MigrationContext.configure(conn)
        module.op = Operations(context)  # type: ignore[assignment]

        module.upgrade()
        conn.commit()

        inspector = sa.inspect(conn)
        assert "planrecalibration" in inspector.get_table_names()
        columns = {column["name"] for column in inspector.get_columns("planrecalibration")}
        assert {
            "id",
            "plan_id",
            "user_id",
            "source",
            "source_ref",
            "old_vdot",
            "new_vdot",
            "delta_vdot",
            "old_paces",
            "new_paces",
            "kind",
            "suspicious",
            "effective_from_week",
            "effective_from_date",
            "affected_workouts",
            "affected_blocks",
            "engine_version",
            "applied",
            "created_at",
        } == columns
        index_names = {index["name"] for index in inspector.get_indexes("planrecalibration")}
        assert "ix_planrecalibration_plan_id" in index_names
        assert "ix_planrecalibration_user_id" in index_names

        module.downgrade()
        conn.commit()
        assert "planrecalibration" not in sa.inspect(conn).get_table_names()


def test_upgrade_is_idempotent_when_the_table_already_exists():
    """A DB built by ``SQLModel.metadata.create_all`` must not halt the deploy."""
    module = _load_migration()

    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        # Reproduces a database whose schema came from the ORM metadata: the table
        # AND both indexes already exist before alembic upgrade head runs.
        SQLModel.metadata.create_all(conn)
        inspector = sa.inspect(conn)
        assert TABLE in inspector.get_table_names()
        assert INDEX_NAMES <= {
            index["name"] for index in inspector.get_indexes(TABLE)
        }
        conn.commit()
        _bind_operations(module, conn)

        module.upgrade()  # must not raise "table already exists"
        conn.commit()

        inspector = sa.inspect(conn)
        assert TABLE in inspector.get_table_names()
        assert INDEX_NAMES <= {
            index["name"] for index in inspector.get_indexes(TABLE)
        }


def test_upgrade_preserves_existing_table_data():
    module = _load_migration()

    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        SQLModel.metadata.create_all(conn)
        conn.exec_driver_sql(
            "INSERT INTO planrecalibration ("
            "id, plan_id, user_id, source, old_vdot, new_vdot, delta_vdot, "
            "old_paces, new_paces, kind, suspicious, effective_from_week, "
            "effective_from_date, affected_workouts, affected_blocks, "
            "engine_version, applied, created_at"
            ") VALUES ('row-1', 'plan-1', 'user-1', 'manual', 45.0, 47.0, 2.0, "
            "'{}', '{}', 'improve', 0, 2, '2026-10-20', 3, 2, 'v3', 1, "
            "'2026-10-15 12:00:00')"
        )
        conn.commit()
        _bind_operations(module, conn)

        module.upgrade()
        conn.commit()

        row = conn.exec_driver_sql(
            "SELECT new_vdot FROM planrecalibration WHERE id = 'row-1'"
        ).one()
        assert row[0] == 47.0


def test_downgrade_is_a_noop_when_the_table_is_absent():
    module = _load_migration()

    engine = create_engine("sqlite://")
    with engine.connect() as conn:
        conn.exec_driver_sql("CREATE TABLE runningplan (id CHAR(32) PRIMARY KEY)")
        conn.commit()
        _bind_operations(module, conn)

        module.downgrade()  # must not raise

        conn.commit()
        assert TABLE not in sa.inspect(conn).get_table_names()

