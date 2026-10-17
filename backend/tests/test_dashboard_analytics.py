"""Dashboard analytics: local-week window + day bucketing (RUNNING_TIMEZONE).

Covers R2/S3 plus the host-independence invariant of this slice: the weekly
window and the per-day bucket must both be derived from the pinned
``RUNNING_TIMEZONE`` (America/Argentina/Buenos_Aires, UTC-3) regardless of the
host clock. SQLite drops ``tzinfo`` on round-trip, so a naive timestamp is
treated as UTC before conversion (mirroring ``services.fitness._local_date``).

The whole module must pass identically under ``TZ=UTC``,
``TZ=America/New_York`` and ``TZ=America/Argentina/Buenos_Aires``: no assertion
below depends on the host timezone.
"""

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models import Activity, ActivityCardio
from app.services.running import RUNNING_TIMEZONE

DASHBOARD_URL = "/api/v1/analytics/dashboard"
# Monday starting the 2026-03-10 local week (local calendar, UTC-3).
WEEK_START = date(2026, 3, 9)
# Local Sunday that closes that week (week_start + 6 days).
WEEK_END = date(2026, 3, 15)


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
    """The UTC instant of a wall-clock time in the pinned running timezone.

    SQLite drops ``tzinfo`` on round-trip, so seeding an aware datetime stores
    its wall clock verbatim. Converting to UTC first means the stored naive
    value is the real instant — exactly what production persists in a
    ``timestamptz`` column and what the route assumes for naive input. This
    keeps every seeded row host-independent.
    """
    return datetime(
        year, month, day, hour, minute, tzinfo=RUNNING_TIMEZONE
    ).astimezone(UTC)


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


def _get_dashboard(
    client: Any, week_start: date = WEEK_START
) -> dict[str, Any]:
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
    """Local Sunday 21:00 (Mon 00:00 UTC) still belongs to the local week.

    Discriminator: a UTC-anchored window would exclude it (the instant is after
    the local week's UTC end); the local-anchored window must include it.
    """
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


def test_week_end_is_the_local_sunday_after_week_start(db_engine, user, client):
    """The window echoes the requested Monday and its closing local Sunday."""
    body = _get_dashboard(client)

    assert body["week_start"] == WEEK_START.isoformat()
    assert body["week_end"] == WEEK_END.isoformat()


def test_activity_outside_local_week_is_excluded(db_engine, user, client):
    """Local Sunday-before and next-Monday-midnight fall outside the week."""
    _seed_activity(db_engine, user.id, timestamp=_local(2026, 3, 8, 23, 30))
    _seed_activity(db_engine, user.id, timestamp=_local(2026, 3, 16, 0, 0))

    body = _get_dashboard(client)

    assert _all_activities(body) == []
    assert body["kpis"]["sessions"] == 0
    assert body["kpis"]["active_days"] == 0


def test_previous_local_sunday_activity_lands_in_previous_week(
    db_engine, user, client
):
    """A local Sunday-before belongs to the previous week, not the current one.

    Exercises the previous-week computation path (``week_start - 7d``) and its
    own bucket keys: a UTC-anchored window would misplace this instant into the
    requested week (and, west of UTC-3, key it outside the buckets entirely).
    """
    _seed_activity(db_engine, user.id, timestamp=_local(2026, 3, 8, 22, 30))

    body = _get_dashboard(client)

    assert _all_activities(body) == []
    assert body["kpis"]["sessions"] == 0
    previous = body["previous_kpis"]
    assert previous is not None
    assert previous["sessions"] == 1
    assert previous["active_days"] == 1


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
