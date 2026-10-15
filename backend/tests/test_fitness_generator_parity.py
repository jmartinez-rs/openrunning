"""Round-trip parity between REAL generator output and the recalibration rewrite.

The recalibration must reproduce the generator's OWN block paces for the new
VDOT. These tests build a plan with the real generator, recalibrate it, and
compare against a plan the generator produces for the new VDOT. This is the
round-trip that was missing while `fitness.block_paces_for` carried its own
offset table (and its own repetition heuristic).
"""

import datetime as dt
import uuid

import pytest
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel, select

from app.models import (
    AthleteBaseline,
    BaselineData,
    PlanGeneratorConfig,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
    WorkoutBlock,
)
from app.services.fitness import (
    apply_recalibration,
    block_paces_for,
    recalibration_preview,
    snapshot_plan,
)
from app.services.plan_generator import generate_plan_draft_v2
from app.services.running_math import get_training_paces_seconds
from app.services.workout_library import build_daniels_blocks_with_ranges

START = dt.date(2026, 10, 12)
OLD_VDOT = 45.0
NEW_VDOT = 47.0

# (target_km, num_weeks, weekly_km, selected_days, target_time_seconds)
PROFILES = [
    (5.0, 8, 20.0, [1, 3, 5], 1140),
    (10.0, 12, 30.0, [1, 2, 4, 6], 2400),
    (21.1, 12, 45.0, [1, 2, 4, 5, 7], 5700),
    (42.2, 16, 60.0, [1, 2, 4, 5, 7], 12600),
]

HALF = (21.1, 12, 45.0, [1, 2, 4, 5, 7], 5700)
MARATHON = (42.2, 16, 60.0, [1, 2, 4, 5, 7], 12600)


def _session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _baseline(weekly_km: float, vdot: float) -> AthleteBaseline:
    return AthleteBaseline(
        weekly_km=BaselineData(value=weekly_km, confidence="measured"),
        longest_run_km=BaselineData(value=weekly_km * 0.4, confidence="measured"),
        vdot=BaselineData(value=vdot, confidence="measured"),
        runs_per_week=BaselineData(value=4.0, confidence="measured"),
    )


def _config(profile, *, vdot: float, target_time: bool = True) -> PlanGeneratorConfig:
    target_km, num_weeks, weekly_km, selected_days, time_seconds = profile
    return PlanGeneratorConfig(
        target_km=target_km,
        num_weeks=num_weeks,
        start_date=START,
        selected_days=list(selected_days),
        baseline=_baseline(weekly_km, vdot),
        target_time_seconds=time_seconds if target_time else None,
    )


