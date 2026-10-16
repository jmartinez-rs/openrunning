"""HTTP contract tests for the VDOT recalibration endpoints (R18-R21, R28, D0, E11, E12).

These tests exercise the REAL HTTP layer through ``fastapi.testclient.TestClient``
(routing, ``response_model`` serialization, 422 validation and dependency-injected
auth/ownership), never the handler functions directly.
"""

import datetime as dt
import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
from sqlmodel import Session, select

from app.api.deps import get_db
from app.api.routes.running_plans import lock_plan_for_update, plan_lock_statement
from app.main import app
from app.models import (
    Activity,
    ActivityCardio,
    AthleteBaseline,
    BaselineData,
    PlanRecalibration,
    PlanValidationIssue,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
)
from app.services.plan_calendar import week_start_offset
from app.services.running import RUNNING_TIMEZONE
from app.services.running_math import get_training_paces_seconds

BASE = "/api/v1/running-plans"
TODAY = datetime.now(RUNNING_TIMEZONE).date()
WEEK_START_DAY = 1


# ---------------------------------------------------------------------------
# Seeding helpers (short-lived sessions: never hold a transaction across a request)
# ---------------------------------------------------------------------------


def _monday_of(day: dt.date) -> dt.date:
    return day - dt.timedelta(days=week_start_offset(day.isoweekday(), WEEK_START_DAY))


def _current_week_then_future() -> list[dt.date]:
    """Week 1 = the CURRENT week, weeks 2-4 = future weeks."""
    monday = _monday_of(TODAY)
    return [monday + dt.timedelta(days=7 * index) for index in range(4)]


def _all_past_weeks() -> list[dt.date]:
    monday = _monday_of(TODAY)
    return [monday - dt.timedelta(days=7 * (4 - index)) for index in range(4)]


def _baseline(vdot: float = 45.0) -> dict:
    return AthleteBaseline(
        weekly_km=BaselineData(value=40.0, confidence="measured"),
        longest_run_km=BaselineData(value=16.0, confidence="measured"),
        vdot=BaselineData(value=vdot, confidence="measured"),
        runs_per_week=BaselineData(value=4.0, confidence="measured"),
    ).model_dump()


def _seed_plan(
    engine,
    user_id: uuid.UUID,
    *,
    week_starts: list[dt.date],
    baseline_vdot: float = 45.0,
    with_baseline: bool = True,
) -> dict:
    paces = get_training_paces_seconds(baseline_vdot)
    with Session(engine) as session:
        plan = RunningPlan(
            user_id=user_id,
            name="Plan 21.1K",
            distance_km=21.1,
            target_time_seconds=5700,
            start_date=week_starts[0],
            week_start_day=WEEK_START_DAY,
            status="active",
            engine_version="v3",
            baseline=_baseline(baseline_vdot) if with_baseline else None,
            generation_params={
                "goal_type": "time",
                "confidence": "measured",
                "conservative_mode": False,
                "target_km": 21.1,
                "num_weeks": len(week_starts),
            },
        )
        session.add(plan)
        session.flush()
        phase = RunningPhase(
            plan_id=plan.id, position=1, name="Base", start_week=1, end_week=len(week_starts)
        )
        session.add(phase)
        session.flush()
        workout_ids: list[str] = []
        for number, start in enumerate(week_starts, start=1):
            week = RunningWeek(
                phase_id=phase.id,
                number=number,
                start_date=start,
                end_date=start + dt.timedelta(days=6),
            )
            session.add(week)
            session.flush()
            workout = RunningWorkout(
                week_id=week.id,
                plan_id=plan.id,
                date=start + dt.timedelta(days=2),
                type="easy_run",
                intensity="easy",
                distance_km=8.0,
                pace_seconds_per_km=paces["easy_min"],
            )
            session.add(workout)
            session.flush()
            workout_ids.append(str(workout.id))
        session.commit()
        return {"plan_id": str(plan.id), "workout_ids": workout_ids}


