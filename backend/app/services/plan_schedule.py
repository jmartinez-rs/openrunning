"""Schedule operations for running plans: holiday pauses, shifts, and date extensions."""

from __future__ import annotations

import datetime as dt
import math
import uuid
from datetime import timedelta, timezone
from typing import List

from sqlmodel import Session, col, select

from app.models import (
    PlanPause,
    PlanPausePreviewPublic,
    PlanPausePublic,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
)


def preview_pause_shift(
    session: Session,
    plan: RunningPlan,
    pause_start: dt.date,
    pause_end: dt.date,
    reason: str | None = None,
) -> PlanPausePreviewPublic:
    """Calculates the effect of pausing a plan without modifying the database.

    Shifts all future workouts starting from `pause_start` forward by full-week increments
    to preserve day-of-week cadence and training invariants.
    """
    if pause_end < pause_start:
        raise ValueError("La fecha de fin de pausa debe ser posterior o igual al inicio.")

    raw_days = (pause_end - pause_start).days + 1
    shift_weeks = max(1, math.ceil(raw_days / 7))
    shift_days = shift_weeks * 7

    affected_workouts = session.exec(
        select(RunningWorkout)
        .where(
            RunningWorkout.plan_id == plan.id,
            RunningWorkout.date >= pause_start,
        )
    ).all()

    orig_end = plan.end_date
    new_end = (orig_end + timedelta(days=shift_days)) if orig_end else None

    return PlanPausePreviewPublic(
        plan_id=plan.id,
        pause_start=pause_start,
        pause_end=pause_end,
        shift_days=shift_days,
        affected_workouts_count=len(affected_workouts),
        original_end_date=orig_end,
        new_end_date=new_end,
        reason=reason,
    )


def apply_pause_shift(
    session: Session,
    plan: RunningPlan,
    user_id: uuid.UUID,
    pause_start: dt.date,
    pause_end: dt.date,
    reason: str | None = None,
) -> PlanPause:
    """Applies a pause shift to the plan, moving future workouts and weeks forward.

    Creates an audit row in `planpause` and updates `plan.end_date`.
    """
    if pause_end < pause_start:
        raise ValueError("La fecha de fin de pausa debe ser posterior o igual al inicio.")

    raw_days = (pause_end - pause_start).days + 1
    shift_weeks = max(1, math.ceil(raw_days / 7))
    shift_days = shift_weeks * 7

    # 1. Query all affected workouts (date >= pause_start)
    affected_workouts = list(
        session.exec(
            select(RunningWorkout)
            .where(
                RunningWorkout.plan_id == plan.id,
                RunningWorkout.date >= pause_start,
            )
            .order_by(col(RunningWorkout.date).desc())
        ).all()
    )

    # 2. Shift workouts using a 2-step flush to avoid SQLite intermediate unique constraint collisions on (plan_id, date)
    TEMP_OFFSET = timedelta(days=10000)
    for w in affected_workouts:
        w.date = w.date + TEMP_OFFSET
        session.add(w)
    session.flush()

    for w in affected_workouts:
        w.date = w.date - TEMP_OFFSET + timedelta(days=shift_days)
        session.add(w)
    session.flush()

    # 3. Shift weeks that start on or after pause_start
    weeks = list(
        session.exec(
            select(RunningWeek)
            .join(RunningPhase)
            .where(RunningPhase.plan_id == plan.id)
            .order_by(col(RunningWeek.start_date).desc())
        ).all()
    )

    for week in weeks:
        if week.start_date and week.start_date >= pause_start:
            week.start_date = week.start_date + timedelta(days=shift_days)
            if week.end_date:
                week.end_date = week.end_date + timedelta(days=shift_days)
            session.add(week)

    # 4. Update plan end_date and updated_at
    if plan.end_date:
        plan.end_date = plan.end_date + timedelta(days=shift_days)
    plan.updated_at = dt.datetime.now(timezone.utc)
    session.add(plan)

    # 5. Record PlanPause audit row
    pause_record = PlanPause(
        plan_id=plan.id,
        user_id=user_id,
        start_date=pause_start,
        end_date=pause_end,
        shifted_days=shift_days,
        reason=reason,
    )
    session.add(pause_record)
    session.flush()

    return pause_record