def _persist_draft(session: Session, draft, *, user_id: uuid.UUID) -> RunningPlan:
    """Persist a `RunningPlanCreate` draft as live ORM rows, as the API does."""
    plan = RunningPlan(
        user_id=user_id,
        name=draft.name,
        goal=draft.goal,
        distance_km=draft.distance_km,
        distance_unit=draft.distance_unit,
        target_time_seconds=draft.target_time_seconds,
        target_pace_seconds_per_km=draft.target_pace_seconds_per_km,
        start_date=draft.start_date,
        end_date=draft.end_date,
        week_start_day=draft.week_start_day,
        status="active",
        notes=draft.notes,
        engine_version=draft.engine_version,
        baseline=draft.baseline,
        generation_params=draft.generation_params,
        race_id=draft.race_id,
    )
    session.add(plan)
    session.flush()
    for phase_in in sorted(draft.phases, key=lambda item: item.position):
        phase = RunningPhase(
            plan_id=plan.id,
            position=phase_in.position,
            name=phase_in.name,
            color=phase_in.color,
            start_week=phase_in.start_week,
            end_week=phase_in.end_week,
            objective=phase_in.objective,
            description=phase_in.description,
        )
        session.add(phase)
        session.flush()
        for week_in in sorted(phase_in.weeks, key=lambda item: item.number):
            week = RunningWeek(
                phase_id=phase.id,
                number=week_in.number,
                start_date=week_in.start_date,
                end_date=week_in.end_date,
                name=week_in.name,
                objective=week_in.objective,
                notes=week_in.notes,
            )
            session.add(week)
            session.flush()
            for workout_in in sorted(week_in.workouts, key=lambda item: item.date):
                workout = RunningWorkout(
                    week_id=week.id,
                    plan_id=plan.id,
                    date=workout_in.date,
                    type=workout_in.type,
                    objective=workout_in.objective,
                    name=workout_in.name,
                    distance_km=workout_in.distance_km,
                    duration_seconds=workout_in.duration_seconds,
                    pace_seconds_per_km=workout_in.pace_seconds_per_km,
                    intensity=workout_in.intensity,
                    description=workout_in.description,
                    notes=workout_in.notes,
                    cancelled=workout_in.cancelled,
                    status_override=workout_in.status_override,
                )
                session.add(workout)
                session.flush()
                for block_in in sorted(
                    workout_in.blocks, key=lambda item: item.position
                ):
                    session.add(
                        WorkoutBlock(
                            workout_id=workout.id,
                            position=block_in.position,
                            block_type=block_in.block_type,
                            repeats=block_in.repeats,
                            distance_m=block_in.distance_m,
                            duration_seconds=block_in.duration_seconds,
                            pace_seconds_per_km=block_in.pace_seconds_per_km,
                            pace_range_end_seconds_per_km=(
                                block_in.pace_range_end_seconds_per_km
                            ),
                            recovery_seconds=block_in.recovery_seconds,
                            recovery_type=block_in.recovery_type,
                            notes=block_in.notes,
                        )
                    )
                session.flush()
    session.commit()
    return plan


def _block_signature(blocks) -> tuple:
    return tuple(
        (
            block.block_type,
            block.repeats,
            block.distance_m,
            block.pace_seconds_per_km,
            block.pace_range_end_seconds_per_km,
        )
        for block in sorted(blocks, key=lambda item: item.position)
    )


def _draft_signature(draft) -> dict[dt.date, tuple]:
    return {
        workout.date: (
            workout.type,
            workout.pace_seconds_per_km,
            _block_signature(workout.blocks),
        )
        for phase in draft.phases
        for week in phase.weeks
        for workout in week.workouts
    }


def _stored_signature(session: Session, plan: RunningPlan) -> dict[dt.date, tuple]:
    signature: dict[dt.date, tuple] = {}
    workouts = session.exec(
        select(RunningWorkout).where(RunningWorkout.plan_id == plan.id)
    ).all()
    for workout in workouts:
        blocks = session.exec(
            select(WorkoutBlock).where(WorkoutBlock.workout_id == workout.id)
        ).all()
        signature[workout.date] = (
            workout.type,
            workout.pace_seconds_per_km,
            _block_signature(blocks),
        )
    return signature


def _blocks_by_type(session: Session, workout_id: uuid.UUID) -> dict[str, WorkoutBlock]:
    blocks = session.exec(
        select(WorkoutBlock).where(WorkoutBlock.workout_id == workout_id)
    ).all()
    return {block.block_type: block for block in blocks}


def _recalibrate(session: Session, plan: RunningPlan):
    snapshot = snapshot_plan(session, plan)
    preview = recalibration_preview(
        snapshot,
        current_vdot=OLD_VDOT,
        new_vdot=NEW_VDOT,
        source="activity",
        evidence={},
        effective_from=(1, plan.start_date),
    )
    result = apply_recalibration(
        snapshot, new_vdot=NEW_VDOT, effective_from_date=plan.start_date
    )
    session.commit()
    return preview, result


