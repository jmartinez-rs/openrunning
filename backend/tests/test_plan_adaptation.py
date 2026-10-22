"""Unit and integration tests for dynamic plan adaptations (M2: rules R1 to R5)."""

import datetime as dt
import uuid

import pytest
from conftest import sqlite_session as _session
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models import (
    Activity,
    ActivityCardio,
    AthleteBaseline,
    BaselineData,
    PlanAdaptation,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
    WorkoutBlock,
)
from app.services.plan_adaptation import (
    apply_plan_adaptations,
    evaluate_plan_adaptations,
)

BASE = "/api/v1/running-plans"
TEST_DATE = dt.date(2026, 10, 20)  # Tuesday


def _create_test_plan(session: Session, user: User) -> RunningPlan:
    plan = RunningPlan(
        user_id=user.id,
        name="Plan Adaptativo 10K",
        goal="Objetivo 10K",
        distance_km=10.0,
        start_date=dt.date(2026, 10, 12),
        end_date=dt.date(2026, 11, 22),
        week_start_day=1,
        status="active",
        engine_version="v3",
        baseline={"vdot": {"value": 40.0, "confidence": "measured"}},
        generation_params={"target_km": 10.0, "num_weeks": 6},
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

    # Week 1: 2026-10-12 to 2026-10-18 (Evaluated past week)
    week1 = RunningWeek(
        phase_id=phase.id,
        number=1,
        start_date=dt.date(2026, 10, 12),
        end_date=dt.date(2026, 10, 18),
        name="Semana 1",
    )
    session.add(week1)
    session.flush()

    # Week 2: 2026-10-19 to 2026-10-25 (Current/Next week)
    week2 = RunningWeek(
        phase_id=phase.id,
        number=2,
        start_date=dt.date(2026, 10, 19),
        end_date=dt.date(2026, 10, 25),
        name="Semana 2",
    )
    session.add(week2)
    session.flush()

    # Workouts for Week 1 (total 25km)
    w1_easy = RunningWorkout(
        week_id=week1.id,
        plan_id=plan.id,
        date=dt.date(2026, 10, 13),
        type="easy_run",
        distance_km=6.0,
        pace_seconds_per_km=330.0,
        intensity="easy",
        status_override="completed",
    )
    w1_quality = RunningWorkout(
        week_id=week1.id,
        plan_id=plan.id,
        date=dt.date(2026, 10, 15),
        type="intervals",
        distance_km=7.0,
        pace_seconds_per_km=260.0,
        intensity="hard",
        status_override="missed",  # Missed quality!
    )
    w1_lr = RunningWorkout(
        week_id=week1.id,
        plan_id=plan.id,
        date=dt.date(2026, 10, 18),
        type="long_run",
        distance_km=12.0,
        pace_seconds_per_km=330.0,
        intensity="easy",
        status_override="missed",  # Missed long run!
    )
    session.add_all([w1_easy, w1_quality, w1_lr])

    # Workouts for Week 2 (total 30km - planned progression)
    w2_easy = RunningWorkout(
        week_id=week2.id,
        plan_id=plan.id,
        date=dt.date(2026, 10, 20),
        type="easy_run",
        distance_km=7.0,
        pace_seconds_per_km=330.0,
        intensity="easy",
    )
    w2_quality = RunningWorkout(
        week_id=week2.id,
        plan_id=plan.id,
        date=dt.date(2026, 10, 22),
        type="intervals",
        distance_km=8.0,
        pace_seconds_per_km=260.0,
        intensity="hard",
    )
    w2_lr = RunningWorkout(
        week_id=week2.id,
        plan_id=plan.id,
        date=dt.date(2026, 10, 25),
        type="long_run",
        distance_km=15.0,  # Progressed from 12 to 15km
        pace_seconds_per_km=330.0,
        intensity="easy",
    )
    session.add_all([w2_easy, w2_quality, w2_lr])
    session.flush()

    return plan


def test_r1_low_adherence_and_r2_missed_long_run_detection():
    with _session() as session:
        user = User(email="runner1@example.com", hashed_password="pw")
        session.add(user)
        session.flush()

        plan = _create_test_plan(session, user)

        # Evaluate as of 2026-10-20
        suggestions, eval_week = evaluate_plan_adaptations(
            session, plan, today_local=TEST_DATE
        )

        rule_codes = {s.rule_code for s in suggestions}
        assert "R1_LOW_ADHERENCE" in rule_codes
        assert "R2_MISSED_LONG_RUN" in rule_codes


def test_r1_and_r2_apply_adjusts_next_week_workouts():
    with _session() as session:
        user = User(email="runner2@example.com", hashed_password="pw")
        session.add(user)
        session.flush()

        plan = _create_test_plan(session, user)

        adaptations, updated_count = apply_plan_adaptations(
            session,
            plan,
            selected_rule_codes=["R1_LOW_ADHERENCE", "R2_MISSED_LONG_RUN"],
            today_local=TEST_DATE,
        )

        assert len(adaptations) == 2
        assert updated_count > 0

        # Verify audit records were persisted
        rows = session.exec(
            select(PlanAdaptation).where(PlanAdaptation.plan_id == plan.id)
        ).all()
        assert len(rows) == 2


def test_r3_high_perceived_effort_detection_and_apply():
    with _session() as session:
        user = User(email="runner3@example.com", hashed_password="pw")
        session.add(user)
        session.flush()

        plan = _create_test_plan(session, user)

        # Set 2 completed easy runs with high effort notes or RPE
        w1_easy = session.exec(
            select(RunningWorkout)
            .where(RunningWorkout.plan_id == plan.id, RunningWorkout.type == "easy_run")
        ).first()
        assert w1_easy is not None
        w1_easy.status_override = "completed"
        w1_easy.notes = "Sensación muy dura y fatiga acumulada"

        # Add another completed easy run
        w_extra = RunningWorkout(
            week_id=w1_easy.week_id,
            plan_id=plan.id,
            date=dt.date(2026, 10, 16),
            type="easy_run",
            distance_km=5.0,
            pace_seconds_per_km=320.0,
            intensity="easy",
            status_override="completed",
            notes="Agotado, piernas pesadas",
        )
        session.add(w_extra)
        session.flush()

        suggestions, _ = evaluate_plan_adaptations(
            session, plan, today_local=TEST_DATE
        )
        assert any(s.rule_code == "R3_HIGH_PERCEIVED_EFFORT" for s in suggestions)

        # Apply R3
        adaptations, count = apply_plan_adaptations(
            session,
            plan,
            selected_rule_codes=["R3_HIGH_PERCEIVED_EFFORT"],
            today_local=TEST_DATE,
        )
        assert len(adaptations) == 1
        assert count > 0

        # Future easy run should have slowed down by +8s/km
        w2_easy = session.exec(
            select(RunningWorkout)
            .where(RunningWorkout.plan_id == plan.id, RunningWorkout.date == dt.date(2026, 10, 20))
        ).first()
        assert w2_easy is not None
        assert w2_easy.pace_seconds_per_km == 338.0  # 330 + 8


def test_r5_injury_fatigue_detection_and_apply():
    with _session() as session:
        user = User(email="runner5@example.com", hashed_password="pw")
        session.add(user)
        session.flush()

        plan = _create_test_plan(session, user)
        first_week = session.exec(select(RunningWeek)).first()
        assert first_week is not None

        # Add workout with injury mention in notes
        w_injured = RunningWorkout(
            week_id=first_week.id,
            plan_id=plan.id,
            date=dt.date(2026, 10, 14),
            type="easy_run",
            distance_km=4.0,
            pace_seconds_per_km=340.0,
            intensity="easy",
            status_override="completed",
            notes="Tuve que parar a mitad de camino por dolor en el tendón de Aquiles",
        )
        session.add(w_injured)
        session.flush()

        suggestions, _ = evaluate_plan_adaptations(
            session, plan, today_local=TEST_DATE
        )
        assert any(s.rule_code == "R5_INJURY_FATIGUE" for s in suggestions)

        # Apply R5
        adaptations, _ = apply_plan_adaptations(
            session,
            plan,
            selected_rule_codes=["R5_INJURY_FATIGUE"],
            today_local=TEST_DATE,
        )
        assert len(adaptations) == 1

        # Check conservative mode was enabled
        assert plan.generation_params.get("conservative_mode") is True

        # Check future quality in week 2 was converted to regeneration
        w2_q = session.exec(
            select(RunningWorkout)
            .where(RunningWorkout.plan_id == plan.id, RunningWorkout.date == dt.date(2026, 10, 22))
        ).first()
        assert w2_q is not None
        assert w2_q.type == "regeneration"


def test_adaptation_http_endpoints(client, db_engine, user):
    with Session(db_engine) as session:
        plan = _create_test_plan(session, user)
        session.commit()
        plan_id = plan.id

    # 1. Preview
    resp_preview = client.get(f"{BASE}/{plan_id}/adaptation/preview")
    assert resp_preview.status_code == 200
    data_preview = resp_preview.json()
    assert "suggestions" in data_preview
    assert len(data_preview["suggestions"]) >= 1

    # 2. Apply without confirm -> 409
    resp_bad = client.post(
        f"{BASE}/{plan_id}/adaptation/apply",
        json={"selected_rule_codes": ["R1_LOW_ADHERENCE"], "confirm": False},
    )
    assert resp_bad.status_code == 409

    # 3. Apply with confirm -> 200
    resp_apply = client.post(
        f"{BASE}/{plan_id}/adaptation/apply",
        json={"selected_rule_codes": ["R1_LOW_ADHERENCE"], "confirm": True},
    )
    assert resp_apply.status_code == 200
    data_apply = resp_apply.json()
    assert "applied_rules" in data_apply
    assert "R1_LOW_ADHERENCE" in data_apply["applied_rules"]

    # 4. History
    resp_history = client.get(f"{BASE}/{plan_id}/adaptations")
    assert resp_history.status_code == 200
    data_hist = resp_history.json()
    assert data_hist["count"] >= 1
    assert len(data_hist["data"]) >= 1
    assert data_hist["data"][0]["rule_code"] == "R1_LOW_ADHERENCE"