def _seed_activity(
    engine,
    user_id: uuid.UUID,
    *,
    days_ago: int = 10,
    distance_meters: float = 10000.0,
    duration_seconds: int = 2400,
) -> str:
    with Session(engine) as session:
        activity = Activity(
            source_id=str(uuid.uuid4()),
            source_type="strava",
            timestamp=datetime.now(UTC) - timedelta(days=days_ago),
            duration_seconds=duration_seconds,
            user_id=user_id,
        )
        session.add(activity)
        session.flush()
        session.add(
            ActivityCardio(activity_id=activity.id, distance_meters=distance_meters)
        )
        session.commit()
        return str(activity.id)


def _link_test_mark(engine, plan_id: str, activity_id: str) -> None:
    with Session(engine) as session:
        plan = session.get(RunningPlan, uuid.UUID(plan_id))
        week = session.exec(
            select(RunningWeek)
            .join(RunningPhase)
            .where(RunningPhase.plan_id == plan.id)
            .order_by(RunningWeek.number)  # type: ignore[arg-type]
        ).first()
        session.add(
            RunningWorkout(
                week_id=week.id,
                plan_id=plan.id,
                date=week.start_date + dt.timedelta(days=1),
                type="test",
                intensity="moderate",
                distance_km=10.0,
                pace_seconds_per_km=300.0,
                matched_activity_id=uuid.UUID(activity_id),
            )
        )
        session.commit()


def _add_recalibration_row(
    engine,
    plan_id: str,
    user_id: uuid.UUID,
    *,
    new_vdot: float,
    source: str = "manual",
    created_at: datetime | None = None,
) -> str:
    with Session(engine) as session:
        row = PlanRecalibration(
            plan_id=uuid.UUID(plan_id),
            user_id=user_id,
            source=source,  # type: ignore[arg-type]
            old_vdot=45.0,
            new_vdot=new_vdot,
            delta_vdot=round(new_vdot - 45.0, 1),
            old_paces={"threshold": 300.0},
            new_paces={"threshold": 297.0},
            kind="improve" if new_vdot >= 45.0 else "decline",
            effective_from_week=2,
            effective_from_date=TODAY + dt.timedelta(days=7),
            created_at=created_at or datetime(2026, 10, 11, 12, tzinfo=UTC),
        )
        session.add(row)
        session.commit()
        return str(row.id)


def _set_baseline(engine, plan_id: str, baseline: dict) -> None:
    with Session(engine) as session:
        plan = session.get(RunningPlan, uuid.UUID(plan_id))
        plan.baseline = baseline
        session.add(plan)
        session.commit()


def _set_workout_type(engine, workout_id: str, workout_type: str) -> None:
    """Corrupt one stored workout type (the column is an unconstrained String(32))."""
    with Session(engine) as session:
        workout = session.get(RunningWorkout, uuid.UUID(workout_id))
        workout.type = workout_type
        session.add(workout)
        session.commit()


def _workout_paces(engine, plan_id: str) -> dict[str, float | None]:
    with Session(engine) as session:
        workouts = session.exec(
            select(RunningWorkout).where(RunningWorkout.plan_id == uuid.UUID(plan_id))
        ).all()
        return {str(workout.id): workout.pace_seconds_per_km for workout in workouts}


def _history(engine, plan_id: str) -> list[PlanRecalibration]:
    with Session(engine) as session:
        return list(
            session.exec(
                select(PlanRecalibration).where(
                    PlanRecalibration.plan_id == uuid.UUID(plan_id)
                )
            ).all()
        )


# ---------------------------------------------------------------------------
# T10 — routing, response_model, 422, auth/ownership
# ---------------------------------------------------------------------------


def test_preview_returns_the_payload_over_http(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={"new_vdot": 47})

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["vdot"] == 47.0
    assert payload["new_vdot"] == 47.0
    assert payload["old_vdot"] == 45.0
    assert payload["delta_vdot"] == 2.0
    assert payload["kind"] == "improve"
    assert payload["recommend_fitness_test"] is False
    assert payload["current_vdot"] == 45.0
    assert payload["current_vdot_source"] == "baseline"
    assert payload["effective_from_week"] == 2
    assert payload["affected_weeks"] == [2, 3, 4]
    assert len(payload["changes"]) == 3
    assert set(payload["new_paces"]) == {
        "easy_min",
        "easy_max",
        "marathon",
        "threshold",
        "interval",
        "repetition",
    }


