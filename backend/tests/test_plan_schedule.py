"""Unit and integration tests for plan pauses and holiday schedule shifts (M4)."""

import datetime as dt
import uuid

import pytest
from conftest import sqlite_session as _session
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models import (
    PlanPause,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
)
from app.services.plan_schedule import (
    apply_pause_shift,
    preview_pause_shift,
)

BASE = "/api/v1/running-plans"


def _create_test_plan(session: Session, user: User) -> RunningPlan:
    plan = RunningPlan(
        user_id=user.id,
        name="Plan Pause Test",
        goal="Objetivo 10K",
        distance_km=10.0,
        start_date=dt.date(2026, 10, 12),
        end_date=dt.date(2026, 11, 22),
        week_start_day=1,
        status="active",
        engine_version="v3",
    )
    session.add(plan)
    session.flush()

    phase = RunningPhase(
        plan_id=plan.id,
        position=1,
        name="Fase 1",
        color="emerald",
        start_week=1,
        end_week=6,
    )
    session.add(phase)
    session.flush()

    for w_num in range(1, 7):
        w_start = dt.date(2026, 10, 12) + dt.timedelta(weeks=w_num - 1)
        w_end = w_start + dt.timedelta(days=6)
        week = RunningWeek(
            phase_id=phase.id,
            number=w_num,
            start_date=w_start,
            end_date=w_end,
            name=f"Semana {w_num}",
        )
        session.add(week)
        session.flush()

        # Add workouts on Wed and Sun
        session.add(
            RunningWorkout(
                week_id=week.id,
                plan_id=plan.id,
                date=w_start + dt.timedelta(days=2),  # Wed
                type="intervals",
                distance_km=6.0,
                intensity="hard",
            )
        )
        session.add(
            RunningWorkout(
                week_id=week.id,
                plan_id=plan.id,
                date=w_start + dt.timedelta(days=6),  # Sun
                type="long_run",
                distance_km=12.0,
                intensity="moderate",
            )
        )
    session.flush()
    return plan


def test_preview_pause_shift(db_engine, user):
    with Session(db_engine) as session:
        plan = _create_test_plan(session, user)

        # Pause 10 days (from Oct 26 to Nov 4) -> 2 full weeks = 14 days shift
        preview = preview_pause_shift(
            session=session,
            plan=plan,
            pause_start=dt.date(2026, 10, 26),
            pause_end=dt.date(2026, 11, 4),
            reason="Vacaciones de verano",
        )

        assert preview.shift_days == 14
        assert preview.original_end_date == dt.date(2026, 11, 22)
        assert preview.new_end_date == dt.date(2026, 12, 6)
        assert preview.affected_workouts_count == 8
        assert preview.reason == "Vacaciones de verano"


def test_preview_pause_invalid_dates(db_engine, user):
    with Session(db_engine) as session:
        plan = _create_test_plan(session, user)
        with pytest.raises(ValueError, match="posterior o igual"):
            preview_pause_shift(
                session=session,
                plan=plan,
                pause_start=dt.date(2026, 11, 10),
                pause_end=dt.date(2026, 11, 5),
            )


def test_apply_pause_shift(db_engine, user):
    with Session(db_engine) as session:
        plan = _create_test_plan(session, user)

        # 1-week pause from Oct 26 to Nov 1 -> shift 7 days
        pause_rec = apply_pause_shift(
            session=session,
            plan=plan,
            user_id=user.id,
            pause_start=dt.date(2026, 10, 26),
            pause_end=dt.date(2026, 11, 1),
            reason="Viaje de trabajo",
        )
        session.commit()

        assert pause_rec.shifted_days == 7
        assert pause_rec.reason == "Viaje de trabajo"
        assert plan.end_date == dt.date(2026, 11, 29)

        # Verify workouts: week 2 Sun (Oct 25) did NOT shift
        w_oct25 = session.exec(
            select(RunningWorkout).where(
                RunningWorkout.plan_id == plan.id,
                RunningWorkout.date == dt.date(2026, 10, 25),
            )
        ).first()
        assert w_oct25 is not None

        # Week 3 Wed (originally Oct 28) shifted +7 to Nov 4
        w_nov4 = session.exec(
            select(RunningWorkout).where(
                RunningWorkout.plan_id == plan.id,
                RunningWorkout.date == dt.date(2026, 11, 4),
            )
        ).first()
        assert w_nov4 is not None

        # Verify pause audit record persisted
        records = session.exec(
            select(PlanPause).where(PlanPause.plan_id == plan.id)
        ).all()
        assert len(records) == 1
        assert records[0].shifted_days == 7


def test_pause_api_endpoints(client, db_engine, user):
    with Session(db_engine) as session:
        plan = _create_test_plan(session, user)
        session.commit()
        plan_id = str(plan.id)

    # 1. Preview
    resp = client.post(
        f"{BASE}/{plan_id}/pause/preview",
        json={
            "start_date": "2026-10-26",
            "end_date": "2026-11-01",
            "reason": "Descanso programado",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["shift_days"] == 7
    assert data["affected_workouts_count"] == 8

    # 2. Apply without confirm
    resp = client.post(
        f"{BASE}/{plan_id}/pause/apply",
        json={
            "start_date": "2026-10-26",
            "end_date": "2026-11-01",
            "confirm": False,
        },
    )
    assert resp.status_code == 400

    # 3. Apply with confirm
    resp = client.post(
        f"{BASE}/{plan_id}/pause/apply",
        json={
            "start_date": "2026-10-26",
            "end_date": "2026-11-01",
            "reason": "Descanso programado",
            "confirm": True,
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["shifted_days"] == 7
    assert data["reason"] == "Descanso programado"

    # 4. List pauses
    resp = client.get(f"{BASE}/{plan_id}/pauses")
    assert resp.status_code == 200, resp.text
    history = resp.json()
    assert history["count"] == 1
    assert history["data"][0]["shifted_days"] == 7
