"""Rutas de planes de running (fases → semanas → sesiones → bloques).

El estado de cada sesión es derivado en cada lectura (ver
`app/services/running.py`): la única edición manual es la cancelación.
"""

import logging
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy import Select
from sqlmodel import Field, SQLModel, col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Activity,
    ActivityCardio,
    PlanDraftResponse,
    PlanGeneratorConfig,
    PlanRecalibration,
    PlanRecalibrationPublic,
    PlanRecalibrationsPublic,
    Race,
    RecalibrationKind,
    RecalibrationSource,
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
    WorkoutType,
)
from app.services.fitness import (
    PlanSnapshot,
    apply_recalibration,
    classify_recalibration,
    derive_current_vdot,
    estimate_vdot_for_plan,
    latest_applied_recalibration,
    plan_to_create,
    recalibration_preview,
    resolve_effective_from_week,
    snapshot_plan,
)
from app.services.plan_generator import generate_plan_draft_v2
from app.services.plan_validator import (
    new_error_issues,
    reconstruct_generator_config,
    validate_plan_invariants,
)
from app.services.running import (
    RUNNING_TIMEZONE,
    build_plan_summary,
    resolve_workout_status,
)

router = APIRouter(prefix="/running-plans", tags=["running-plans"])

logger = logging.getLogger(__name__)



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
                    matched_activity_id=workout_in.matched_activity_id,
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
        matched_activity_id=workout.matched_activity_id,
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


@router.post("/generate-draft", response_model=PlanDraftResponse)
def generate_draft(
    session: SessionDep, current_user: CurrentUser, config: PlanGeneratorConfig
) -> PlanDraftResponse:
    """Genera un borrador del plan en base a la configuración y el baseline del atleta."""
    return generate_plan_draft_v2(config)


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
        week_start_day=plan_in.week_start_day,
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
    plan.week_start_day = plan_in.week_start_day
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
    matched_id = data.get("matched_activity_id")
    if matched_id is not None:
        linked = session.exec(
            select(Activity, ActivityCardio)
            .join(ActivityCardio)
            .where(
                Activity.id == matched_id,
                Activity.user_id == current_user.id,
            )
        ).first()
        if not linked:
            raise HTTPException(
                status_code=404,
                detail="La actividad a vincular no existe o no es cardio",
            )
        # Vincular una actividad implica completar la sesión con datos reales.
        data["status_override"] = "completed"
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
        matched_activity_id=workout.matched_activity_id,
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


# ---------------------------------------------------------------------------
# Dynamic VDOT recalibration (R18-R21, R28, D0)
# ---------------------------------------------------------------------------


class RecalibrationPreviewRequest(SQLModel):
    """Optional body: an explicit `new_vdot` and a forward-compat `source`."""

    new_vdot: float | None = Field(default=None, ge=20, le=85)
    source: RecalibrationSource | None = None


class RecalibrationApplyRequest(RecalibrationPreviewRequest):
    """`confirm` is required on every apply; `acknowledge_risk` on risky ones."""

    confirm: bool = False
    acknowledge_risk: bool = False


class RecalibrationChangePublic(SQLModel):
    workout_id: uuid.UUID
    date: date
    type: WorkoutType
    old_pace: float | None = None
    new_pace: float | None = None


class RecalibrationPreviewPublic(SQLModel):
    vdot: float | None = None
    recommend_fitness_test: bool = False
    old_vdot: float | None = None
    new_vdot: float | None = None
    delta_vdot: float | None = None
    kind: RecalibrationKind | None = None
    suspicious: bool = False
    source: RecalibrationSource | None = None
    evidence: dict | None = None
    old_paces: dict[str, float] | None = None
    new_paces: dict[str, float] | None = None
    effective_from_week: int | None = None
    effective_from_date: date | None = None
    affected_weeks: list[int] = Field(default_factory=list)
    changes: list[RecalibrationChangePublic] = Field(default_factory=list)
    current_vdot: float | None = None
    current_vdot_source: str | None = None
    current_vdot_date: date | None = None


