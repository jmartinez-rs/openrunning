"""Month summary analytics: day keys pinned to ``RUNNING_TIMEZONE`` (R9).

The activities summary (``GET /analytics/activities/summary``) feeds the
dashboard's expanded month grid, which must mark every day of the displayed
month that has a run. Its ``calendar`` and ``by_type[].dot_days`` keys are
therefore part of the same day-key authority as the weekly timeline and MUST be
local (``RUNNING_TIMEZONE``) calendar days — not UTC days.

Like ``test_dashboard_analytics.py``, this module must pass identically under
``TZ=UTC``, ``TZ=America/New_York`` and ``TZ=America/Argentina/Buenos_Aires``:
no assertion below depends on the host timezone, and the naive timestamp that
SQLite round-trips is pinned to UTC before any conversion.
"""

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.api.routes.analytics import _as_local_date
from app.models import Activity, ActivityCardio
from app.services.running import RUNNING_TIMEZONE

MONTH_SUMMARY_URL = "/api/v1/analytics/activities/summary"


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
    ``timestamptz`` column and what the route assumes for naive input.
    """
    return datetime(
        year, month, day, hour, minute, tzinfo=RUNNING_TIMEZONE
    ).astimezone(UTC)


def _get_month(client: Any, month: str) -> dict[str, Any]:
    response = client.get(MONTH_SUMMARY_URL, params={"month": month})
    assert response.status_code == 200, response.text
    return response.json()


def _calendar_by_day(payload: dict[str, Any]) -> dict[str, list[str]]:
    return {day["date"]: day["types"] for day in payload["calendar"]}


def _type_summary(payload: dict[str, Any], sport_type: str) -> dict[str, Any]:
    for entry in payload["by_type"]:
        if entry["type"] == sport_type:
            return entry
    raise AssertionError(f"sport type {sport_type} missing from by_type")


def test_late_local_evening_run_buckets_to_its_local_day(db_engine, user, client):
    """R9: a 22:10-local run belongs to the local day, not UTC's next day.

    2026-03-10 22:10 local (UTC-3) is 2026-03-11 01:10 UTC. A UTC-keyed summary
    would report the run on 03-11 (and mark the wrong month cell).
    """
    _seed_activity(
        db_engine, user.id, timestamp=_local(2026, 3, 10, 22, 10), sport_type="Run"
    )

    body = _get_month(client, "2026-03")

    calendar = _calendar_by_day(body)
    assert calendar["2026-03-10"] == ["Run"]
    assert calendar["2026-03-11"] == []
    assert _type_summary(body, "Run")["dot_days"] == ["2026-03-10"]


def test_month_day_keys_follow_the_local_calendar_for_every_type(
    db_engine, user, client
):
    """calendar and dot_days agree on the same local day for run and non-run rows."""
    _seed_activity(
        db_engine, user.id, timestamp=_local(2026, 3, 10, 22, 10), sport_type="Run"
    )
    _seed_activity(
        db_engine, user.id, timestamp=_local(2026, 3, 20, 23, 30), sport_type="Ride"
    )

    body = _get_month(client, "2026-03")

    calendar = _calendar_by_day(body)
    assert calendar["2026-03-10"] == ["Run"]
    assert calendar["2026-03-20"] == ["Ride"]
    # 2026-03-21 02:30 UTC — the UTC day must stay empty.
    assert calendar["2026-03-21"] == []
    assert _type_summary(body, "Run")["dot_days"] == ["2026-03-10"]
    assert _type_summary(body, "Ride")["dot_days"] == ["2026-03-20"]


def test_late_local_run_on_the_last_day_stays_in_its_own_month(db_engine, user, client):
    """R9: a 22:00-local run on the last day belongs to that local month.

    2026-03-31 22:00 local is 2026-04-01 01:00 UTC, so a UTC-anchored window
    dropped it from March (its ``calendar`` and ``dot_days`` lost the run) while
    April, whose window opened at 00:00 UTC, pulled it in under the
    out-of-month key ``2026-03-31``.
    """
    _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 3, 31, 22, 0),
        sport_type="Run",
    )

    march = _get_month(client, "2026-03")
    assert _calendar_by_day(march)["2026-03-31"] == ["Run"]
    assert _type_summary(march, "Run")["dot_days"] == ["2026-03-31"]

    april = _get_month(client, "2026-04")
    assert [entry["type"] for entry in april["by_type"]] == []
    assert all(day["types"] == [] for day in april["calendar"])


def test_previous_month_late_local_run_does_not_leak_into_the_next_month(
    db_engine, user, client
):
    """R9: a 22:00-local run on Feb 28 must not appear in March.

    2026-02-28 22:00 local is 2026-03-01 01:00 UTC, inside the UTC-anchored
    March window — which reported it as an out-of-month ``2026-02-28`` key.
    """
    _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 2, 28, 22, 0),
        sport_type="Run",
    )

    march = _get_month(client, "2026-03")
    assert [entry["type"] for entry in march["by_type"]] == []
    assert all(day["types"] == [] for day in march["calendar"])

    february = _get_month(client, "2026-02")
    assert _calendar_by_day(february)["2026-02-28"] == ["Run"]
    assert _type_summary(february, "Run")["dot_days"] == ["2026-02-28"]


def test_early_local_run_on_the_first_day_stays_in_its_own_month(
    db_engine, user, client
):
    """R9: 00:30 local on the 1st is 03:30 UTC the same day, inside the month."""
    _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 3, 1, 0, 30),
        sport_type="Run",
    )

    march = _get_month(client, "2026-03")
    assert _calendar_by_day(march)["2026-03-01"] == ["Run"]
    assert _type_summary(march, "Run")["dot_days"] == ["2026-03-01"]

    february = _get_month(client, "2026-02")
    assert [entry["type"] for entry in february["by_type"]] == []


def test_month_counters_match_the_local_month_window(db_engine, user, client):
    """total_activities/coverage count exactly the rows inside the local month.

    One run late on the last local day (outside a UTC-anchored window) and one
    on the first local day must both be counted: 2 activities, half with a
    ``sport_type``.
    """
    _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 3, 31, 22, 0),
        sport_type="Run",
    )
    _seed_activity(
        db_engine,
        user.id,
        timestamp=_local(2026, 3, 1, 0, 30),
        sport_type=None,
    )

    march = _get_month(client, "2026-03")

    assert march["total_activities"] == 2
    assert march["coverage"] == 0.5
    assert _calendar_by_day(march)["2026-03-31"] == ["Run"]
    assert _calendar_by_day(march)["2026-03-01"] == ["Other"]


def test_local_day_derivation_is_host_timezone_independent():
    """A naive (SQLite round-trip) timestamp is pinned to UTC before converting.

    Reading the naive wall clock as the host zone would make the bucket depend
    on the machine running the server; pinning it to UTC makes the derivation
    deterministic for every host.
    """
    naive_utc = datetime(2026, 3, 11, 1, 10)  # = 2026-03-10 22:10 local
    aware_utc = datetime(2026, 3, 11, 1, 10, tzinfo=UTC)

    assert _as_local_date(naive_utc) == date(2026, 3, 10)
    assert _as_local_date(aware_utc) == date(2026, 3, 10)