def test_preview_does_not_mutate_the_plan(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    before = _workout_paces(db_engine, seed["plan_id"])

    client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={"new_vdot": 47})

    assert _workout_paces(db_engine, seed["plan_id"]) == before
    assert _history(db_engine, seed["plan_id"]) == []


def test_routes_return_404_for_a_foreign_or_missing_plan(client, db_engine, user):
    with Session(db_engine) as session:
        intruder = User(email="intruder@example.com", hashed_password="x", is_active=True)
        session.add(intruder)
        session.commit()
        session.refresh(intruder)
        intruder_id = intruder.id
    foreign = _seed_plan(db_engine, intruder_id, week_starts=_current_week_then_future())
    missing = uuid.uuid4()

    foreign_calls = [
        client.post(f"{BASE}/{foreign['plan_id']}/recalibrate/preview", json={"new_vdot": 47}),
        client.post(f"{BASE}/{foreign['plan_id']}/recalibrate", json={"new_vdot": 47, "confirm": True}),
        client.get(f"{BASE}/{foreign['plan_id']}/recalibrations"),
    ]
    missing_calls = [
        client.post(f"{BASE}/{missing}/recalibrate/preview", json={"new_vdot": 47}),
        client.post(f"{BASE}/{missing}/recalibrate", json={"new_vdot": 47, "confirm": True}),
        client.get(f"{BASE}/{missing}/recalibrations"),
    ]

    assert [resp.status_code for resp in foreign_calls] == [404, 404, 404]
    assert [resp.status_code for resp in missing_calls] == [404, 404, 404]


def test_routes_return_422_for_invalid_body_or_path(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    out_of_range = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={"new_vdot": 10}
    )
    wrong_type = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": "abc", "confirm": True}
    )
    bad_path = client.get(f"{BASE}/not-a-uuid/recalibrations")

    assert out_of_range.status_code == 422
    assert wrong_type.status_code == 422
    assert bad_path.status_code == 422


def test_routes_reject_unauthenticated_requests(db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    def _get_test_db():
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    try:
        unauthenticated = TestClient(app)
        resp = unauthenticated.post(
            f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={"new_vdot": 47}
        )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 401


def test_history_is_paginated_ordered_and_reports_current_vdot(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    _add_recalibration_row(
        db_engine, seed["plan_id"], user.id, new_vdot=46.0, created_at=datetime(2026, 10, 11, tzinfo=UTC)
    )
    _add_recalibration_row(
        db_engine, seed["plan_id"], user.id, new_vdot=48.0, created_at=datetime(2026, 10, 13, tzinfo=UTC)
    )

    resp = client.get(f"{BASE}/{seed['plan_id']}/recalibrations", params={"skip": 0, "limit": 1})

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["count"] == 2
    assert len(payload["data"]) == 1
    assert payload["data"][0]["new_vdot"] == 48.0
    assert payload["current_vdot"] == 48.0
    assert payload["current_vdot_source"] == "manual"


def test_history_rejects_out_of_range_pagination(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    url = f"{BASE}/{seed['plan_id']}/recalibrations"

    negative_skip = client.get(url, params={"skip": -1})
    zero_limit = client.get(url, params={"limit": 0})
    over_max = client.get(url, params={"limit": 101})

    assert negative_skip.status_code == 422
    assert zero_limit.status_code == 422
    assert over_max.status_code == 422
    # The bounded extremes remain valid.
    assert client.get(url, params={"skip": 0, "limit": 100}).status_code == 200
    assert client.get(url, params={"skip": 0, "limit": 20}).status_code == 200


# ---------------------------------------------------------------------------
# T11 — source resolution (test / activity / manual) and no-500
# ---------------------------------------------------------------------------


def test_preview_source_is_manual_when_new_vdot_is_explicit(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={"new_vdot": 47})

    assert resp.json()["source"] == "manual"


def test_preview_source_is_test_when_a_fitness_test_mark_is_recent(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    activity_id = _seed_activity(db_engine, user.id, days_ago=10)
    _link_test_mark(db_engine, seed["plan_id"], activity_id)

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={})

    payload = resp.json()
    assert resp.status_code == 200
    assert payload["source"] == "test"
    assert payload["vdot"] == 51.9
    assert payload["evidence"]["distance_meters"] == 10000.0
    assert payload["evidence"]["confidence"] == "measured"


def test_preview_source_is_activity_when_only_a_synced_run_exists(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    _seed_activity(db_engine, user.id, days_ago=5)

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={})

    payload = resp.json()
    assert resp.status_code == 200
    assert payload["source"] == "activity"
    assert payload["evidence"]["confidence"] == "estimated"


def test_apply_with_explicit_new_vdot_persists_manual_source_without_500(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    resp = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 46, "confirm": True}
    )

    assert resp.status_code == 200
    assert resp.json()["recalibration"]["source"] == "manual"
    rows = _history(db_engine, seed["plan_id"])
    assert len(rows) == 1
    assert rows[0].source == "manual"


def test_apply_maps_a_missing_baseline_to_409_not_500(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future(), with_baseline=False)
    _add_recalibration_row(db_engine, seed["plan_id"], user.id, new_vdot=46.0)

    resp = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 47, "confirm": True}
    )

    assert resp.status_code == 409
    assert resp.json()["detail"] == "plan_has_no_baseline"