class RecalibrationApplyPublic(RecalibrationPreviewPublic):
    recalibration: PlanRecalibrationPublic


def _today_local() -> date:
    return datetime.now(RUNNING_TIMEZONE).date()


def plan_lock_statement(plan_id: uuid.UUID) -> Select[tuple[RunningPlan]]:
    """Locking SELECT for one plan row (``FOR UPDATE`` on PostgreSQL)."""
    return select(RunningPlan).where(RunningPlan.id == plan_id).with_for_update()


def lock_plan_for_update(session: SessionDep, plan: RunningPlan) -> RunningPlan:
    """Take a row lock on the plan for the duration of the apply transaction.

    Two concurrent applies must not lose updates (R23): the locking SELECT
    serializes them on the plan row. SQLite (used by unit tests) does not support
    ``FOR UPDATE`` and its dialect ignores it, while production PostgreSQL emits
    it. The lock is released on commit/rollback.
    """
    return session.exec(plan_lock_statement(plan.id)).one()


def _snapshot_with_effective_week(
    session: SessionDep, plan: RunningPlan, *, today_local: date
) -> tuple[PlanSnapshot, tuple[int, date]]:
    """Shared plan-state check: the earliest D0 check after ownership is 404.

    Returns the live snapshot plus the first strictly-future week, or raises
    `409 no_future_week` (R14/R20).
    """
    snapshot = snapshot_plan(session, plan)
    effective_from = resolve_effective_from_week(
        snapshot.weeks,
        week_start_day=plan.week_start_day,
        plan_start_date=plan.start_date,
        today_local=today_local,
    )
    if effective_from is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="no_future_week"
        )
    return snapshot, effective_from


def _current_vdot_metadata(
    plan: RunningPlan, last_applied: PlanRecalibration | None
) -> tuple[float | None, str | None, date | None]:
    """Derived current VDOT plus its source and date (R21/R29)."""
    current_vdot = derive_current_vdot(plan.baseline, last_applied)
    if last_applied is not None:
        created = last_applied.created_at
        when = created.date() if created else last_applied.effective_from_date
        return current_vdot, last_applied.source, when
    if current_vdot is not None:
        return current_vdot, "baseline", None
    return None, None, None


def _resolve_target(
    session: SessionDep,
    plan: RunningPlan,
    body: RecalibrationPreviewRequest | None,
    *,
    today_local: date,
) -> tuple[float | None, RecalibrationSource | None, dict | None]:
    """Resolve the target VDOT, its `source` and its evidence (NEW-3).

    An explicit `new_vdot` always resolves to `source="manual"` (never NULL);
    otherwise the best recent evidence decides test / activity, or nothing.
    """
    if body is not None and body.new_vdot is not None:
        return body.new_vdot, "manual", None
    estimate = estimate_vdot_for_plan(session, plan, as_of=today_local)
    if estimate is None:
        return None, None, None
    return estimate.vdot, estimate.source, estimate.evidence


def _invalid_plan_data(exc: Exception) -> HTTPException:
    """Map a pydantic ``ValidationError`` from stored plan data to 409 (F-c).

    A stored value the request/response models cannot represent (for example a
    workout type written to the unconstrained ``String(32)`` column) is
    client-fixable data corruption, not a server error.
    """
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT, detail="invalid_plan_data"
    )


