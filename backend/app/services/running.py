"""Regla de cumplimiento de los planes de running.

El estado de cada sesión es derivado en cada lectura (GET), nunca persistido,
salvo `cancelled` y el override manual `status_override`. Precedencia:

1. `cancelled` si la sesión fue cancelada manualmente (PATCH).
2. `status_override` si el usuario marcó manualmente la sesión como
   `completed` o `missed` (PATCH).
3. `completed` si existe una actividad cardio de Strava del usuario dentro de
   la ventana de la fecha local (UTC-3) de la sesión; se devuelve el match.
4. `missed` si la fecha ya pasó y no hay actividad.
5. `planned` en cualquier otro caso (hoy o futuro, o cancelada que se cuenta
   como no realizada en los resúmenes).
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Select
from sqlmodel import Session, col, select

from app.models import (
    Activity,
    ActivityCardio,
    RunningPlan,
    RunningWorkout,
    WorkoutStatus,
)

RUNNING_TIMEZONE = ZoneInfo("America/Argentina/Buenos_Aires")

# La fecha local de la sesión corre de 03:00 UTC a 03:00 UTC del día siguiente
# (UTC-3). El límite inferior se incluye, el superior no.
_WINDOW_START_HOUR = 3


def _activity_window(
    workout_date: date,
) -> tuple[datetime, datetime]:
    start = datetime.combine(workout_date, time(_WINDOW_START_HOUR), tzinfo=UTC)
    end = datetime.combine(
        workout_date + timedelta(days=1), time(_WINDOW_START_HOUR), tzinfo=UTC
    )
    return start, end


# Single source of truth for "what counts as a run activity". Recalibration
# (app/services/fitness.py) reuses this predicate instead of hardcoding its own
# source filter, so evidence selection and status resolution agree (R30).
RUN_ACTIVITY_SOURCE_TYPES: tuple[str, ...] = ("strava",)


def run_activity_query(
    user_id: uuid.UUID,
    start: datetime,
    end: datetime,
    *,
    exclude_ids: Sequence[uuid.UUID] | Select | None = None,
) -> Select[tuple[Activity, ActivityCardio]]:
    """Return the shared cardio-running activity query for a user and window.

    Joins `Activity` with `ActivityCardio` (inner join: an activity only counts
    if it has cardio data) and filters by owner, run source type and the local
    timestamp window. `exclude_ids` accepts either explicit ids or a scalar
    subquery, used to skip activities already linked to another session.
    """
    conditions = [
        Activity.user_id == user_id,
        Activity.source_type.in_(RUN_ACTIVITY_SOURCE_TYPES),
        Activity.timestamp >= start,
        Activity.timestamp < end,
    ]
    if exclude_ids is not None:
        conditions.append(Activity.id.not_in(exclude_ids))

    return select(Activity, ActivityCardio).join(ActivityCardio).where(*conditions)


def resolve_workout_status(
    session: Session, user_id: uuid.UUID, workout: RunningWorkout
) -> tuple[WorkoutStatus, dict[str, Any] | None]:
    """Deriva el estado de una sesión y el resumen de la actividad emparejada.

    Devuelve una tupla `(estado, matched_activity)` donde `matched_activity`
    tiene `activity_id`, `name`, `distance_meters` y `duration_seconds`.
    """
    if workout.cancelled:
        return ("cancelled", None)

    # Actividad vinculada manualmente: la sesión se considera completada con
    # los datos reales de esa actividad (p. ej. hecha en otro día).
    if workout.matched_activity_id is not None:
        match = session.exec(
            select(Activity, ActivityCardio)
            .join(ActivityCardio)
            .where(Activity.id == workout.matched_activity_id)
        ).first()
        if match:
            activity, cardio = match
            return (
                "completed",
                {
                    "activity_id": activity.id,
                    "name": activity.name,
                    "distance_meters": cardio.distance_meters,
                    "duration_seconds": activity.duration_seconds,
                },
            )

    if workout.status_override is not None:
        return (workout.status_override, None)

    start, end = _activity_window(workout.date)
    # Excluye actividades ya vinculadas manualmente a otra sesión del usuario
    # (evita doble conteo cuando se reasigna una actividad a otro día).
    linked = (
        select(RunningWorkout.matched_activity_id)
        .join(RunningPlan)
        .where(
            RunningPlan.user_id == user_id,
            RunningWorkout.matched_activity_id.is_not(None),
        )
    )
    matches = session.exec(
        run_activity_query(user_id, start, end, exclude_ids=linked)
        .order_by(col(Activity.timestamp).asc())
        .limit(1)
    ).all()
    if matches:
        activity, cardio = matches[0]
        return (
            "completed",
            {
                "activity_id": activity.id,
                "name": activity.name,
                "distance_meters": cardio.distance_meters,
                "duration_seconds": activity.duration_seconds,
            },
        )

    if workout.date < datetime.now(RUNNING_TIMEZONE).date():
        return ("missed", None)
    return ("planned", None)


def build_plan_summary(
    session: Session,
    user_id: uuid.UUID,
    weeks: int,
    workouts: list[RunningWorkout],
) -> dict[str, int | float]:
    """Calcula los conteos del resumen de un plan para la lista.

    `planned` incluye las sesiones canceladas (no completadas ni perdidas),
    ya que el resumen no tiene un contador propio de canceladas.
    """
    sessions = len(workouts)
    planned_km = round(sum(workout.distance_km or 0.0 for workout in workouts), 2)
    completed = 0
    missed = 0
    planned = 0
    for workout in workouts:
        status_value, _ = resolve_workout_status(session, user_id, workout)
        if status_value == "completed":
            completed += 1
        elif status_value == "missed":
            missed += 1
        else:
            planned += 1
    return {
        "weeks": weeks,
        "sessions": sessions,
        "planned_km": planned_km,
        "completed": completed,
        "missed": missed,
        "planned": planned,
    }