def test_apply_maps_a_malformed_baseline_to_409_not_500(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future(), with_baseline=False)
    _set_baseline(db_engine, seed["plan_id"], {"vdot": {"value": 45.0, "confidence": "measured"}})
    _add_recalibration_row(db_engine, seed["plan_id"], user.id, new_vdot=46.0)

    resp = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 47, "confirm": True}
    )

    assert resp.status_code == 409


def test_preview_maps_malformed_stored_workout_data_to_409_not_500(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    _set_workout_type(db_engine, seed["workout_ids"][1], "fartlek")

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={"new_vdot": 47})

    assert resp.status_code == 409
    assert resp.json()["detail"] == "invalid_plan_data"


def test_apply_maps_malformed_stored_workout_data_to_409_not_500(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    _set_workout_type(db_engine, seed["workout_ids"][1], "fartlek")

    resp = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 46, "confirm": True}
    )

    assert resp.status_code == 409
    assert resp.json()["detail"] == "invalid_plan_data"
    assert _history(db_engine, seed["plan_id"]) == []


# ---------------------------------------------------------------------------
# T12 — preview check precedence (D0 / S7 / E12)
# ---------------------------------------------------------------------------


def test_preview_returns_409_no_future_week_when_all_weeks_elapsed(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_all_past_weeks())

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={"new_vdot": 47})

    assert resp.status_code == 409
    assert resp.json()["detail"] == "no_future_week"


def test_preview_returns_409_plan_has_no_baseline_when_no_current_vdot(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future(), with_baseline=False)

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={"new_vdot": 47})

    assert resp.status_code == 409
    assert resp.json()["detail"] == "plan_has_no_baseline"


def test_preview_returns_200_vdot_null_when_no_evidence_is_available(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={})

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["vdot"] is None
    assert payload["recommend_fitness_test"] is True
    assert payload["current_vdot"] == 45.0


def test_preview_prefers_no_future_week_over_no_evidence(client, db_engine, user):
    # Co-occurring: no future weeks AND no evidence -> the earliest check wins.
    seed = _seed_plan(db_engine, user.id, week_starts=_all_past_weeks())

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate/preview", json={})

    assert resp.status_code == 409
    assert resp.json()["detail"] == "no_future_week"


# ---------------------------------------------------------------------------
# T13 — apply-path gate order (normative) and two distinct flags (R28 / S5 / E11)
# ---------------------------------------------------------------------------


def test_apply_requires_confirm_before_any_plan_state_check(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_all_past_weeks())

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 47})

    assert resp.status_code == 409
    assert resp.json()["detail"] == "confirmation_required"


def test_apply_returns_409_no_future_week_after_confirm(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_all_past_weeks())

    resp = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 47, "confirm": True}
    )

    assert resp.status_code == 409
    assert resp.json()["detail"] == "no_future_week"


def test_apply_returns_409_plan_has_no_baseline_after_future_week(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future(), with_baseline=False)

    resp = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 47, "confirm": True}
    )

    assert resp.status_code == 409
    assert resp.json()["detail"] == "plan_has_no_baseline"