@pytest.mark.parametrize("profile", PROFILES, ids=lambda item: f"{item[0]}K-{item[1]}w")
def test_recalibration_reproduces_the_generators_paces_for_the_new_vdot(profile):
    """Applied paces must equal a plan the real generator builds for the new VDOT."""
    with _session() as session:
        user = User(email=f"{uuid.uuid4()}@example.com", hashed_password="x")
        session.add(user)
        session.flush()

        old_signature = _draft_signature(
            generate_plan_draft_v2(_config(profile, vdot=OLD_VDOT)).draft
        )
        new_signature = _draft_signature(
            generate_plan_draft_v2(_config(profile, vdot=NEW_VDOT)).draft
        )
        plan = _persist_draft(
            session,
            generate_plan_draft_v2(_config(profile, vdot=OLD_VDOT)).draft,
            user_id=user.id,
        )
        assert _stored_signature(session, plan) == old_signature

        preview, result = _recalibrate(session, plan)

        # The generator itself is the oracle for what must move (non-vacuous setup).
        expected_changed = {
            day for day, value in old_signature.items() if new_signature[day] != value
        }
        assert expected_changed, "the VDOT bump must move some real session paces"
        assert result.affected_workouts == len(expected_changed)
        assert {change.date for change in preview.changes} == expected_changed
        assert _stored_signature(session, plan) == new_signature


@pytest.mark.parametrize("profile", [HALF, MARATHON], ids=["half", "marathon"])
def test_tuneup_and_goal_pace_long_run_keep_the_generators_single_pace(profile):
    """Tune-up and goal-pace long runs run easy segments at one pace, with no range."""
    with _session() as session:
        user = User(email=f"{uuid.uuid4()}@example.com", hashed_password="x")
        session.add(user)
        session.flush()
        plan = _persist_draft(
            session,
            generate_plan_draft_v2(_config(profile, vdot=OLD_VDOT)).draft,
            user_id=user.id,
        )

        _recalibrate(session, plan)

        new_paces = get_training_paces_seconds(NEW_VDOT)
        workouts = session.exec(
            select(RunningWorkout).where(RunningWorkout.plan_id == plan.id)
        ).all()

        tuneup = next(workout for workout in workouts if workout.type == "test")
        tuneup_blocks = _blocks_by_type(session, tuneup.id)
        assert set(tuneup_blocks) == {"warmup", "main", "cooldown"}
        assert (
            tuneup_blocks["warmup"].pace_seconds_per_km,
            tuneup_blocks["warmup"].pace_range_end_seconds_per_km,
        ) == (new_paces["easy_max"], None)
        assert (
            tuneup_blocks["cooldown"].pace_seconds_per_km,
            tuneup_blocks["cooldown"].pace_range_end_seconds_per_km,
        ) == (new_paces["easy_max"], None)
        assert (
            tuneup_blocks["main"].pace_seconds_per_km,
            tuneup_blocks["main"].pace_range_end_seconds_per_km,
        ) == (new_paces["threshold"], None)

        block_long_runs = [
            workout
            for workout in workouts
            if workout.type == "long_run"
            and len(_blocks_by_type(session, workout.id)) >= 3
        ]
        assert block_long_runs, "the profile must produce a goal-pace long run"
        goal_paces = _blocks_by_type(session, block_long_runs[0].id)
        assert (
            goal_paces["warmup"].pace_seconds_per_km,
            goal_paces["warmup"].pace_range_end_seconds_per_km,
        ) == (new_paces["easy_min"], None)
        assert (
            goal_paces["cooldown"].pace_seconds_per_km,
            goal_paces["cooldown"].pace_range_end_seconds_per_km,
        ) == (new_paces["easy_max"], None)
        goal_key = "marathon" if profile[0] >= 42.2 else "threshold"
        assert (
            goal_paces["main"].pace_seconds_per_km,
            goal_paces["main"].pace_range_end_seconds_per_km,
        ) == (new_paces[goal_key], None)


def _interval_block_paces(
    workout_type: str, *, progression_level: int, total_km: float
) -> tuple[float | None, float | None]:
    return block_paces_for(
        workout_type,
        block_type="interval",
        block_count=3,
        paces=get_training_paces_seconds(OLD_VDOT),
        target_km=21.1,
        progression_level=progression_level,
        total_km=total_km,
        current_pace=1.0,
        current_range=2.0,
    )