def _preview_public(
    preview,
    *,
    new_vdot: float,
    current_vdot: float,
    current_vdot_source: str | None,
    current_vdot_date: date | None,
) -> RecalibrationPreviewPublic:
    return RecalibrationPreviewPublic(
        vdot=new_vdot,
        recommend_fitness_test=False,
        old_vdot=preview.old_vdot,
        new_vdot=preview.new_vdot,
        delta_vdot=preview.delta_vdot,
        kind=preview.kind,
        suspicious=preview.suspicious,
        source=preview.source,
        evidence=preview.evidence,
        old_paces=preview.old_paces,
        new_paces=preview.new_paces,
        effective_from_week=preview.effective_from_week,
        effective_from_date=preview.effective_from_date,
        affected_weeks=preview.affected_weeks,
        changes=[
            RecalibrationChangePublic(
                workout_id=change.workout_id,
                date=change.date,
                type=change.type,  # type: ignore[arg-type]
                old_pace=change.old_pace,
                new_pace=change.new_pace,
            )
            for change in preview.changes
        ],
        current_vdot=current_vdot,
        current_vdot_source=current_vdot_source,
        current_vdot_date=current_vdot_date,
    )


@router.post(
    "/{plan_id}/recalibrate/preview", response_model=RecalibrationPreviewPublic
)
def preview_recalibration(
    session: SessionDep,
    current_user: CurrentUser,
    plan_id: uuid.UUID,
    body: RecalibrationPreviewRequest | None = None,
) -> RecalibrationPreviewPublic:
    """Read-only preview. D0 precedence: 404 -> 409 -> 409 -> 200 null -> 200."""
    plan = _get_owned_plan(session, current_user.id, plan_id)
    today_local = _today_local()
    snapshot, effective_from = _snapshot_with_effective_week(
        session, plan, today_local=today_local
    )
    last_applied = latest_applied_recalibration(session, plan)
    current_vdot, current_source, current_date = _current_vdot_metadata(
        plan, last_applied
    )
    if current_vdot is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="plan_has_no_baseline"
        )
    new_vdot, source, evidence = _resolve_target(
        session, plan, body, today_local=today_local
    )
    if new_vdot is None or source is None:
        return RecalibrationPreviewPublic(
            vdot=None,
            recommend_fitness_test=True,
            current_vdot=current_vdot,
            current_vdot_source=current_source,
            current_vdot_date=current_date,
        )
    preview = recalibration_preview(
        snapshot,
        current_vdot=current_vdot,
        new_vdot=new_vdot,
        source=source,
        evidence=evidence,
        effective_from=effective_from,
    )
    try:
        return _preview_public(
            preview,
            new_vdot=new_vdot,
            current_vdot=current_vdot,
            current_vdot_source=current_source,
            current_vdot_date=current_date,
        )
    except ValidationError as exc:
        raise _invalid_plan_data(exc) from exc


