"""Unit tests for pace rules, effective week and recalibration preview (R7-R9, R12, R14, R24-R26)."""

import datetime as dt
import uuid

from app.models import (
    AthleteBaseline,
    BaselineData,
    PlanValidationIssue,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    WorkoutBlock,
)
from app.services.fitness import (
    PlanSnapshot,
    apply_recalibration,
    block_paces_for,
    plan_to_create,
    recalibration_preview,
    resolve_effective_from_week,
    workout_pace_for,
)
from app.services.plan_validator import (
    reconstruct_generator_config,
    validate_plan_invariants,
)
from app.services.running_math import get_training_paces_seconds

TODAY = dt.date(2026, 10, 7)  # Wednesday inside week 1
WEEK_1_START = dt.date(2026, 10, 5)


def _baseline(vdot: float = 45.0) -> AthleteBaseline:
    return AthleteBaseline(
        weekly_km=BaselineData(value=40.0, confidence="measured"),
        longest_run_km=BaselineData(value=16.0, confidence="measured"),
        vdot=BaselineData(value=vdot, confidence="measured"),
        runs_per_week=BaselineData(value=4.0, confidence="measured"),
    )


def _plan() -> RunningPlan:
    return RunningPlan(
        name="Plan 21.1K",
        distance_km=21.1,
        target_time_seconds=5700,
        start_date=WEEK_1_START,
        week_start_day=1,
        status="active",
        user_id=uuid.uuid4(),
        engine_version="v3",
        baseline=_baseline().model_dump(),
        generation_params={
            "goal_type": "time",
            "confidence": "measured",
            "conservative_mode": False,
            "target_km": 21.1,
            "num_weeks": 4,
        },
    )


def _block(
    workout_id: uuid.UUID,
    position: int,
    block_type: str,
    *,
    repeats: int = 1,
    distance_m: float | None = None,
    pace: float | None = None,
    pace_range: float | None = None,
) -> WorkoutBlock:
    return WorkoutBlock(
        workout_id=workout_id,
        position=position,
        block_type=block_type,
        repeats=repeats,
        distance_m=distance_m,
        pace_seconds_per_km=pace,
        pace_range_end_seconds_per_km=pace_range,
    )


def _workout(
    plan: RunningPlan, week: RunningWeek, day: dt.date, workout_type: str, pace: float | None
) -> RunningWorkout:
    return RunningWorkout(
        week_id=week.id,
        plan_id=plan.id,
        date=day,
        type=workout_type,
        intensity="moderate",
        distance_km=10.0,
        pace_seconds_per_km=pace,
    )


def _snapshot() -> tuple[PlanSnapshot, RunningWorkout]:
    plan = _plan()
    phase = RunningPhase(
        plan_id=plan.id, position=1, name="Base", start_week=1, end_week=4
    )
    weeks = [
        RunningWeek(
            phase_id=phase.id,
            number=number,
            start_date=WEEK_1_START + dt.timedelta(days=7 * (number - 1)),
            end_date=WEEK_1_START + dt.timedelta(days=7 * (number - 1) + 6),
        )
        for number in range(1, 5)
    ]
    paces = get_training_paces_seconds(45.0)
    blocks: dict[uuid.UUID, list[WorkoutBlock]] = {}
    workouts: list[RunningWorkout] = []

    def add(
        week: RunningWeek, day: dt.date, workout_type: str, pace: float | None, block_specs
    ) -> RunningWorkout:
        workout = _workout(plan, week, day, workout_type, pace)
        workouts.append(workout)
        blocks[workout.id] = [
            _block(workout.id, index + 1, spec[0], **spec[1])
            for index, spec in enumerate(block_specs)
        ]
        return workout

    warmup = ("warmup", {"distance_m": 2000, "pace": paces["easy_min"], "pace_range": paces["easy_max"]})
    cooldown = ("cooldown", {"distance_m": 1500, "pace": paces["easy_min"], "pace_range": paces["easy_max"]})

    # Week 1 — elapsed, must never be rewritten.
    add(weeks[0], dt.date(2026, 10, 6), "tempo", paces["threshold"], [
        warmup,
        ("main", {"distance_m": 8000, "pace": round(paces["threshold"] - 4, 1), "pace_range": round(paces["threshold"] + 4, 1)}),
        cooldown,
    ])
    # Week 2 — first future week, continuous tempo.
    add(weeks[1], dt.date(2026, 10, 14), "tempo", paces["threshold"], [
        warmup,
        ("main", {"distance_m": 8000, "pace": round(paces["threshold"] - 4, 1), "pace_range": round(paces["threshold"] + 4, 1)}),
        cooldown,
    ])
    # Week 3 — long run with 3 blocks + cruise tempo + VO2max intervals.
    add(weeks[2], dt.date(2026, 10, 19), "long_run", paces["easy_min"], [
        warmup,
        ("main", {"distance_m": 6000, "pace": round(paces["threshold"], 1)}),
        cooldown,
    ])
    add(weeks[2], dt.date(2026, 10, 20), "tempo", paces["threshold"], [
        warmup,
        ("main", {"repeats": 3, "distance_m": 2000, "pace": round(paces["threshold"] - 3, 1), "pace_range": round(paces["threshold"] + 3, 1)}),
        cooldown,
    ])
    add(weeks[2], dt.date(2026, 10, 21), "intervals", paces["interval"], [
        warmup,
        ("interval", {"repeats": 4, "distance_m": 1000, "pace": round(paces["interval"] - 3, 1), "pace_range": round(paces["interval"] + 3, 1)}),
        cooldown,
    ])
    # Week 4 — race keeps its stored pace; short repetitions follow the R rule.
    race = add(weeks[3], dt.date(2026, 10, 26), "race", 270.0, [
        ("main", {"distance_m": 21100, "pace": 270.0}),
    ])
    add(weeks[3], dt.date(2026, 10, 28), "intervals", paces["interval"], [
        warmup,
        ("interval", {"repeats": 8, "distance_m": 400, "pace": round(paces["repetition"] - 2, 1), "pace_range": round(paces["repetition"] + 2, 1)}),
        cooldown,
    ])
    add(weeks[3], dt.date(2026, 10, 29), "easy_run", paces["easy_min"], [
        ("main", {"distance_m": 12000, "pace": paces["easy_min"], "pace_range": paces["easy_max"]}),
    ])

    return PlanSnapshot(
        plan=plan,
        phases=[phase],
        weeks=weeks,
        workouts=workouts,
        blocks=blocks,
    ), race