def test_interval_paces_match_the_library_for_every_repetition_rule():
    """R vs I is decided by the library's rule (type + phase volume), never by
    the rep distance: `block_paces_for` no longer even takes a block distance."""
    paces = get_training_paces_seconds(OLD_VDOT)

    def library_interval(progression_level: int, total_km: float):
        blocks = build_daniels_blocks_with_ranges(
            workout_type="intervals",
            total_km=total_km,
            vdot=OLD_VDOT,
            paces=paces,
            progression_level=progression_level,
        )
        return next(block for block in blocks if block.block_type == "interval")

    # Phase-1 low-volume intervals are repetition (R) work: 400 m reps at ±2 s/km.
    phase_1 = library_interval(progression_level=1, total_km=6.0)
    assert phase_1.distance_m == 400
    assert _interval_block_paces(
        "intervals", progression_level=1, total_km=6.0
    ) == (
        phase_1.pace_seconds_per_km,
        phase_1.pace_range_end_seconds_per_km,
    )
    assert _interval_block_paces(
        "intervals", progression_level=1, total_km=6.0
    ) == (round(paces["repetition"] - 2, 1), round(paces["repetition"] + 2, 1))

    # Later phases at volume are VO2max (I) work: long reps at ±3 s/km.
    phase_3 = library_interval(progression_level=3, total_km=12.0)
    assert phase_3.distance_m >= 800
    assert _interval_block_paces(
        "intervals", progression_level=3, total_km=12.0
    ) == (
        phase_3.pace_seconds_per_km,
        phase_3.pace_range_end_seconds_per_km,
    )

    # An explicit repetition session keeps R paces even with long reps — the rule
    # is the workout type, not `distance_m <= 600`.
    assert _interval_block_paces(
        "repetition", progression_level=2, total_km=12.0
    ) == (round(paces["repetition"] - 2, 1), round(paces["repetition"] + 2, 1))


def test_tempo_paces_match_the_library_for_cruise_and_continuous():
    """Tempo offsets come from the library: cruise from phase 2 at volume, else continuous."""
    paces = get_training_paces_seconds(OLD_VDOT)

    def library_tempo_main(progression_level: int, total_km: float):
        blocks = build_daniels_blocks_with_ranges(
            workout_type="tempo",
            total_km=total_km,
            vdot=OLD_VDOT,
            paces=paces,
            progression_level=progression_level,
        )
        return next(block for block in blocks if block.block_type == "main")

    for progression_level, total_km in ((2, 12.0), (1, 12.0), (2, 6.0)):
        generated = library_tempo_main(progression_level, total_km)
        assert block_paces_for(
            "tempo",
            block_type="main",
            block_count=3,
            paces=paces,
            target_km=21.1,
            progression_level=progression_level,
            total_km=total_km,
            current_pace=1.0,
            current_range=2.0,
        ) == (
            generated.pace_seconds_per_km,
            generated.pace_range_end_seconds_per_km,
        )


def test_race_pace_stays_goal_pinned_when_the_goal_has_no_target_time():
    """D6: with no target time the generator derives race pace from VDOT, but the
    recalibration deliberately keeps the stored race pace, so the race is the ONLY
    session that may diverge from a freshly generated plan."""
    with _session() as session:
        user = User(email=f"{uuid.uuid4()}@example.com", hashed_password="x")
        session.add(user)
        session.flush()

        old_signature = _draft_signature(
            generate_plan_draft_v2(_config(HALF, vdot=OLD_VDOT, target_time=False)).draft
        )
        new_signature = _draft_signature(
            generate_plan_draft_v2(_config(HALF, vdot=NEW_VDOT, target_time=False)).draft
        )
        plan = _persist_draft(
            session,
            generate_plan_draft_v2(
                _config(HALF, vdot=OLD_VDOT, target_time=False)
            ).draft,
            user_id=user.id,
        )

        _recalibrate(session, plan)

        stored = _stored_signature(session, plan)
        diverging = {day for day in new_signature if stored[day] != new_signature[day]}
        race_days = {day for day, value in old_signature.items() if value[0] == "race"}
        assert race_days, "the profile must end with a goal race"
        assert diverging
        assert diverging <= race_days
        for day in race_days:
            assert stored[day] == old_signature[day]