@router.post("/{plan_id}/recalibrate", response_model=RecalibrationApplyPublic)
def apply_plan_recalibration(
    session: SessionDep,
    current_user: CurrentUser,
    plan_id: uuid.UUID,
    body: RecalibrationApplyRequest | None = None,
) -> RecalibrationApplyPublic:
    """Apply a recalibration. Normative gate order (R19/R28/R20/T13)."""
    plan = _get_owned_plan(session, current_user.id, plan_id)
    if body is None or not body.confirm:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="confirmation_required"
        )

    # Serialize concurrent applies on the plan row before the read-modify-write.
    lock_plan_for_update(session, plan)

    today_local = _today_local()
    snapshot, effective_from = _snapshot_with_effective_week(
        session, plan, today_local=today_local
    )
    last_applied = latest_applied_recalibration(session, plan)
    current_vdot, current_source, current_date = _current_vdot_metadata(
        plan, last_applied
    )
    if current_vdot is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="plan_has_no_baseline"
        )
    new_vdot, source, evidence = _resolve_target(
        session, plan, body, today_local=today_local
    )
    if new_vdot is None or source is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="no_evidence"
        )

    classification = classify_recalibration(current_vdot, new_vdot)
    needs_ack = classification.suspicious or classification.kind == "decline"
    if needs_ack and not body.acknowledge_risk:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="risk_acknowledgement_required",
        )

    # A legacy/malformed baseline cannot rebuild the generator config: map the
    # uncaught ValueError / pydantic ValidationError to 409, never 500.
    try:
        config = reconstruct_generator_config(plan)
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="plan_has_no_baseline"
        ) from exc

    preview = recalibration_preview(
        snapshot,
        current_vdot=current_vdot,
        new_vdot=new_vdot,
        source=source,
        evidence=evidence,
        effective_from=effective_from,
    )
    try:
        pre_issues = validate_plan_invariants(plan_to_create(snapshot), config)
        # Build the response DTO before mutating: a stored value the response
        # model cannot represent must 409, not 500 after the commit.
        public = _preview_public(
            preview,
            new_vdot=new_vdot,
            current_vdot=current_vdot,
            current_vdot_source=current_source,
            current_vdot_date=current_date,
        )
    except ValidationError as exc:
        raise _invalid_plan_data(exc) from exc

    result = apply_recalibration(
        snapshot, new_vdot=new_vdot, effective_from_date=effective_from[1]
    )
    session.flush()
    try:
        post_issues = validate_plan_invariants(plan_to_create(snapshot), config)
    except ValidationError as exc:
        session.rollback()
        raise _invalid_plan_data(exc) from exc

    new_errors = new_error_issues(pre_issues, post_issues)
    if new_errors:
        session.rollback()
        logger.warning(
            "plan_invariant_violation plan_id=%s new_error_issues=%s",
            plan.id,
            [issue.code for issue in new_errors],
            extra={
                "event": "plan_invariant_violation",
                "plan_id": str(plan.id),
                "new_error_issues": [issue.code for issue in new_errors],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="plan_invariant_violation"
        )

    row = PlanRecalibration(
        plan_id=plan.id,
        user_id=plan.user_id,
        source=source,
        source_ref=(
            {
                "source_id": evidence.get("source_id"),
                "matched_workout_id": evidence.get("matched_workout_id"),
            }
            if evidence
            else None
        ),
        old_vdot=current_vdot,
        new_vdot=new_vdot,
        delta_vdot=classification.delta_vdot,
        old_paces=preview.old_paces,
        new_paces=preview.new_paces,
        kind=classification.kind,
        suspicious=classification.suspicious,
        effective_from_week=effective_from[0],
        effective_from_date=effective_from[1],
        affected_workouts=result.affected_workouts,
        affected_blocks=result.affected_blocks,
        engine_version=plan.engine_version,
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    return RecalibrationApplyPublic(
        **public.model_dump(),
        recalibration=PlanRecalibrationPublic.model_validate(row),
    )


@router.get("/{plan_id}/recalibrations", response_model=PlanRecalibrationsPublic)
def read_recalibrations(
    session: SessionDep,
    current_user: CurrentUser,
    plan_id: uuid.UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> PlanRecalibrationsPublic:
    """Paginated audit history plus the derived current VDOT (R21/R23)."""
    plan = _get_owned_plan(session, current_user.id, plan_id)
    scope = (
        PlanRecalibration.plan_id == plan.id,
        PlanRecalibration.user_id == plan.user_id,
    )
    count = session.exec(
        select(func.count()).select_from(PlanRecalibration).where(*scope)
    ).one()
    rows = session.exec(
        select(PlanRecalibration)
        .where(*scope)
        .order_by(
            col(PlanRecalibration.created_at).desc(),
            col(PlanRecalibration.id).desc(),
        )
        .offset(skip)
        .limit(limit)
    ).all()
    last_applied = latest_applied_recalibration(session, plan)
    current_vdot, current_source, current_date = _current_vdot_metadata(
        plan, last_applied
    )
    return PlanRecalibrationsPublic(
        data=[PlanRecalibrationPublic.model_validate(row) for row in rows],
        count=count,
        current_vdot=current_vdot,
        current_vdot_source=current_source,
        current_vdot_date=current_date,
    )
