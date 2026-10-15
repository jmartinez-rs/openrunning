"""Unit tests for the planrecalibration Alembic migration (R22, R23)."""

import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

BACKEND_DIR = Path(__file__).resolve().parent.parent
VERSIONS_DIR = BACKEND_DIR / "app" / "alembic" / "versions"
MIGRATION_PATH = VERSIONS_DIR / "5a0000000000_plan_recalibration.py"
REVISION = "5a0000000000"
DOWN_REVISION = "4a0000000000"


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


def test_migration_revision_metadata():
    module = _load_migration()
    assert module.revision == REVISION
    assert module.down_revision == DOWN_REVISION


def test_revision_is_the_only_head():
    script = _script_directory()
    assert script.get_heads() == [REVISION]
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
