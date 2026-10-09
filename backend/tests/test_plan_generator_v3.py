import datetime as dt
import pytest

from app.models import AthleteBaseline, BaselineData, PlanGeneratorConfig
from app.services.plan_generator import generate_plan_draft_v2, get_phase_splits_for_distance


def create_sample_baseline(weekly_km: float = 35.0, vdot: float = 40.0) -> AthleteBaseline:
    return AthleteBaseline(
        weekly_km=BaselineData(value=weekly_km, confidence="measured"), # type: ignore[arg-type]
        longest_run_km=BaselineData(value=weekly_km * 0.4, confidence="measured"), # type: ignore[arg-type]
        vdot=BaselineData(value=vdot, confidence="measured"), # type: ignore[arg-type]
        runs_per_week=BaselineData(value=4.0, confidence="measured"), # type: ignore[arg-type]
    )


def test_distance_tailored_phase_splits():
    splits_5k = get_phase_splits_for_distance(5.0, 8)
    splits_marathon = get_phase_splits_for_distance(42.2, 16)

    # 5K phase 2 should focus on VO2max
    assert "VO2máx" in splits_5k[1][1]
    # Marathon phase 2 should focus on Marathon Specific Build
    assert "Maratón" in splits_marathon[1][1]


def test_weekly_template_3_vs_5_days():
    baseline = create_sample_baseline(weekly_km=30.0, vdot=38.0)

    # 3 days per week
    cfg_3 = PlanGeneratorConfig(
        target_km=10.0,
        num_weeks=8,
        start_date=dt.date(2026, 10, 12),
        selected_days=[1, 3, 7], # Mon, Wed, Sun
        long_run_day=7,
        baseline=baseline,
    )
    res_3 = generate_plan_draft_v2(cfg_3)
    week1_workouts = res_3.draft.phases[0].weeks[0].workouts
    assert len(week1_workouts) == 3

    # 5 days per week
    cfg_5 = PlanGeneratorConfig(
        target_km=21.1,
        num_weeks=12,
        start_date=dt.date(2026, 10, 12),
        selected_days=[1, 2, 4, 5, 7],
        long_run_day=7,
        baseline=baseline,
    )
    res_5 = generate_plan_draft_v2(cfg_5)
    week1_workouts_5 = res_5.draft.phases[0].weeks[0].workouts
    assert len(week1_workouts_5) == 5

    # Count quality sessions in 5-day week
    quality_count = sum(1 for w in week1_workouts_5 if w.type in ["tempo", "intervals"])
    assert quality_count == 2


def test_tuneup_race_placement_in_hm_and_marathon():
    baseline_hm = create_sample_baseline(weekly_km=40.0, vdot=42.0)
    cfg_hm = PlanGeneratorConfig(
        target_km=21.1,
        num_weeks=12,
        start_date=dt.date(2026, 10, 12),
        baseline=baseline_hm,
    )
    res_hm = generate_plan_draft_v2(cfg_hm)

    # Find Tune-up workout in HM plan
    all_workouts = []
    for phase in res_hm.draft.phases:
        for week in phase.weeks:
            for w in week.workouts:
                all_workouts.append(w)

    tuneup = [w for w in all_workouts if w.type == "test" and "10K" in w.name]
    assert len(tuneup) == 1
    assert tuneup[0].distance_km == 10.0

    # Marathon tuneup
    baseline_m = create_sample_baseline(weekly_km=60.0, vdot=48.0)
    cfg_m = PlanGeneratorConfig(
        target_km=42.2,
        num_weeks=16,
        start_date=dt.date(2026, 10, 12),
        baseline=baseline_m,
    )
    res_m = generate_plan_draft_v2(cfg_m)

    m_all_workouts = []
    for phase in res_m.draft.phases:
        for week in phase.weeks:
            for w in week.workouts:
                m_all_workouts.append(w)

    tuneup_m = [w for w in m_all_workouts if w.type == "test" and "21.1K" in w.name]
    assert len(tuneup_m) == 1
    assert tuneup_m[0].distance_km == 21.1


def test_specific_phase_long_run_race_pace_blocks():
    baseline = create_sample_baseline(weekly_km=45.0, vdot=44.0)
    cfg = PlanGeneratorConfig(
        target_km=21.1,
        num_weeks=12,
        start_date=dt.date(2026, 10, 12),
        baseline=baseline,
    )
    res = generate_plan_draft_v2(cfg)

    # Phase 3 (Específico) workouts
    phase_3 = res.draft.phases[2]
    long_runs_p3 = []
    for week in phase_3.weeks:
        for w in week.workouts:
            if w.type == "long_run":
                long_runs_p3.append(w)

    # At least one long run in phase 3 should have race pace blocks
    block_workout = [w for w in long_runs_p3 if len(w.blocks) >= 3]
    assert len(block_workout) > 0