def test_effective_week_is_the_first_week_strictly_after_today():
    plan = _plan()
    weeks = [
        RunningWeek(
            phase_id=uuid.uuid4(),
            number=number,
            start_date=WEEK_1_START + dt.timedelta(days=7 * (number - 1)),
        )
        for number in range(1, 5)
    ]

    assert resolve_effective_from_week(
        weeks, week_start_day=1, plan_start_date=plan.start_date, today_local=TODAY
    ) == (2, dt.date(2026, 10, 12))


def test_effective_week_never_rewrites_the_current_week_on_a_week_start_day():
    plan = _plan()
    weeks = [
        RunningWeek(
            phase_id=uuid.uuid4(),
            number=number,
            start_date=WEEK_1_START + dt.timedelta(days=7 * (number - 1)),
        )
        for number in range(1, 5)
    ]

    assert resolve_effective_from_week(
        weeks, week_start_day=1, plan_start_date=plan.start_date, today_local=WEEK_1_START
    ) == (2, dt.date(2026, 10, 12))


def test_effective_week_uses_week_start_day_when_dates_are_missing():
    weeks = [RunningWeek(phase_id=uuid.uuid4(), number=number) for number in range(1, 4)]

    assert resolve_effective_from_week(
        weeks, week_start_day=1, plan_start_date=WEEK_1_START, today_local=TODAY
    ) == (2, dt.date(2026, 10, 12))


def test_effective_week_is_none_when_no_future_week_remains():
    plan = _plan()
    weeks = [
        RunningWeek(
            phase_id=uuid.uuid4(),
            number=number,
            start_date=WEEK_1_START + dt.timedelta(days=7 * (number - 1)),
        )
        for number in range(1, 5)
    ]

    assert (
        resolve_effective_from_week(
            weeks,
            week_start_day=1,
            plan_start_date=plan.start_date,
            today_local=dt.date(2026, 12, 1),
        )
        is None
    )


def test_workout_level_pace_uses_the_training_pace_table():
    paces = get_training_paces_seconds(45.0)

    assert workout_pace_for("easy_run", paces, 999.0) == paces["easy_min"]
    assert workout_pace_for("long_run", paces, 999.0) == paces["easy_min"]
    assert workout_pace_for("tempo", paces, 999.0) == paces["threshold"]
    assert workout_pace_for("intervals", paces, 999.0) == paces["interval"]
    assert workout_pace_for("test", paces, 999.0) == paces["threshold"]
    assert workout_pace_for("race", paces, 270.0) == 270.0


