"""Unit tests for VDOT estimation from real evidence (R1-R6, R27, R30)."""

import datetime as dt
import inspect
import uuid
from datetime import UTC, datetime, time

import pytest
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel

from app.models import (
    Activity,
    ActivityCardio,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
)
from app.services.fitness import (
    RecentEffort,
    best_recent_effort,
    best_test_effort,
    estimate_vdot_for_plan,
    estimate_vdot_from_activity,
)
from app.services.running_math import calculate_vdot

TODAY = dt.date(2026, 10, 15)


def _session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _plan(session: Session) -> RunningPlan:
    user = User(email=f"{uuid.uuid4()}@example.com", hashed_password="x")
    session.add(user)
    session.flush()
    plan = RunningPlan(
        name="p",
        start_date=dt.date(2026, 9, 28),
        week_start_day=1,
        status="active",
        user_id=user.id,
        engine_version="v3",
    )
    session.add(plan)
    session.flush()
    return plan


def _add_activity(
    session: Session,
    user_id: uuid.UUID,
    *,
    day: dt.date,
    distance_meters: float,
    time_seconds: int,
    hour: int = 6,
) -> Activity:
    activity = Activity(
        source_id=str(uuid.uuid4()),
        source_type="strava",
        timestamp=datetime.combine(day, time(hour), tzinfo=UTC),
        duration_seconds=time_seconds,
        user_id=user_id,
    )
    session.add(activity)
    session.flush()
    session.add(
        ActivityCardio(activity_id=activity.id, distance_meters=distance_meters)
    )
    session.flush()
    return activity


def _add_test_workout(
    session: Session,
    plan: RunningPlan,
    *,
    day: dt.date,
    matched_activity_id: uuid.UUID | None,
) -> RunningWorkout:
    phase = RunningPhase(
        plan_id=plan.id, position=1, name="Base", start_week=1, end_week=8
    )
    session.add(phase)
    session.flush()
    week = RunningWeek(
        phase_id=phase.id,
        number=1,
        start_date=day - dt.timedelta(days=day.isoweekday() - 1),
        end_date=day - dt.timedelta(days=day.isoweekday() - 1) + dt.timedelta(days=6),
    )
    session.add(week)
    session.flush()
    workout = RunningWorkout(
        week_id=week.id,
        plan_id=plan.id,
        date=day,
        type="test",
        intensity="hard",
        matched_activity_id=matched_activity_id,
    )
    session.add(workout)
    session.flush()
    return workout


def test_estimate_matches_the_pinned_daniels_oracle():
    effort = RecentEffort(
        activity_id=uuid.uuid4(),
        date=TODAY,
        distance_meters=10000.0,
        time_seconds=2400.0,
    )

    estimate = estimate_vdot_from_activity(effort)

    assert estimate.vdot == pytest.approx(51.9, abs=0.1)
    assert estimate.evidence["distance_meters"] == 10000.0
    assert estimate.evidence["time_seconds"] == 2400.0
    assert estimate.evidence["source_id"] == str(effort.activity_id)


@pytest.mark.parametrize(
    ("distance_meters", "time_seconds"),
    [
        (10000.0, 2400.0),
        (5000.0, 1200.0),
        (3000.0, 900.0),
        (21097.5, 5700.0),
        (42195.0, 12600.0),
        (1500.0, 360.0),
    ],
)
def test_estimate_is_consistent_with_calculate_vdot(distance_meters, time_seconds):
    effort = RecentEffort(
        activity_id=uuid.uuid4(),
        date=TODAY,
        distance_meters=distance_meters,
        time_seconds=time_seconds,
    )

    estimate = estimate_vdot_from_activity(effort)

    assert estimate.vdot == calculate_vdot(distance_meters, time_seconds)


def test_source_and_confidence_depend_on_evidence_origin():
    activity_effort = RecentEffort(
        activity_id=uuid.uuid4(),
        date=TODAY,
        distance_meters=10000.0,
        time_seconds=2400.0,
    )
    test_effort = RecentEffort(
        activity_id=uuid.uuid4(),
        date=TODAY,
        distance_meters=10000.0,
        time_seconds=2400.0,
        matched_workout_id=uuid.uuid4(),
    )

    activity_estimate = estimate_vdot_from_activity(activity_effort)
    test_estimate = estimate_vdot_from_activity(test_effort)

    assert (activity_estimate.source, activity_estimate.confidence) == (
        "activity",
        "estimated",
    )
    assert (test_estimate.source, test_estimate.confidence) == ("test", "measured")
    assert test_estimate.evidence["matched_workout_id"] == str(
        test_effort.matched_workout_id
    )
    assert activity_estimate.evidence["matched_workout_id"] is None


