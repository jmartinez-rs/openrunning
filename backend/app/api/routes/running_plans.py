"""Rutas de planes de running (fases → semanas → sesiones → bloques).

El estado de cada sesión es derivado en cada lectura (ver
`app/services/running.py`): la única edición manual es la cancelación.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Race,
    RunningPhase,
    RunningPlan,
    RunningPlanCreate,
    RunningPlanPublic,
    RunningPlansPublic,
    RunningPlanSummaryPublic,
    RunningPlanUpdate,
    RunningWeek,
    RunningWorkout,
    RunningWorkoutPublic,
    RunningWorkoutUpdate,
    WorkoutBlock,
    WorkoutBlockPublic,
    WorkoutDuplicateIn,
)
from app.services.running import build_plan_summary, resolve_workout_status

router = APIRouter(prefix="/running-plans", tags=["running-plans"])


def _get_owned_plan(
    session: SessionDep, user_id: uuid.UUID, plan_id: uuid.UUID
) -> RunningPlan:
    plan = session.exec(
        select(RunningPlan).where(
            RunningPlan.id == plan_id, RunningPlan.user_id == user_id
        )
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de running no encontrado")
    return plan


def _get_owned_workout(
    session: SessionDep, plan: RunningPlan, workout_id: uuid.UUID
) -> RunningWorkout:
    workout = session.exec(
        select(RunningWorkout).where(
            RunningWorkout.id == workout_id, RunningWorkout.plan_id == plan.id
        )
    ).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return workout


def _validate_plan_input(
    session: SessionDep, user_id: uuid.UUID, plan_in: RunningPlanCreate
) -> None:
    """Valida las reglas que dependen de la base (carrera y fechas únicas)."""
    if plan_in.race_id is not None:
        race = session.exec(
            select(Race).where(Race.id == plan_in.race_id, Race.user_id == user_id)
        ).first()
        if not race:
            raise HTTPException(status_code=404, detail="Carrera no encontrada")
    dates: set[date] = set()
    for phase in plan_in.phases:
        for week in phase.weeks:
            for workout in week.workouts:
                if workout.date in dates:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Ya existe una sesión planificada para el día "
                            f"{workout.date.isoformat()}"
                        ),
                    )
                dates.add(workout.date)


def _create_structure(
    session: SessionDep, plan_id: uuid.UUID, plan_in: RunningPlanCreate
) -> None:
    """Crea la jerarquía anidada de un plan (fases → semanas → sesiones → bloques)."""
    for phase_in in plan_in.phases:
        phase = RunningPhase(
            plan_id=plan_id,
            position=phase_in.position,
            name=phase_in.name,
            color=phase_in.color,
            start_week=phase_in.start_week,
            end_week=phase_in.end_week,
            objective=phase_in.objective,
            description=phase_in.description,
        )
        session.add(phase)
        session.flush()
        for week_in in phase_in.weeks:
            week = RunningWeek(
                phase_id=phase.id,
                number=week_in.number,
                start_date=week_in.start_date,
                end_date=week_in.end_date,
                name=week_in.name,
                objective=week_in.objective,
                notes=week_in.notes,
            )
            session.add(week)
            session.flush()
            for workout_in in week_in.workouts:
                workout = RunningWorkout(
                    week_id=week.id,
                    plan_id=plan_id,
                    date=workout_in.date,
                    type=workout_in.type,
                    objective=workout_in.objective,
                    name=workout_in.name,
                    distance_km=workout_in.distance_km,
                    duration_seconds=workout_in.duration_seconds,
                    pace_seconds_per_km=workout_in.pace_seconds_per_km,
                    intensity=workout_in.intensity,
                    description=workout_in.description,
                    notes=workout_in.notes,
                    cancelled=workout_in.cancelled,
                    status_override=workout_in.status_override,
                )
                session.add(workout)
                session.flush()
                for block_in in workout_in.blocks:
                    session.add(
                        WorkoutBlock(
                            workout_id=workout.id,
                            position=block_in.position,
                            block_type=block_in.block_type,
                            repeats=block_in.repeats,
                            distance_m=block_in.distance_m,
                            duration_seconds=block_in.duration_seconds,
                            pace_seconds_per_km=block_in.pace_seconds_per_km,
                            pace_range_end_seconds_per_km=(
                                block_in.pace_range_end_seconds_per_km
                            ),
                            recovery_seconds=block_in.recovery_seconds,
                            recovery_type=block_in.recovery_type,
                            notes=block_in.notes,
                        )
                    )


def _delete_structure(session: SessionDep, plan: RunningPlan) -> None:
    """Borra los hijos existentes de un plan (para el reemplazo por PUT)."""
    blocks = session.exec(
        select(WorkoutBlock)
        .join(RunningWorkout)
        .where(RunningWorkout.plan_id == plan.id)
    ).all()
    for block in blocks:
        session.delete(block)
    workouts = session.exec(
        select(RunningWorkout).where(RunningWorkout.plan_id == plan.id)
    ).all()
    for workout in workouts:
        session.delete(workout)
    weeks = session.exec(
        select(RunningWeek)
        .join(RunningPhase)
        .where(RunningPhase.plan_id == plan.id)
    ).all()
    for week in weeks:
        session.delete(week)
    phases = session.exec(
        select(RunningPhase).where(RunningPhase.plan_id == plan.id)
    ).all()
    for phase in phases:
        session.delete(phase)
    session.flush()


def _workout_public(
    session: SessionDep, user_id: uuid.UUID, workout: RunningWorkout
) -> RunningWorkoutPublic:
    blocks = session.exec(
        select(WorkoutBlock)
        .where(WorkoutBlock.workout_id == workout.id)
        .order_by(col(WorkoutBlock.position))
    ).all()
    status_value, matched = resolve_workout_status(session, user_id, workout)
    return RunningWorkoutPublic(
        id=workout.id,
        date=workout.date,
        type=workout.type,
        objective=workout.objective,
        name=workout.name,
        distance_km=workout.distance_km,
        duration_seconds=workout.duration_seconds,
        pace_seconds_per_km=workout.pace_seconds_per_km,
        intensity=workout.intensity,
        description=workout.description,
        notes=workout.notes,
        cancelled=workout.cancelled,
        status_override=workout.status_override,
        status=status_value,
        matched_activity=matched,
        blocks=[WorkoutBlockPublic.model_validate(block) for block in blocks],
    )


def _week_public(
    session: SessionDep, user_id: uuid.UUID, week: RunningWeek
) -> object:
    workouts = session.exec(
        select(RunningWorkout)
        .where(RunningWorkout.week_id == week.id)
        .order_by(col(RunningWorkout.date))
    ).all()
    return {
        "id": week.id,
        "number": week.number,
        "start_date": week.start_date,
        "end_date": week.end_date,
        "name": week.name,
        "objective": week.objective,
        "notes": week.notes,
        "workouts": [
            _workout_public(session, user_id, workout) for workout in workouts
        ],
    }


def _phase_public(
    session: SessionDep, user_id: uuid.UUID, phase: RunningPhase
) -> object:
    weeks = session.exec(
        select(RunningWeek)
        .where(RunningWeek.phase_id == phase.id)
        .order_by(col(RunningWeek.number))
    ).all()
    return {
        "id": phase.id,
        "position": phase.position,
        "name": phase.name,
        "color": phase.color,
        "start_week": phase.start_week,
        "end_week": phase.end_week,
        "objective": phase.objective,
        "description": phase.description,
        "weeks": [_week_public(session, user_id, week) for week in weeks],
    }


def _plan_public(
    session: SessionDep, user_id: uuid.UUID, plan_id: uuid.UUID
) -> RunningPlanPublic:
    plan = _get_owned_plan(session, user_id, plan_id)
    phases = session.exec(
        select(RunningPhase)
        .where(RunningPhase.plan_id == plan.id)
        .order_by(col(RunningPhase.position))
    ).all()
    return RunningPlanPublic(
        **plan.model_dump(),
        phases=[_phase_public(session, user_id, phase) for phase in phases],
    )


def _plan_summary(
    session: SessionDep, user_id: uuid.UUID, plan: RunningPlan
) -> RunningPlanSummaryPublic:
    weeks = session.exec(
        select(func.count())
        .select_from(RunningWeek)
        .join(RunningPhase)
        .where(RunningPhase.plan_id == plan.id)
    ).one()
    workouts = session.exec(
        select(RunningWorkout).where(RunningWorkout.plan_id == plan.id)
    ).all()
    summary = build_plan_summary(session, user_id, weeks, list(workouts))
    return RunningPlanSummaryPublic(
        id=plan.id,
        name=plan.name,
        goal=plan.goal,
        status=plan.status,
        start_date=plan.start_date,
        end_date=plan.end_date,
        distance_km=plan.distance_km,
        distance_unit=plan.distance_unit,
        race_id=plan.race_id,
        updated_at=plan.updated_at,
        weeks=int(summary["weeks"]),
        sessions=int(summary["sessions"]),
        planned_km=float(summary["planned_km"]),
        completed=int(summary["completed"]),
        missed=int(summary["missed"]),
        planned=int(summary["planned"]),
    )


@router.get("/", response_model=RunningPlansPublic)
def read_plans(
    session: SessionDep, current_user: CurrentUser
) -> RunningPlansPublic:
    count = session.exec(
        select(func.count())
        .select_from(RunningPlan)
        .where(RunningPlan.user_id == current_user.id)
    ).one()
    plans = session.exec(
        select(RunningPlan)
        .where(RunningPlan.user_id == current_user.id)
        .order_by(col(RunningPlan.updated_at).desc())
    ).all()
    return RunningPlansPublic(
        data=[
            _plan_summary(session, current_user.id, plan) for plan in plans
        ],
        count=count,
    )


@router.post("/", response_model=RunningPlanPublic, status_code=status.HTTP_201_CREATED)
def create_plan(
    session: SessionDep, current_user: CurrentUser, plan_in: RunningPlanCreate
) -> RunningPlanPublic:
    _validate_plan_input(session, current_user.id, plan_in)
    now = datetime.now(UTC)
    plan = RunningPlan(
        user_id=current_user.id,
        race_id=plan_in.race_id,
        name=plan_in.name,
        goal=plan_in.goal,
        distance_km=plan_in.distance_km,
        distance_unit=plan_in.distance_unit,
        target_time_seconds=plan_in.target_time_seconds,
        target_pace_seconds_per_km=plan_in.target_pace_seconds_per_km,
        start_date=plan_in.start_date,
        end_date=plan_in.end_date,
        status=plan_in.status,
        notes=plan_in.notes,
        created_at=now,
        updated_at=now,
    )
    session.add(plan)
    session.flush()
    _create_structure(session, plan.id, plan_in)
    session.commit()
    return _plan_public(session, current_user.id, plan.id)


@router.get("/{plan_id}", response_model=RunningPlanPublic)
def read_plan(
    session: SessionDep, current_user: CurrentUser, plan_id: uuid.UUID
) -> RunningPlanPublic:
    return _plan_public(session, current_user.id, plan_id)


@router.put("/{plan_id}", response_model=RunningPlanPublic)
def replace_plan(
    session: SessionDep,
    current_user: CurrentUser,
    plan_id: uuid.UUID,
    plan_in: RunningPlanUpdate,
) -> RunningPlanPublic:
    plan = _get_owned_plan(session, current_user.id, plan_id)
    _validate_plan_input(session, current_user.id, plan_in)
    _delete_structure(session, plan)
    # Se conservan user_id y created_at; el resto de los campos se reemplazan.
    plan.race_id = plan_in.race_id
    plan.name = plan_in.name
    plan.goal = plan_in.goal
    plan.distance_km = plan_in.distance_km
    plan.distance_unit = plan_in.distance_unit
    plan.target_time_seconds = plan_in.target_time_seconds
    plan.target_pace_seconds_per_km = plan_in.target_pace_seconds_per_km
    plan.start_date = plan_in.start_date
    plan.end_date = plan_in.end_date
    plan.status = plan_in.status
    plan.notes = plan_in.notes
    plan.updated_at = datetime.now(UTC)
    session.add(plan)
    session.flush()
    _create_structure(session, plan.id, plan_in)
    session.commit()
    return _plan_public(session, current_user.id, plan.id)


@router.delete("/{plan_id}")
def delete_plan(
    session: SessionDep, current_user: CurrentUser, plan_id: uuid.UUID
) -> dict[str, str]:
    plan = _get_owned_plan(session, current_user.id, plan_id)
    session.delete(plan)
    session.commit()
    return {"message": "Plan de running eliminado"}


@router.patch(
    "/{plan_id}/workouts/{workout_id}", response_model=RunningWorkoutPublic
)
def update_workout(
    session: SessionDep,
    current_user: CurrentUser,
    plan_id: uuid.UUID,
    workout_id: uuid.UUID,
    workout_in: RunningWorkoutUpdate,
) -> RunningWorkoutPublic:
    plan = _get_owned_plan(session, current_user.id, plan_id)
    workout = _get_owned_workout(session, plan, workout_id)
    data = workout_in.model_dump(exclude_unset=True)
    new_date = data.get("date")
    if new_date is not None and new_date != workout.date:
        conflict = session.exec(
            select(RunningWorkout).where(
                RunningWorkout.plan_id == plan.id,
                RunningWorkout.date == new_date,
                RunningWorkout.id != workout.id,
            )
        ).first()
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Ya existe una sesión planificada para el día "
                    f"{new_date.isoformat()}"
                ),
            )
    for field, value in data.items():
        setattr(workout, field, value)
    plan.updated_at = datetime.now(UTC)
    session.add(workout)
    session.add(plan)
    session.commit()
    return _workout_public(session, current_user.id, workout)


@router.post(
    "/{plan_id}/workouts/{workout_id}/duplicate",
    response_model=RunningWorkoutPublic,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_workout(
    session: SessionDep,
    current_user: CurrentUser,
    plan_id: uuid.UUID,
    workout_id: uuid.UUID,
    duplicate_in: WorkoutDuplicateIn | None = None,
) -> RunningWorkoutPublic:
    plan = _get_owned_plan(session, current_user.id, plan_id)
    workout = _get_owned_workout(session, plan, workout_id)
    new_date = (
        duplicate_in.date
        if duplicate_in is not None and duplicate_in.date is not None
        else workout.date + timedelta(days=7)
    )
    conflict = session.exec(
        select(RunningWorkout).where(
            RunningWorkout.plan_id == plan.id, RunningWorkout.date == new_date
        )
    ).first()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=(
                "Ya existe una sesión planificada para el día "
                f"{new_date.isoformat()}"
            ),
        )
    new_workout = RunningWorkout(
        week_id=workout.week_id,
        plan_id=plan.id,
        date=new_date,
        type=workout.type,
        objective=workout.objective,
        name=workout.name,
        distance_km=workout.distance_km,
        duration_seconds=workout.duration_seconds,
        pace_seconds_per_km=workout.pace_seconds_per_km,
        intensity=workout.intensity,
        description=workout.description,
        notes=workout.notes,
        cancelled=workout.cancelled,
        status_override=workout.status_override,
    )
    session.add(new_workout)
    session.flush()
    blocks = session.exec(
        select(WorkoutBlock)
        .where(WorkoutBlock.workout_id == workout.id)
        .order_by(col(WorkoutBlock.position))
    ).all()
    for block in blocks:
        session.add(
            WorkoutBlock(
                workout_id=new_workout.id,
                position=block.position,
                block_type=block.block_type,
                repeats=block.repeats,
                distance_m=block.distance_m,
                duration_seconds=block.duration_seconds,
                pace_seconds_per_km=block.pace_seconds_per_km,
                pace_range_end_seconds_per_km=block.pace_range_end_seconds_per_km,
                recovery_seconds=block.recovery_seconds,
                recovery_type=block.recovery_type,
                notes=block.notes,
            )
        )
    plan.updated_at = datetime.now(UTC)
    session.add(plan)
    session.commit()
    return _workout_public(session, current_user.id, new_workout)