def test_block_paces_follow_the_generator_rule_table():
    paces = get_training_paces_seconds(45.0)

    def resolve(workout_type: str, block_type: str, **overrides):
        options = {
            "block_count": 3,
            "paces": paces,
            "target_km": 21.1,
            "progression_level": 1,
            "total_km": 12.0,
            "current_pace": 1.0,
            "current_range": 2.0,
        }
        options.update(overrides)
        return block_paces_for(workout_type, block_type=block_type, **options)

    # Easy segments of tempo/interval sessions keep the full easy range.
    assert resolve("tempo", "warmup") == (paces["easy_min"], paces["easy_max"])
    assert resolve("tempo", "cooldown") == (paces["easy_min"], paces["easy_max"])
    # Continuous tempo (phase 1 or low volume) vs cruise intervals (phase 2+).
    assert resolve("tempo", "main", progression_level=1) == (
        round(paces["threshold"] - 4, 1),
        round(paces["threshold"] + 4, 1),
    )
    assert resolve("tempo", "main", progression_level=2) == (
        round(paces["threshold"] - 3, 1),
        round(paces["threshold"] + 3, 1),
    )
    assert resolve("tempo", "main", progression_level=2, total_km=6.0) == (
        round(paces["threshold"] - 4, 1),
        round(paces["threshold"] + 4, 1),
    )
    # Interval vs repetition follows the generator rule, not the rep distance.
    assert resolve("intervals", "interval", progression_level=3) == (
        round(paces["interval"] - 3, 1),
        round(paces["interval"] + 3, 1),
    )
    assert resolve("intervals", "interval", progression_level=1, total_km=6.0) == (
        round(paces["repetition"] - 2, 1),
        round(paces["repetition"] + 2, 1),
    )
    assert resolve("repetition", "interval", progression_level=2) == (
        round(paces["repetition"] - 2, 1),
        round(paces["repetition"] + 2, 1),
    )
    # Long-run goal-pace block: marathon for 42.2K, threshold otherwise.
    assert resolve("long_run", "main") == (paces["threshold"], None)
    assert resolve("long_run", "main", target_km=42.2) == (paces["marathon"], None)
    # A single-block long run stays easy; its warmup/cooldown have no range.
    assert resolve("long_run", "main", block_count=1) == (paces["easy_min"], None)
    assert resolve("long_run", "warmup") == (paces["easy_min"], None)
    assert resolve("long_run", "cooldown") == (paces["easy_max"], None)
    # The tune-up runs its easy segments at a single pace, never a range.
    assert resolve("test", "warmup") == (paces["easy_max"], None)
    assert resolve("test", "cooldown") == (paces["easy_max"], None)
    assert resolve("test", "main") == (paces["threshold"], None)
    # Strides carry the repetition pace with no range.
    assert resolve("easy_run", "strides") == (paces["repetition"], None)
    # Race keeps its stored pace (D6).
    assert resolve("race", "main", current_pace=270.0, current_range=None) == (270.0, None)


def test_preview_reports_only_future_weeks_and_new_paces():
    snapshot, race = _snapshot()
    effective_from = (2, dt.date(2026, 10, 12))

    preview = recalibration_preview(
        snapshot,
        current_vdot=45.0,
        new_vdot=47.0,
        source="activity",
        evidence={"source_id": "abc"},
        effective_from=effective_from,
    )

    assert preview.old_paces == get_training_paces_seconds(45.0)
    assert preview.new_paces == get_training_paces_seconds(47.0)
    assert (preview.kind, preview.delta_vdot, preview.suspicious) == ("improve", 2.0, False)
    assert preview.effective_from_week == 2
    assert preview.effective_from_date == dt.date(2026, 10, 12)
    assert preview.affected_weeks == [2, 3, 4]
    assert preview.source == "activity"
    assert preview.evidence == {"source_id": "abc"}
    assert preview.changes, "future sessions must be reported as changes"
    assert all(change.date >= dt.date(2026, 10, 12) for change in preview.changes)
    assert race.id not in {change.workout_id for change in preview.changes}
    pace_by_workout = {change.workout_id: change.new_pace for change in preview.changes}
    tempo = next(w for w in snapshot.workouts if w.date == dt.date(2026, 10, 14))
    long_run = next(w for w in snapshot.workouts if w.date == dt.date(2026, 10, 19))
    assert pace_by_workout[tempo.id] == preview.new_paces["threshold"]
    assert pace_by_workout[long_run.id] == preview.new_paces["easy_min"]