def test_apply_returns_409_no_evidence_without_a_target(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    resp = client.post(f"{BASE}/{seed['plan_id']}/recalibrate", json={"confirm": True})

    assert resp.status_code == 409
    assert resp.json()["detail"] == "no_evidence"


def test_apply_requires_acknowledge_risk_for_a_suspicious_jump(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    unacked = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 48, "confirm": True}
    )
    acked = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate",
        json={"new_vdot": 48, "confirm": True, "acknowledge_risk": True},
    )

    assert unacked.status_code == 409
    assert unacked.json()["detail"] == "risk_acknowledgement_required"
    assert acked.status_code == 200
    assert acked.json()["suspicious"] is True


def test_apply_requires_acknowledge_risk_for_a_decline(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    unacked = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 43, "confirm": True}
    )
    acked = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate",
        json={"new_vdot": 43, "confirm": True, "acknowledge_risk": True},
    )

    assert unacked.status_code == 409
    assert unacked.json()["detail"] == "risk_acknowledgement_required"
    assert acked.status_code == 200
    assert acked.json()["kind"] == "decline"


def test_apply_recalibrates_future_weeks_and_persists_a_row(client, db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    before = _workout_paces(db_engine, seed["plan_id"])
    new_paces = get_training_paces_seconds(46.0)

    resp = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 46, "confirm": True}
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["recalibration"]["affected_workouts"] == 3
    assert payload["recalibration"]["new_paces"] == new_paces

    after = _workout_paces(db_engine, seed["plan_id"])
    # The current week (workout #1) is never rewritten; the future weeks are.
    assert after[seed["workout_ids"][0]] == before[seed["workout_ids"][0]]
    assert after[seed["workout_ids"][1]] == new_paces["easy_min"]
    assert after[seed["workout_ids"][2]] == new_paces["easy_min"]
    assert after[seed["workout_ids"][3]] == new_paces["easy_min"]


def test_apply_rejects_a_new_invariant_issue_with_rollback_and_a_structured_log(
    client, db_engine, user, monkeypatch, caplog
):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())
    before = _workout_paces(db_engine, seed["plan_id"])

    import app.api.routes.running_plans as routes_module

    calls = {"count": 0}

    def fake_validate(plan, config):
        calls["count"] += 1
        if calls["count"] == 1:
            return []
        return [
            PlanValidationIssue(
                code="DUPLICATE_WORKOUT_DATES",
                severity="error",
                message="injected by the test",
                details={"date": "2030-01-01"},
            )
        ]

    monkeypatch.setattr(routes_module, "validate_plan_invariants", fake_validate)

    with caplog.at_level(logging.WARNING, logger="app.api.routes.running_plans"):
        resp = client.post(
            f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 46, "confirm": True}
        )

    assert resp.status_code == 409
    assert resp.json()["detail"] == "plan_invariant_violation"
    assert calls["count"] == 2
    assert "plan_invariant_violation" in caplog.text
    assert seed["plan_id"] in caplog.text
    # Rollback: no pace moved and no audit row was persisted.
    assert _workout_paces(db_engine, seed["plan_id"]) == before
    assert _history(db_engine, seed["plan_id"]) == []


# ---------------------------------------------------------------------------
# Row locking (concurrent applies must not lose updates)
# ---------------------------------------------------------------------------


def test_plan_lock_statement_emits_for_update_on_postgres():
    statement = plan_lock_statement(uuid.uuid4())
    sql = str(statement.compile(dialect=postgresql.dialect()))

    assert "FOR UPDATE" in sql


def test_lock_plan_for_update_returns_the_plan(db_engine, user):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    with Session(db_engine) as session:
        plan = session.get(RunningPlan, uuid.UUID(seed["plan_id"]))
        assert lock_plan_for_update(session, plan) is plan


def test_apply_takes_a_plan_row_lock(client, db_engine, user, monkeypatch):
    seed = _seed_plan(db_engine, user.id, week_starts=_current_week_then_future())

    import app.api.routes.running_plans as routes_module

    locked: list[uuid.UUID] = []
    original = routes_module.lock_plan_for_update

    def spy(session, plan):
        locked.append(plan.id)
        return original(session, plan)

    monkeypatch.setattr(routes_module, "lock_plan_for_update", spy)

    resp = client.post(
        f"{BASE}/{seed['plan_id']}/recalibrate", json={"new_vdot": 46, "confirm": True}
    )

    assert resp.status_code == 200
    assert locked == [uuid.UUID(seed["plan_id"])]
