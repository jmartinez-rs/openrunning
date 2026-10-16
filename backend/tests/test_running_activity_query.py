"""Unit tests for the shared run-activity predicate (R30)."""

import datetime as dt
import uuid
from datetime import UTC, datetime, timedelta

from conftest import sqlite_session as _session
from sqlmodel import Session

from app.models import (
    Activity,
    ActivityCardio,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
)
from app.services.running import resolve_workout_status, run_activity_query


def _user(session: Session) -> User:
    user = User(email=f"{uuid.uuid4()}@example.com", hashed_password="x")
    session.add(user)
    session.flush()
    return user


def _activity(
    session: Session,
    user: User,
    *,
    timestamp: datetime,
    source_type: str = "strava",
    distance_meters: float = 10000.0,
    duration_seconds: int = 2400,
    with_cardio: bool = True,
) -> Activity:
    activity = Activity(
        source_id=str(uuid.uuid4()),
        source_type=source_type,
        timestamp=timestamp,
        duration_seconds=duration_seconds,
        user_id=user.id,
    )
    session.add(activity)
    session.flush()
    if with_cardio:
        session.add(
            ActivityCardio(
                activity_id=activity.id, distance_meters=distance_meters
            )
        )
        session.flush()
    return activity


def test_query_selects_only_owned_strava_activities_in_window():
    with _session() as session:
        user = _user(session)
        other = _user(session)
        start = datetime(2026, 10, 1, 3, tzinfo=UTC)
        end = start + timedelta(days=1)

        inside = _activity(session, user, timestamp=start + timedelta(hours=6))
        _activity(session, user, timestamp=end + timedelta(hours=1))
        _activity(session, user, timestamp=start + timedelta(hours=2), source_type="manual")
        _activity(session, other, timestamp=start + timedelta(hours=4))
        _activity(session, user, timestamp=start + timedelta(hours=5), with_cardio=False)
        session.commit()

        rows = session.exec(run_activity_query(user.id, start, end)).all()

        assert [row[0].id for row in rows] == [inside.id]


def test_query_can_exclude_already_linked_activities():
    with _session() as session:
        user = _user(session)
        start = datetime(2026, 10, 1, 3, tzinfo=UTC)
        end = start + timedelta(days=1)
        linked = _activity(session, user, timestamp=start + timedelta(hours=6))
        free = _activity(session, user, timestamp=start + timedelta(hours=7))
        session.commit()

        rows = session.exec(
            run_activity_query(user.id, start, end, exclude_ids=[linked.id])
        ).all()

        assert [row[0].id for row in rows] == [free.id]


def test_resolve_workout_status_still_matches_strava_activity_in_window():
    """Approval test: the predicate extraction must not change status resolution."""
    with _session() as session:
        user = _user(session)
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
        phase = RunningPhase(
            plan_id=plan.id, position=1, name="Base", start_week=1, end_week=1
        )
        session.add(phase)
        session.flush()
        week = RunningWeek(
            phase_id=phase.id,
            number=1,
            start_date=dt.date(2026, 9, 28),
            end_date=dt.date(2026, 10, 4),
        )
        session.add(week)
        session.flush()

        workout_date = dt.date(2026, 10, 1)
        workout = RunningWorkout(
            week_id=week.id,
            plan_id=plan.id,
            date=workout_date,
            type="easy_run",
            intensity="easy",
        )
        session.add(workout)
        # Strava activity inside the session's local (UTC-3) window.
        _activity(
            session,
            user,
            timestamp=datetime.combine(workout_date, dt.time(6), tzinfo=UTC),
            distance_meters=8000.0,
        )
        session.commit()

        status_value, matched = resolve_workout_status(session, user.id, workout)

        assert status_value == "completed"
        assert matched is not None
        assert matched["distance_meters"] == 8000.0


def test_resolve_workout_status_ignores_non_strava_activity():
    with _session() as session:
        user = _user(session)
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
        phase = RunningPhase(
            plan_id=plan.id, position=1, name="Base", start_week=1, end_week=1
        )
        session.add(phase)
        session.flush()
        week = RunningWeek(
            phase_id=phase.id,
            number=1,
            start_date=dt.date(2026, 9, 28),
            end_date=dt.date(2026, 10, 4),
        )
        session.add(week)
        session.flush()
        workout = RunningWorkout(
            week_id=week.id,
            plan_id=plan.id,
            date=dt.date(2026, 10, 1),
            type="easy_run",
            intensity="easy",
        )
        session.add(workout)
        _activity(
            session,
            user,
            timestamp=datetime(2026, 10, 1, 6, tzinfo=UTC),
            source_type="manual",
        )
        session.commit()

        status_value, matched = resolve_workout_status(session, user.id, workout)

        assert status_value == "missed"
        assert matched is None
