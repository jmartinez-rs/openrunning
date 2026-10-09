import pytest

from app.models import AthleteBaseline, BaselineData, PlanGeneratorConfig
from app.services.plan_generator import generate_plan_draft_v2
from app.services.running_math import get_training_paces_seconds
from app.services.workout_library import build_daniels_blocks_with_ranges


def test_build_daniels_blocks_with_ranges():
    paces = get_training_paces_seconds(40.0)

    # Easy run blocks
    easy_blocks = build_daniels_blocks_with_ranges(
        workout_type="easy_run",
        total_km=10.0,
        vdot=40.0,
        paces=paces,
    )
    assert len(easy_blocks) == 1
    assert easy_blocks[0].pace_seconds_per_km == paces["easy_min"]
    assert easy_blocks[0].pace_range_end_seconds_per_km == paces["easy_max"]

    # Tempo blocks
    tempo_blocks = build_daniels_blocks_with_ranges(
        workout_type="tempo",
        total_km=8.0,
        vdot=40.0,
        paces=paces,
        progression_level=1,
    )
    assert len(tempo_blocks) == 3 # Warmup, Tempo main, Cooldown
    tempo_main = tempo_blocks[1]
    assert tempo_main.pace_seconds_per_km is not None
    assert tempo_main.pace_range_end_seconds_per_km is not None
    assert tempo_main.pace_range_end_seconds_per_km > tempo_main.pace_seconds_per_km


def test_strides_in_phase_1():
    baseline = AthleteBaseline(
        weekly_km=BaselineData(value=30.0, confidence="measured"), # type: ignore[arg-type]
        longest_run_km=BaselineData(value=10.0, confidence="measured"), # type: ignore[arg-type]
        vdot=BaselineData(value=38.0, confidence="measured"), # type: ignore[arg-type]
        runs_per_week=BaselineData(value=4.0, confidence="measured"), # type: ignore[arg-type]
    )
    cfg = PlanGeneratorConfig(
        target_km=10.0,
        num_weeks=8,
        start_date=__import__("datetime").date(2026, 10, 12),
        baseline=baseline,
    )
    res = generate_plan_draft_v2(cfg)

    # Check Phase 1 workouts
    phase_1 = res.draft.phases[0]
    strides_workouts = []
    for week in phase_1.weeks:
        for w in week.workouts:
            if "Strides" in (w.name or ""):
                strides_workouts.append(w)

    assert len(strides_workouts) > 0
    strides_block = [b for b in strides_workouts[0].blocks if b.block_type == "strides"]
    assert len(strides_block) == 1
    assert strides_block[0].repeats == 4
