"""Unit tests for apply_recalibration and current-VDOT derivation (R10-R16, R25, R26, R29).

`apply_recalibration` must mutate the plan's LIVE session-bound ORM objects so
that a later `commit()` persists the change. R17 (the per-issue validator gate)
is NOT covered here: a pace-only mutation cannot produce a new error issue, so
the gate is proven in `test_plan_invariant_gate.py` with injected issue lists.
"""

import datetime as dt
import uuid

from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel, select

from app.models import (
    AthleteBaseline,
    BaselineData,
    PlanRecalibration,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
    WorkoutBlock,
)
from app.services.fitness import (
    apply_recalibration,
    classify_recalibration,
    derive_current_vdot,
    latest_applied_recalibration,
    snapshot_plan,
)
from app.services.running_math import get_training_paces_seconds

WEEK_1_START = dt.date(2026, 10, 5)
EFFECTIVE_DATE = dt.date(2026, 10, 12)


def _session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _baseline(vdot: float = 45.0) -> AthleteBaseline:
    return AthleteBaseline(
        weekly_km=BaselineData(value=40.0, confidence="measured"),
        longest_run_km=BaselineData(value=16.0, confidence="measured"),
        vdot=BaselineData(value=vdot, confidence="measured"),
        runs_per_week=BaselineData(value=4.0, confidence="measured"),
    )