def test_test_mark_is_authoritative_over_a_faster_recent_activity():
    with _session() as session:
        plan = _plan(session)
        test_day = TODAY - dt.timedelta(days=10)
        test_activity = _add_activity(
            session,
            plan.user_id,
            day=test_day,
            distance_meters=10000.0,
            time_seconds=2400,
        )
        _add_test_workout(
            session, plan, day=test_day, matched_activity_id=test_activity.id
        )
        # Faster, newer, higher-VDOT activity that must stay secondary.
        _add_activity(
            session,
            plan.user_id,
            day=TODAY - dt.timedelta(days=2),
            distance_meters=5000.0,
            time_seconds=1000,
        )
        session.commit()

        estimate = estimate_vdot_for_plan(session, plan, as_of=TODAY)

        assert estimate is not None
        assert estimate.source == "test"
        assert estimate.confidence == "measured"
        assert estimate.evidence["source_id"] == str(test_activity.id)
        secondary = estimate.evidence["secondary"]
        assert len(secondary) == 1
        assert secondary[0]["distance_meters"] == 5000.0


def test_no_qualifying_evidence_returns_none_instead_of_raising():
    with _session() as session:
        plan = _plan(session)
        session.commit()

        assert estimate_vdot_for_plan(session, plan, as_of=TODAY) is None


def test_stale_test_mark_is_ignored_and_recent_activity_wins():
    with _session() as session:
        plan = _plan(session)
        stale_day = TODAY - dt.timedelta(days=56)
        stale_activity = _add_activity(
            session,
            plan.user_id,
            day=stale_day,
            distance_meters=10000.0,
            time_seconds=2400,
        )
        _add_test_workout(
            session, plan, day=stale_day, matched_activity_id=stale_activity.id
        )
        fresh = _add_activity(
            session,
            plan.user_id,
            day=TODAY - dt.timedelta(days=3),
            distance_meters=10000.0,
            time_seconds=2500,
        )
        session.commit()

        estimate = estimate_vdot_for_plan(session, plan, as_of=TODAY)

        assert estimate is not None
        assert estimate.source == "activity"
        assert estimate.evidence["source_id"] == str(fresh.id)
        assert estimate.evidence["secondary"] == []


def test_window_and_minimum_distance_filters():
    with _session() as session:
        plan = _plan(session)
        _add_activity(
            session,
            plan.user_id,
            day=TODAY - dt.timedelta(days=50),
            distance_meters=10000.0,
            time_seconds=2400,
        )
        _add_activity(
            session,
            plan.user_id,
            day=TODAY - dt.timedelta(days=5),
            distance_meters=2500.0,
            time_seconds=700,
        )
        qualifying = _add_activity(
            session,
            plan.user_id,
            day=TODAY - dt.timedelta(days=7),
            distance_meters=8000.0,
            time_seconds=2000,
        )
        session.commit()

        effort = best_recent_effort(session, plan.user_id, as_of=TODAY)

        assert effort is not None
        assert effort.activity_id == qualifying.id
        assert effort.distance_meters == 8000.0


def test_highest_implied_vdot_wins_among_activities():
    with _session() as session:
        plan = _plan(session)
        slower = _add_activity(
            session,
            plan.user_id,
            day=TODAY - dt.timedelta(days=3),
            distance_meters=10000.0,
            time_seconds=3000,
        )
        faster = _add_activity(
            session,
            plan.user_id,
            day=TODAY - dt.timedelta(days=4),
            distance_meters=10000.0,
            time_seconds=2400,
        )
        session.commit()

        effort = best_recent_effort(session, plan.user_id, as_of=TODAY)
        estimate = estimate_vdot_for_plan(session, plan, as_of=TODAY)

        assert effort is not None and effort.activity_id == faster.id
        assert estimate is not None
        assert estimate.evidence["source_id"] == str(faster.id)
        assert [entry["source_id"] for entry in estimate.evidence["secondary"]] == [
            str(slower.id)
        ]


def test_best_test_effort_ignores_unmatched_test_workouts():
    with _session() as session:
        plan = _plan(session)
        _add_test_workout(session, plan, day=TODAY - dt.timedelta(days=2), matched_activity_id=None)
        session.commit()

        assert best_test_effort(session, plan, as_of=TODAY) is None


def test_fitness_module_reuses_the_shared_run_predicate():
    from app.services import fitness

    source = inspect.getsource(fitness)

    assert "source_type" not in source
