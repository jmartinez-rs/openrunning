"""Dashboard analytics: local-day bucketing (RUNNING_TIMEZONE) + sport_type DTO.

Covers R2/S3 plus the invariants this slice must not break while moving the
weekly bucket from UTC to the pinned local timezone (America/Argentina/
Buenos_Aires, UTC-3).

Timestamps are seeded with the pinned ``RUNNING_TIMEZONE`` offset. SQLite drops
``tzinfo`` on round-trip, so the wall clock written is the local wall clock; the
timezone-aware construction documents intent and keeps the assertions readable.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models import Activity, ActivityCardio
from app.services.running import RUNNING_TIMEZONE

DASHBOARD_URL = "/api/v1/analytics/dashboard"
# Monday starting the 2026-03-10 week (local calendar).
WEEK_START = date(2026, 3, 9)


def _seed_activity(
    db_engine: Engine,
    user_id: uuid.UUID,
    *,
    timestamp: datetime,
    sport_type: str | None = None,
    source_type: str = "strava",
    distance_meters: float | None = 5000.0,
    duration_seconds: int = 1800,
) -> uuid.UUID:
    """Insert an activity (optionally with cardio) owned by ``user_id``."""
    with Session(db_engine) as session:
        activity = Activity(
            source_id=str(uuid.uuid4()),
            source_type=source_type,
            sport_type=sport_type,
            timestamp=timestamp,
            duration_seconds=duration_seconds,
            name="Session",
            user_id=user_id,
        )
        session.add(activity)
        session.flush()
        if distance_meters is not None:
            session.add(
                ActivityCardio(
                    activity_id=activity.id, distance_meters=distance_meters
                )
            )
        session.commit()
        return activity.id


def _local(year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    """A wall-clock instant expressed in the pinned running timezone."""
    return datetime(year, month, day, hour, minute, tzinfo=RUNNING_TIMEZONE)


def _activities_on(payload: dict[str, Any], iso_day: str) -> list[dict[str, Any]]:
    for day in payload["timeline"]:
        if day["date"] == iso_day:
            return day["activities"]
    raise AssertionError(f"day {iso_day} missing from timeline")


def _all_activities(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        activity
        for day in payload["timeline"]
        for activity in day["activities"]
    ]


def _get_dashboard(client, week_start: date = WEEK_START) -> dict[str, Any]:
    response = client.get(
        DASHBOARD_URL, params={"week_start": week_start.isoformat()}
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_late_local_evening_activity_buckets_to_local_day(db_engine, user, client):
    """S3: a 22:10-local activity belongs to the local day, not UTC's next day."""
    activity_id = _seed_activity(
        db_engine, user.id, timestamp=_local(2026, 3, 10, 22, 10)
    )

    body = _get_dashboard(client)

    assert [item["id"] for item in _activities_on(body, "2026-03-10")] == [
        str(activity_id)
    ]
    assert body["kpis"]["active_days"] == 1


def test_sunday_late_local_activity_stays_in_local_week(db_engine, user, client):
    """Sunday 21:00 local is still Sunday: HTTP 200, in-week, not double-counted."""
    activity_id = _seed_activity(
        db_engine, user.id, timestamp=_local(2026, 3, 15, 21, 0)
    )

    body = _get_dashboard(client)

    assert [item["id"] for item in _activities_on(body, "2026-03-15")] == [
        str(activity_id)
    ]
    assert len(_all_activities(body)) == 1
    assert body["kpis"]["sessions"] == 1
    assert body["kpis"]["active_days"] == 1


def test_activity_outside_local_week_is_excluded(db_engine, user, client):
    """Local Sunday-before and next-Monday-midnight fall outside the week."""
    _seed_activity(db_engine, user.id, timestamp=_local(2026, 3, 8, 23, 30))
    _seed_activity(db_engine, user.id, timestamp=_local(2026, 3, 16, 0, 0))

    body = _get_dashboard(client)

    assert _all_activities(body) == []
    assert body["kpis"]["sessions"] == 0
    assert body["kpis"]["active_days"] == 0


def test_sport_type_is_echoed_null_and_run(db_engine, user, client):
    """The timeline exposes sport_type for both unclassified and classified rows."""
    unclassified_id = _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 3, 11, 8, 0),
        sport_type=None,
        source_type="gpx_file",
    )
    run_id = _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 3, 12, 8, 0),
        sport_type="Run",
    )

    body = _get_dashboard(client)

    by_id = {item["id"]: item for item in _all_activities(body)}
    assert by_id[str(unclassified_id)]["sport_type"] is None
    assert by_id[str(run_id)]["sport_type"] == "Run"


def test_cardio_aggregates_invariant_under_local_bucketing(
    db_engine, user, client
):
    """Distance/duration/session aggregates keep summing the same week."""
    _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 3, 10, 22, 10),
        distance_meters=6000.0,
        duration_seconds=2100,
    )
    _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 3, 15, 21, 0),
        distance_meters=None,
        duration_seconds=1200,
    )

    body = _get_dashboard(client)

    kpis = body["kpis"]
    assert kpis["cardio_distance_meters"] == 6000.0
    assert kpis["cardio_duration_seconds"] == 2100
    assert kpis["sessions"] == 2
    assert kpis["active_days"] == 2