def _persist_plan(session: Session) -> tuple[RunningPlan, dict[str, RunningWorkout]]:
    user = User(email=f"{uuid.uuid4()}@example.com", hashed_password="x")
    session.add(user)
    session.flush()
    plan = RunningPlan(
        name="Plan 21.1K",
        distance_km=21.1,
        target_time_seconds=5700,
        start_date=WEEK_1_START,
        week_start_day=1,
        status="active",
        user_id=user.id,
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
    session.add(plan)
    session.flush()
    phase = RunningPhase(
        plan_id=plan.id, position=1, name="Base", start_week=1, end_week=4
    )
    session.add(phase)
    session.flush()
    weeks = []
    for number in range(1, 5):
        week = RunningWeek(
            phase_id=phase.id,
            number=number,
            start_date=WEEK_1_START + dt.timedelta(days=7 * (number - 1)),
            end_date=WEEK_1_START + dt.timedelta(days=7 * (number - 1) + 6),
        )
        session.add(week)
        session.flush()
        weeks.append(week)

    paces = get_training_paces_seconds(45.0)

    def add_workout(
        week: RunningWeek,
        day: dt.date,
        workout_type: str,
        pace: float,
        block_specs,
    ) -> RunningWorkout:
        workout = RunningWorkout(
            week_id=week.id,
            plan_id=plan.id,
            date=day,
            type=workout_type,
            intensity="moderate",
            distance_km=10.0,
            pace_seconds_per_km=pace,
            status_override=None,
        )
        session.add(workout)
        session.flush()
        for index, spec in enumerate(block_specs):
            session.add(
                WorkoutBlock(
                    workout_id=workout.id,
                    position=index + 1,
                    block_type=spec["block_type"],
                    repeats=spec.get("repeats", 1),
                    distance_m=spec.get("distance_m"),
                    pace_seconds_per_km=spec.get("pace"),
                    pace_range_end_seconds_per_km=spec.get("pace_range"),
                )
            )
        session.flush()
        return workout

    easy_blocks = [
        {"block_type": "warmup", "distance_m": 2000, "pace": paces["easy_min"], "pace_range": paces["easy_max"]},
        {"block_type": "cooldown", "distance_m": 1500, "pace": paces["easy_min"], "pace_range": paces["easy_max"]},
    ]
    past = add_workout(
        weeks[0],
        dt.date(2026, 10, 6),
        "tempo",
        paces["threshold"],
        [easy_blocks[0], {"block_type": "main", "distance_m": 8000, "pace": round(paces["threshold"] - 4, 1), "pace_range": round(paces["threshold"] + 4, 1)}, easy_blocks[1]],
    )
    future_tempo = add_workout(
        weeks[1],
        dt.date(2026, 10, 14),
        "tempo",
        paces["threshold"],
        [easy_blocks[0], {"block_type": "main", "distance_m": 8000, "pace": round(paces["threshold"] - 4, 1), "pace_range": round(paces["threshold"] + 4, 1)}, easy_blocks[1]],
    )
    future_long_run = add_workout(
        weeks[2],
        dt.date(2026, 10, 19),
        "long_run",
        paces["easy_min"],
        [easy_blocks[0], {"block_type": "main", "distance_m": 6000, "pace": round(paces["threshold"], 1)}, easy_blocks[1]],
    )
    future_race = add_workout(
        weeks[3],
        dt.date(2026, 10, 26),
        "race",
        270.0,
        [{"block_type": "main", "distance_m": 21100, "pace": 270.0}],
    )
    session.commit()
    return plan, {
        "past": past,
        "future_tempo": future_tempo,
        "future_long_run": future_long_run,
        "future_race": future_race,
    }


def test_snapshot_plan_returns_the_plans_live_objects():
    with _session() as session:
        plan, refs = _persist_plan(session)

        snapshot = snapshot_plan(session, plan)

        assert snapshot.plan is plan
        assert snapshot.workouts[0] is session.get(RunningWorkout, refs["past"].id)
        assert len(snapshot.weeks) == 4
        assert len(snapshot.phases) == 1
        assert snapshot.blocks[refs["future_tempo"].id][1].block_type == "main"


def test_apply_rewrites_only_future_pace_fields_and_persists_on_commit():
    with _session() as session:
        plan, refs = _persist_plan(session)
        snapshot = snapshot_plan(session, plan)
        new_paces = get_training_paces_seconds(47.0)
        past_before = (
            refs["past"].pace_seconds_per_km,
            refs["past"].distance_km,
            refs["past"].status_override,
            refs["past"].cancelled,
        )
        structure_before = {
            block.id: (block.distance_m, block.block_type, block.repeats)
            for workout_id, blocks in snapshot.blocks.items()
            for block in blocks
        }

        result = apply_recalibration(
            snapshot, new_vdot=47.0, effective_from_date=EFFECTIVE_DATE
        )

        assert result.affected_workouts == 2
        assert result.affected_blocks == 6
        assert result.affected_weeks == [2, 3]

        session.commit()
        session.expire_all()

        reloaded_tempo = session.get(RunningWorkout, refs["future_tempo"].id)
        reloaded_long_run = session.get(RunningWorkout, refs["future_long_run"].id)
        reloaded_race = session.get(RunningWorkout, refs["future_race"].id)
        assert reloaded_tempo.pace_seconds_per_km == new_paces["threshold"]
        assert reloaded_long_run.pace_seconds_per_km == new_paces["easy_min"]
        assert reloaded_race.pace_seconds_per_km == 270.0

        tempo_blocks = session.exec(
            select(WorkoutBlock)
            .where(WorkoutBlock.workout_id == refs["future_tempo"].id)
            .order_by(WorkoutBlock.position)  # type: ignore[arg-type]
        ).all()
        assert [block.pace_seconds_per_km for block in tempo_blocks] == [
            new_paces["easy_min"],
            round(new_paces["threshold"] - 4, 1),
            new_paces["easy_min"],
        ]
        assert tempo_blocks[0].pace_range_end_seconds_per_km == new_paces["easy_max"]

        reloaded_past = session.get(RunningWorkout, refs["past"].id)
        assert (
            reloaded_past.pace_seconds_per_km,
            reloaded_past.distance_km,
            reloaded_past.status_override,
            reloaded_past.cancelled,
        ) == past_before
        assert {
            block.id: (block.distance_m, block.block_type, block.repeats)
            for block in session.exec(select(WorkoutBlock)).all()
        } == structure_before


def test_apply_leaves_baseline_and_engine_version_and_audit_rows_untouched():
    with _session() as session:
        plan, _ = _persist_plan(session)
        snapshot = snapshot_plan(session, plan)

        apply_recalibration(snapshot, new_vdot=47.0, effective_from_date=EFFECTIVE_DATE)
        session.commit()
        session.expire_all()

        reloaded_plan = session.get(RunningPlan, plan.id)
        assert reloaded_plan.engine_version == "v3"
        assert reloaded_plan.baseline == _baseline().model_dump()
        assert session.exec(select(PlanRecalibration)).all() == []


def test_derive_current_vdot_falls_back_to_baseline_then_none():
    baseline = _baseline().model_dump()
    applied = PlanRecalibration(
        plan_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        source="test",
        old_vdot=45.0,
        new_vdot=47.0,
        delta_vdot=2.0,
        old_paces={"threshold": 300.0},
        new_paces={"threshold": 297.0},
        kind="improve",
        effective_from_week=2,
        effective_from_date=EFFECTIVE_DATE,
    )

    assert derive_current_vdot(baseline, None) == 45.0
    assert derive_current_vdot(baseline, applied) == 47.0
    assert derive_current_vdot(None, None) is None
    assert derive_current_vdot({}, None) is None


def test_latest_applied_recalibration_ignores_non_applied_rows():
    with _session() as session:
        plan, _ = _persist_plan(session)

        def row(new_vdot: float, created_at: dt.datetime, applied: bool) -> PlanRecalibration:
            return PlanRecalibration(
                plan_id=plan.id,
                user_id=plan.user_id,
                source="manual",
                old_vdot=45.0,
                new_vdot=new_vdot,
                delta_vdot=round(new_vdot - 45.0, 1),
                old_paces={"threshold": 300.0},
                new_paces={"threshold": 297.0},
                kind="improve",
                effective_from_week=2,
                effective_from_date=EFFECTIVE_DATE,
                applied=applied,
                created_at=created_at,
            )

        older = row(46.0, dt.datetime(2026, 10, 10, 12, tzinfo=dt.UTC), True)
        newest_pending = row(50.0, dt.datetime(2026, 10, 12, 12, tzinfo=dt.UTC), False)
        newest_applied = row(47.0, dt.datetime(2026, 10, 11, 12, tzinfo=dt.UTC), True)
        session.add(older)
        session.add(newest_pending)
        session.add(newest_applied)
        session.commit()

        latest = latest_applied_recalibration(session, plan)

        assert latest is not None
        assert latest.id == newest_applied.id
        assert derive_current_vdot(plan.baseline, latest) == 47.0


def test_latest_applied_recalibration_is_none_without_history():
    with _session() as session:
        plan, _ = _persist_plan(session)

        assert latest_applied_recalibration(session, plan) is None
        assert derive_current_vdot(plan.baseline, None) == 45.0


def test_latest_applied_recalibration_is_scoped_to_the_plan_owner():
    """A foreign audit row must never feed the plan's derived current VDOT."""
    with _session() as session:
        plan, _ = _persist_plan(session)
        intruder = User(email=f"{uuid.uuid4()}@example.com", hashed_password="x")
        session.add(intruder)
        session.flush()

        def row(user_id: uuid.UUID, new_vdot: float, created_at: dt.datetime):
            return PlanRecalibration(
                plan_id=plan.id,
                user_id=user_id,
                source="manual",
                old_vdot=45.0,
                new_vdot=new_vdot,
                delta_vdot=round(new_vdot - 45.0, 1),
                old_paces={"threshold": 300.0},
                new_paces={"threshold": 297.0},
                kind="improve",
                effective_from_week=2,
                effective_from_date=EFFECTIVE_DATE,
                created_at=created_at,
            )

        owned = row(plan.user_id, 47.0, dt.datetime(2026, 10, 11, 12, tzinfo=dt.UTC))
        # Newer, pointing at the same plan but owned by another user.
        foreign = row(intruder.id, 55.0, dt.datetime(2026, 10, 13, 12, tzinfo=dt.UTC))
        session.add(owned)
        session.add(foreign)
        session.commit()

        latest = latest_applied_recalibration(session, plan)

        assert latest is not None
        assert latest.id == owned.id
        assert derive_current_vdot(plan.baseline, latest) == 47.0


def test_second_apply_compares_against_the_advanced_current_vdot():
    first = classify_recalibration(45.0, 47.0)
    second = classify_recalibration(47.0, 48.5)

    assert (first.kind, first.delta_vdot, first.suspicious) == ("improve", 2.0, False)
    assert (second.kind, second.delta_vdot, second.suspicious) == ("improve", 1.5, False)


def test_classify_flags_declines_and_suspicious_jumps():
    decline = classify_recalibration(45.0, 43.0)
    jump = classify_recalibration(45.0, 48.0)

    assert (decline.kind, decline.delta_vdot, decline.suspicious) == ("decline", -2.0, False)
    assert (jump.kind, jump.delta_vdot, jump.suspicious) == ("improve", 3.0, True)
