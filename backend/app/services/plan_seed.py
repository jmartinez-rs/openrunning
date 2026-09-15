"""Exportación e importación de planes de running como seed.

Permite migrar un plan creado en desarrollo a la base de producción en el
primer arranque, sin cargarlo manualmente.
"""

import json
from pathlib import Path

from sqlmodel import Session, select

from app.models import (
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    User,
    WorkoutBlock,
)

SEED_PATH = Path(__file__).parent.parent / "data" / "running_plan_seed.json"


def export_plan_to_json(
    session: Session, user_id: object, plan_name: str, output: Path = SEED_PATH
) -> None:
    """Exporta un plan completo (fases, semanas, workouts y bloques) a JSON."""
    plan = session.exec(
        select(RunningPlan).where(
            RunningPlan.user_id == user_id, RunningPlan.name == plan_name
        )
    ).first()
    if not plan:
        raise ValueError(f"Plan '{plan_name}' no encontrado")
    phases = session.exec(
        select(RunningPhase).where(RunningPhase.plan_id == plan.id)
    ).all()
    weeks: list[RunningWeek] = []
    workouts: list[RunningWorkout] = []
    blocks: list[WorkoutBlock] = []
    for phase in phases:
        phase_weeks = session.exec(
            select(RunningWeek).where(RunningWeek.phase_id == phase.id)
        ).all()
        weeks.extend(phase_weeks)
        for week in phase_weeks:
            workouts.extend(
                session.exec(
                    select(RunningWorkout).where(RunningWorkout.week_id == week.id)
                ).all()
            )
    for workout in workouts:
        blocks.extend(
            session.exec(
                select(WorkoutBlock).where(WorkoutBlock.workout_id == workout.id)
            ).all()
        )

    payload = {
        "name": plan.name,
        "goal": plan.goal,
        "distance_km": plan.distance_km,
        "distance_unit": plan.distance_unit,
        "target_time_seconds": plan.target_time_seconds,
        "target_pace_seconds_per_km": plan.target_pace_seconds_per_km,
        "start_date": str(plan.start_date),
        "end_date": str(plan.end_date) if plan.end_date else None,
        "status": plan.status,
        "notes": plan.notes,
        "phases": [
            {
                "position": phase.position,
                "name": phase.name,
                "color": phase.color,
                "start_week": phase.start_week,
                "end_week": phase.end_week,
                "objective": phase.objective,
                "description": phase.description,
                "weeks": [
                    {
                        "number": week.number,
                        "start_date": str(week.start_date) if week.start_date else None,
                        "end_date": str(week.end_date) if week.end_date else None,
                        "name": week.name,
                        "objective": week.objective,
                        "notes": week.notes,
                        "workouts": [
                            {
                                "date": str(workout.date),
                                "type": workout.type,
                                "objective": workout.objective,
                                "name": workout.name,
                                "distance_km": workout.distance_km,
                                "duration_seconds": workout.duration_seconds,
                                "pace_seconds_per_km": workout.pace_seconds_per_km,
                                "intensity": workout.intensity,
                                "description": workout.description,
                                "notes": workout.notes,
                                "cancelled": workout.cancelled,
                                "status_override": workout.status_override,
                                "blocks": [
                                    {
                                        "position": block.position,
                                        "block_type": block.block_type,
                                        "repeats": block.repeats,
                                        "distance_m": block.distance_m,
                                        "duration_seconds": block.duration_seconds,
                                        "pace_seconds_per_km": block.pace_seconds_per_km,
                                        "pace_range_end_seconds_per_km": block.pace_range_end_seconds_per_km,
                                        "recovery_seconds": block.recovery_seconds,
                                        "recovery_type": block.recovery_type,
                                        "notes": block.notes,
                                    }
                                    for block in blocks
                                    if block.workout_id == workout.id
                                ],
                            }
                            for workout in workouts
                            if workout.week_id == week.id
                        ],
                    }
                    for week in weeks
                    if week.phase_id == phase.id
                ],
            }
            for phase in phases
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def import_plan_from_json(
    session: Session, user: User, source: Path = SEED_PATH
) -> RunningPlan | None:
    """Crea un plan desde el seed si no existe uno con ese nombre para el usuario."""
    if not source.exists():
        return None
    payload = json.loads(source.read_text(encoding="utf-8"))
    existing = session.exec(
        select(RunningPlan).where(
            RunningPlan.user_id == user.id, RunningPlan.name == payload["name"]
        )
    ).first()
    if existing:
        return existing

    plan = RunningPlan(
        user_id=user.id,
        name=payload["name"],
        goal=payload["goal"],
        distance_km=payload.get("distance_km"),
        distance_unit=payload["distance_unit"],
        target_time_seconds=payload.get("target_time_seconds"),
        target_pace_seconds_per_km=payload.get("target_pace_seconds_per_km"),
        start_date=_parse_date(payload.get("start_date")),
        end_date=_parse_date(payload.get("end_date")),
        status=payload.get("status", "active"),
        notes=payload.get("notes"),
    )
    session.add(plan)
    session.flush()

    for phase_data in payload.get("phases", []):
        phase = RunningPhase(
            plan_id=plan.id,
            position=phase_data.get("position", 1),
            name=phase_data.get("name", ""),
            color=phase_data.get("color", ""),
            start_week=phase_data.get("start_week", 1),
            end_week=phase_data.get("end_week", 1),
            objective=phase_data.get("objective"),
            description=phase_data.get("description"),
        )
        session.add(phase)
        session.flush()
        for week_data in phase_data.get("weeks", []):
            week = RunningWeek(
                phase_id=phase.id,
                number=week_data.get("number", 1),
                start_date=_parse_date(week_data.get("start_date")),
                end_date=_parse_date(week_data.get("end_date")),
                name=week_data.get("name"),
                objective=week_data.get("objective"),
                notes=week_data.get("notes"),
            )
            session.add(week)
            session.flush()
            for workout_data in week_data.get("workouts", []):
                workout = RunningWorkout(
                    week_id=week.id,
                    plan_id=plan.id,
                    date=_parse_date(workout_data.get("date")),
                    type=workout_data.get("type", "run"),
                    objective=workout_data.get("objective", ""),
                    name=workout_data.get("name"),
                    distance_km=workout_data.get("distance_km"),
                    duration_seconds=workout_data.get("duration_seconds"),
                    pace_seconds_per_km=workout_data.get("pace_seconds_per_km"),
                    intensity=workout_data.get("intensity", "easy"),
                    description=workout_data.get("description"),
                    notes=workout_data.get("notes"),
                    cancelled=workout_data.get("cancelled", False),
                    status_override=workout_data.get("status_override"),
                )
                session.add(workout)
                session.flush()
                for block_data in workout_data.get("blocks", []):
                    session.add(
                        WorkoutBlock(
                            workout_id=workout.id,
                            position=block_data.get("position", 1),
                            block_type=block_data.get("block_type", "interval"),
                            repeats=block_data.get("repeats", 1),
                            distance_m=block_data.get("distance_m"),
                            duration_seconds=block_data.get("duration_seconds"),
                            pace_seconds_per_km=block_data.get("pace_seconds_per_km"),
                            pace_range_end_seconds_per_km=block_data.get(
                                "pace_range_end_seconds_per_km"
                            ),
                            recovery_seconds=block_data.get("recovery_seconds"),
                            recovery_type=block_data.get("recovery_type"),
                            notes=block_data.get("notes"),
                        )
                    )
    session.commit()
    return plan


def _parse_date(value: object) -> object:
    from datetime import date

    if not value:
        return None
    return date.fromisoformat(str(value))
