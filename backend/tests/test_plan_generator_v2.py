import datetime as dt
import pytest

from app.models import (
    AthleteBaseline,
    BaselineData,
    PlanGeneratorConfig,
)
from app.services.plan_generator import generate_plan_draft_v2, generate_volume_curve
from app.services.plan_validator import validate_plan_invariants


def create_sample_baseline(weekly_km: float = 30.0, vdot: float = 40.0, confidence: str = "measured") -> AthleteBaseline:
    return AthleteBaseline(
        weekly_km=BaselineData(value=weekly_km, confidence=confidence), # type: ignore[arg-type]
        longest_run_km=BaselineData(value=weekly_km * 0.4, confidence=confidence), # type: ignore[arg-type]
        vdot=BaselineData(value=vdot, confidence=confidence), # type: ignore[arg-type]
        runs_per_week=BaselineData(value=4.0, confidence=confidence), # type: ignore[arg-type]
    )


def test_volume_curve_cutback_and_taper():
    # 12-week 21.1K plan
    curve = generate_volume_curve(
        start_km=30.0,
        target_km=21.1,
        num_weeks=12,
        confidence="measured",
        conservative_mode=False,
    )
    assert len(curve) == 12

    # Week 4 should be a cutback week (lower than week 3)
    assert curve[3] < curve[2]

    # Last 2 weeks should taper (decreasing volume)
    assert curve[11] < curve[10]
    assert curve[10] < curve[9]


def test_confidence_and_conservative_mode_adjustment():
    baseline_meas = create_sample_baseline(weekly_km=40.0, confidence="measured")
    baseline_est = create_sample_baseline(weekly_km=40.0, confidence="estimated")

    cfg_meas = PlanGeneratorConfig(
        target_km=10.0,
        num_weeks=8,
        start_date=dt.date(2026, 10, 12),
        baseline=baseline_meas,
        confidence="measured",
    )
    cfg_est = PlanGeneratorConfig(
        target_km=10.0,
        num_weeks=8,
        start_date=dt.date(2026, 10, 12),
        baseline=baseline_est,
        confidence="estimated",
    )
    cfg_cons = PlanGeneratorConfig(
        target_km=10.0,
        num_weeks=8,
        start_date=dt.date(2026, 10, 12),
        baseline=baseline_meas,
        confidence="measured",
        conservative_mode=True,
    )

    res_meas = generate_plan_draft_v2(cfg_meas)
    res_est = generate_plan_draft_v2(cfg_est)
    res_cons = generate_plan_draft_v2(cfg_cons)

    start_vol_meas = res_meas.meta["confidence_summary"]["start_weekly_km"]
    start_vol_est = res_est.meta["confidence_summary"]["start_weekly_km"]
    start_vol_cons = res_cons.meta["confidence_summary"]["start_weekly_km"]

    # Estimated and conservative mode should start lower
    assert start_vol_est < start_vol_meas
    assert start_vol_cons < start_vol_meas


@pytest.mark.parametrize(
    "target_km,num_weeks,weekly_km,vdot",
    [
        (5.0, 6, 20.0, 32.0),
        (10.0, 8, 30.0, 38.0),
        (21.1, 12, 40.0, 45.0),
        (42.2, 16, 60.0, 50.0),
    ],
)
def test_all_profiles_pass_invariants(target_km, num_weeks, weekly_km, vdot):
    baseline = create_sample_baseline(weekly_km=weekly_km, vdot=vdot)
    config = PlanGeneratorConfig(
        target_km=target_km,
        num_weeks=num_weeks,
        start_date=dt.date(2026, 10, 12),
        week_start_day=1,
        selected_days=[1, 3, 5, 7],
        long_run_day=7,
        baseline=baseline,
    )

    res = generate_plan_draft_v2(config)
    errors = [w for w in res.warnings if w.severity == "error"]

    # No blocking error severity issues should exist
    assert len(errors) == 0

    # Verify dates uniqueness
    dates = []
    for phase in res.draft.phases:
        for week in phase.weeks:
            for workout in week.workouts:
                dates.append(workout.date)

    assert len(dates) == len(set(dates))


def test_goal_gap_warning():
    baseline = create_sample_baseline(weekly_km=25.0, vdot=35.0)
    config = PlanGeneratorConfig(
        goal_type="time",
        target_km=10.0,
        target_time_seconds=2100, # 35:00 for 10K (unrealistic for VDOT 35)
        num_weeks=10,
        start_date=dt.date(2026, 10, 12),
        baseline=baseline,
    )

    res = generate_plan_draft_v2(config)
    gap_warnings = [w for w in res.warnings if w.code == "GOAL_GAP_HIGH"]

    assert len(gap_warnings) > 0
    assert gap_warnings[0].severity == "warning"
