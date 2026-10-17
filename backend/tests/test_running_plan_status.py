"""Tests para el cambio de estado de planes y regla de único plan activo."""

import datetime as dt
import uuid
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.models import (
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
)

BASE = "/api/v1/running-plans"


def _create_minimal_plan(engine, user_id: uuid.UUID, name: str, status: str = "active") -> RunningPlan:
    with Session(engine) as session:
        today = dt.date.today()
        plan = RunningPlan(
            user_id=user_id,
            name=name,
            distance_km=10.0,
            start_date=today,
            status=status,
            week_start_day=1,
            engine_version="v2",
        )
        session.add(plan)
        session.flush()

        phase = RunningPhase(
            plan_id=plan.id,
            position=1,
            name="Fase 1",
            start_week=1,
            end_week=1,
        )
        session.add(phase)
        session.flush()

        week = RunningWeek(
            phase_id=phase.id,
            number=1,
            start_date=today,
            end_date=today + dt.timedelta(days=6),
        )
        session.add(week)
        session.flush()

        workout = RunningWorkout(
            week_id=week.id,
            plan_id=plan.id,
            date=today,
            type="easy_run",
            intensity="easy",
            distance_km=5.0,
        )
        session.add(workout)
        session.commit()
        session.refresh(plan)
        return plan


def test_patch_plan_status_to_completed(client, db_engine, user: User):
    plan = _create_minimal_plan(db_engine, user.id, "Plan Activo", status="active")

    res = client.patch(f"{BASE}/{plan.id}", json={"status": "completed"})
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["id"] == str(plan.id)
    assert data["status"] == "completed"

    with Session(db_engine) as session:
        refreshed = session.get(RunningPlan, plan.id)
        assert refreshed.status == "completed"


def test_only_one_active_plan_enforced_on_status_patch(client, db_engine, user: User):
    plan1 = _create_minimal_plan(db_engine, user.id, "Plan 1", status="active")
    plan2 = _create_minimal_plan(db_engine, user.id, "Plan 2", status="completed")

    # Activar plan 2
    res = client.patch(f"{BASE}/{plan2.id}", json={"status": "active"})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "active"

    # Plan 1 debe haber pasado automáticamente a completed
    with Session(db_engine) as session:
        refreshed1 = session.get(RunningPlan, plan1.id)
        refreshed2 = session.get(RunningPlan, plan2.id)
        assert refreshed1.status == "completed"
        assert refreshed2.status == "active"


def test_only_one_active_plan_enforced_on_create(client, db_engine, user: User):
    plan1 = _create_minimal_plan(db_engine, user.id, "Plan Existente", status="active")
    today = dt.date.today()

    new_plan_payload = {
        "name": "Nuevo Plan Activo",
        "distance_km": 15.0,
        "distance_unit": "km",
        "start_date": today.isoformat(),
        "week_start_day": 1,
        "status": "active",
        "phases": [
            {
                "position": 1,
                "name": "Fase Base",
                "start_week": 1,
                "end_week": 1,
                "weeks": [
                    {
                        "number": 1,
                        "start_date": today.isoformat(),
                        "end_date": (today + dt.timedelta(days=6)).isoformat(),
                        "workouts": [
                            {
                                "date": today.isoformat(),
                                "type": "easy_run",
                                "intensity": "easy",
                                "distance_km": 5.0,
                                "blocks": [],
                            }
                        ],
                    }
                ],
            }
        ],
    }

    res = client.post(BASE, json=new_plan_payload)
    assert res.status_code == 201, res.text
    created = res.json()
    assert created["status"] == "active"

    # El plan anterior debe haber pasado a completed
    with Session(db_engine) as session:
        refreshed1 = session.get(RunningPlan, plan1.id)
        refreshed2 = session.get(RunningPlan, uuid.UUID(created["id"]))
        assert refreshed1.status == "completed"
        assert refreshed2.status == "active"


def test_read_plans_auto_heals_multiple_active_plans(client, db_engine, user: User):
    # Simular base de datos corrupta con 2 planes activos
    with Session(db_engine) as session:
        today = dt.date.today()
        p1 = RunningPlan(
            user_id=user.id,
            name="Plan Viejo",
            distance_km=10.0,
            start_date=today,
            status="active",
            created_at=datetime(2025, 1, 1, tzinfo=UTC),
            updated_at=datetime(2025, 1, 1, tzinfo=UTC),
        )
        p2 = RunningPlan(
            user_id=user.id,
            name="Plan Reciente",
            distance_km=10.0,
            start_date=today,
            status="active",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
            updated_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        session.add(p1)
        session.add(p2)
        session.commit()
        p1_id, p2_id = p1.id, p2.id

    res = client.get(BASE)
    assert res.status_code == 200, res.text
    data = res.json()["data"]

    active = [p for p in data if p["status"] == "active"]
    assert len(active) == 1
    assert active[0]["id"] == str(p2_id)

    with Session(db_engine) as session:
        refreshed1 = session.get(RunningPlan, p1_id)
        refreshed2 = session.get(RunningPlan, p2_id)
        assert refreshed1.status == "completed"
        assert refreshed2.status == "active"