def test_preview_flags_decline_and_suspicious_jumps():
    snapshot, _ = _snapshot()
    effective_from = (2, dt.date(2026, 10, 12))

    decline = recalibration_preview(
        snapshot,
        current_vdot=45.0,
        new_vdot=43.0,
        source="test",
        evidence={},
        effective_from=effective_from,
    )
    jump = recalibration_preview(
        snapshot,
        current_vdot=45.0,
        new_vdot=48.0,
        source="test",
        evidence={},
        effective_from=effective_from,
    )

    assert (decline.kind, decline.delta_vdot, decline.suspicious) == ("decline", -2.0, False)
    assert (jump.kind, jump.delta_vdot, jump.suspicious) == ("improve", 3.0, True)


def test_preview_is_read_only_and_idempotent():
    snapshot, _ = _snapshot()
    effective_from = (2, dt.date(2026, 10, 12))
    before_workouts = {w.id: w.pace_seconds_per_km for w in snapshot.workouts}
    before_blocks = {
        block.id: (block.pace_seconds_per_km, block.pace_range_end_seconds_per_km)
        for blocks in snapshot.blocks.values()
        for block in blocks
    }

    first = recalibration_preview(
        snapshot,
        current_vdot=45.0,
        new_vdot=47.0,
        source="activity",
        evidence={},
        effective_from=effective_from,
    )
    second = recalibration_preview(
        snapshot,
        current_vdot=45.0,
        new_vdot=47.0,
        source="activity",
        evidence={},
        effective_from=effective_from,
    )

    assert first == second
    assert {w.id: w.pace_seconds_per_km for w in snapshot.workouts} == before_workouts
    assert {
        block.id: (block.pace_seconds_per_km, block.pace_range_end_seconds_per_km)
        for blocks in snapshot.blocks.values()
        for block in blocks
    } == before_blocks


def test_preview_changes_equal_what_apply_performs():
    """F-d approval test: preview must describe exactly what apply performs.

    Both paths resolve their paces through one shared kernel, so the preview can
    never drift from the applied result.
    """
    snapshot, _ = _snapshot()
    effective_from = (2, dt.date(2026, 10, 12))
    preview = recalibration_preview(
        snapshot,
        current_vdot=45.0,
        new_vdot=47.0,
        source="activity",
        evidence={},
        effective_from=effective_from,
    )
    before_workouts = {w.id: w.pace_seconds_per_km for w in snapshot.workouts}
    before_blocks = {
        block.id: (block.pace_seconds_per_km, block.pace_range_end_seconds_per_km)
        for blocks in snapshot.blocks.values()
        for block in blocks
    }

    result = apply_recalibration(
        snapshot, new_vdot=47.0, effective_from_date=effective_from[1]
    )

    moved: set[uuid.UUID] = set()
    for workout in snapshot.workouts:
        if workout.pace_seconds_per_km != before_workouts[workout.id]:
            moved.add(workout.id)
        for block in snapshot.blocks[workout.id]:
            if (
                block.pace_seconds_per_km,
                block.pace_range_end_seconds_per_km,
            ) != before_blocks[block.id]:
                moved.add(workout.id)

    described = {change.workout_id: change for change in preview.changes}
    assert described, "the preview must describe at least one change"
    assert set(described) == moved
    assert result.affected_workouts == len(moved)
    assert set(preview.affected_weeks) == set(result.affected_weeks)
    for workout_id, change in described.items():
        applied = next(w for w in snapshot.workouts if w.id == workout_id)
        assert applied.pace_seconds_per_km == change.new_pace
        assert change.old_pace == before_workouts[workout_id]


def test_plan_to_create_rebuilds_the_stored_structure():
    snapshot, race = _snapshot()

    draft = plan_to_create(snapshot)

    assert draft.name == snapshot.plan.name
    assert draft.distance_km == 21.1
    assert draft.start_date == WEEK_1_START
    assert draft.week_start_day == 1
    assert len(draft.phases) == 1
    weeks = draft.phases[0].weeks
    assert [week.number for week in weeks] == [1, 2, 3, 4]
    dates = [workout.date for week in weeks for workout in week.workouts]
    assert dates == sorted(dates)
    assert race.date in dates
    tempo_draft = next(
        workout
        for week in weeks
        for workout in week.workouts
        if workout.date == dt.date(2026, 10, 14)
    )
    assert tempo_draft.type == "tempo"
    assert len(tempo_draft.blocks) == 3
    assert tempo_draft.blocks[1].block_type == "main"

    config = reconstruct_generator_config(snapshot.plan)
    issues = validate_plan_invariants(draft, config)
    assert all(isinstance(issue, PlanValidationIssue) for issue in issues)
