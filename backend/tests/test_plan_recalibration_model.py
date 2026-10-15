"""Unit tests for the PlanRecalibration audit model and read schemas (R21, R22, R23)."""

import datetime as dt
import uuid

from app.models import (
    PlanRecalibration,
    PlanRecalibrationPublic,
    PlanRecalibrationsPublic,
)


def _make_recalibration(**overrides) -> PlanRecalibration:
    payload = {
        "plan_id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "source": "manual",
        "old_vdot": 45.0,
        "new_vdot": 47.0,
        "delta_vdot": 2.0,
        "old_paces": {"threshold": 300.0},
        "new_paces": {"threshold": 297.0},
        "kind": "improve",
        "effective_from_week": 3,
        "effective_from_date": dt.date(2026, 10, 12),
    }
    payload.update(overrides)
    return PlanRecalibration(**payload)


def test_table_name_and_primary_key():
    assert PlanRecalibration.__tablename__ == "planrecalibration"
    table = PlanRecalibration.__table__
    assert list(table.primary_key.columns.keys()) == ["id"]


def test_required_columns_are_not_nullable():
    table = PlanRecalibration.__table__
    for column_name in (
        "plan_id",
        "user_id",
        "source",
        "old_vdot",
        "new_vdot",
        "delta_vdot",
        "old_paces",
        "new_paces",
        "kind",
        "effective_from_week",
        "effective_from_date",
    ):
        assert table.c[column_name].nullable is False, column_name


def test_foreign_keys_point_to_plan_and_user_with_cascade():
    table = PlanRecalibration.__table__
    targets = {
        fk.parent.name: (fk.target_fullname, fk.ondelete)
        for fk in table.foreign_keys
    }
    assert targets["plan_id"] == ("runningplan.id", "CASCADE")
    assert targets["user_id"] == ("user.id", "CASCADE")


def test_plan_and_user_columns_are_indexed():
    index_names = {index.name for index in PlanRecalibration.__table__.indexes}
    assert "ix_planrecalibration_plan_id" in index_names
    assert "ix_planrecalibration_user_id" in index_names


def test_defaults_match_audit_contract():
    row = _make_recalibration()
    assert row.source == "manual"
    assert row.source_ref is None
    assert row.suspicious is False
    assert row.affected_workouts == 0
    assert row.affected_blocks == 0
    assert row.applied is True
    assert row.engine_version == "v3"


def test_public_schema_exposes_all_audit_fields():
    row = _make_recalibration(source="activity", suspicious=True)
    public = PlanRecalibrationPublic.model_validate(row)
    assert public.source == "activity"
    assert public.suspicious is True
    assert public.old_vdot == 45.0
    assert public.new_vdot == 47.0
    assert public.delta_vdot == 2.0
    assert public.old_paces == {"threshold": 300.0}
    assert public.new_paces == {"threshold": 297.0}
    assert public.kind == "improve"
    assert public.effective_from_week == 3
    assert public.effective_from_date == dt.date(2026, 10, 12)
    assert public.engine_version == "v3"
    assert public.applied is True
    assert public.id is not None


def test_history_schema_reports_current_vdot_metadata():
    row = _make_recalibration()
    payload = PlanRecalibrationsPublic(
        data=[PlanRecalibrationPublic.model_validate(row)],
        count=1,
        current_vdot=47.0,
        current_vdot_source="manual",
        current_vdot_date=dt.date(2026, 10, 12),
    )
    assert payload.count == 1
    assert payload.data[0].new_vdot == 47.0
    assert payload.current_vdot == 47.0
    assert payload.current_vdot_source == "manual"
    assert payload.current_vdot_date == dt.date(2026, 10, 12)
