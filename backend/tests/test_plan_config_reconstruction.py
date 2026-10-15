"""Unit tests for reconstruct_generator_config (R17 gate config, R24, R26)."""

import datetime as dt
import uuid

import pytest

from app.models import (
    AthleteBaseline,
    BaselineData,
    PlanGeneratorConfig,
    RunningPlan,
)
from app.services.plan_generator import generate_plan_draft_v2
from app.services.plan_validator import reconstruct_generator_config


def _baseline(weekly_km: float = 45.0, vdot: float = 44.0) -> AthleteBaseline:
    return AthleteBaseline(
        weekly_km=BaselineData(value=weekly_km, confidence="measured"),
        longest_run_km=BaselineData(value=weekly_km * 0.4, confidence="measured"),
        vdot=BaselineData(value=vdot, confidence="measured"),
        runs_per_week=BaselineData(value=4.0, confidence="measured"),
    )


def _config(**overrides) -> PlanGeneratorConfig:
    payload = {
        "target_km": 21.1,
        "num_weeks": 12,
        "start_date": dt.date(2026, 10, 12),
        "week_start_day": 1,
        "target_time_seconds": 5700,
        "goal_type": "time",
        "confidence": "measured",
        "conservative_mode": True,
        "baseline": _baseline(),
    }
    payload.update(overrides)
    return PlanGeneratorConfig(**payload)


def _plan_from_draft(draft) -> RunningPlan:
    """Build the persisted plan row the API would store for a generated draft."""
    return RunningPlan(
        name=draft.name,
        goal=draft.goal,
        distance_km=draft.distance_km,
        distance_unit=draft.distance_unit,
        target_time_seconds=draft.target_time_seconds,
        target_pace_seconds_per_km=draft.target_pace_seconds_per_km,
        start_date=draft.start_date,
        end_date=draft.end_date,
        week_start_day=draft.week_start_day,
        engine_version=draft.engine_version,
        baseline=draft.baseline,
        generation_params=draft.generation_params,
        status="active",
        user_id=uuid.uuid4(),
    )


def test_reconstruction_matches_generated_config_on_validator_read_fields():
    config = _config()
    draft = generate_plan_draft_v2(config).draft
    plan = _plan_from_draft(draft)

    reconstructed = reconstruct_generator_config(plan)

    # Fields validate_plan_invariants actually reads (parity contract).
    assert reconstructed.target_km == config.target_km
    assert reconstructed.baseline == config.baseline
    assert reconstructed.target_time_seconds == config.target_time_seconds
    assert reconstructed.conservative_mode == config.conservative_mode
    # Remaining reconstructable fields.
    assert reconstructed.goal_type == config.goal_type
    assert reconstructed.confidence == "measured"
    assert reconstructed.num_weeks == config.num_weeks
    assert reconstructed.start_date == config.start_date
    assert reconstructed.week_start_day == config.week_start_day
    assert reconstructed.race_id == config.race_id
    assert reconstructed.engine_version == "v3"
    assert isinstance(reconstructed.baseline.vdot.value, float)
    assert reconstructed.baseline.vdot.value == 44.0


def test_reconstruction_triangulates_on_a_different_plan():
    config = _config(
        target_km=5.0,
        num_weeks=6,
        goal_type="finish",
        conservative_mode=False,
        target_time_seconds=None,
        baseline=_baseline(weekly_km=12.0, vdot=35.0),
    )
    draft = generate_plan_draft_v2(config).draft
    plan = _plan_from_draft(draft)

    reconstructed = reconstruct_generator_config(plan)

    assert reconstructed.target_km == 5.0
    assert reconstructed.num_weeks == 6
    assert reconstructed.goal_type == "finish"
    assert reconstructed.conservative_mode is False
    assert reconstructed.target_time_seconds is None
    assert reconstructed.baseline.vdot.value == 35.0


def test_reconstruction_clamps_num_weeks_into_config_bounds():
    config = _config()
    draft = generate_plan_draft_v2(config).draft
    plan = _plan_from_draft(draft)
    plan.generation_params = {**(plan.generation_params or {}), "num_weeks": 60}

    assert reconstruct_generator_config(plan).num_weeks == 24


def test_reconstruction_rejects_plan_without_baseline():
    config = _config()
    draft = generate_plan_draft_v2(config).draft
    plan = _plan_from_draft(draft)
    plan.baseline = None

    with pytest.raises(ValueError):
        reconstruct_generator_config(plan)
