"""Dynamic VDOT recalibration: evidence estimation, preview and apply.

This module deliberately avoids importing ``app.core.config`` so its pure-core
tests can run without environment configuration. Activity selection reuses the
shared ``run_activity_query`` predicate from ``app.services.running`` instead of
hardcoding a source filter (R30), and block paces are resolved through
``app.services.workout_library.resolve_block_paces`` — the same single source of
truth the plan generator uses — so a recalibration reproduces the generator's
paces for the new VDOT instead of duplicating its offsets (R11/R12).
"""

import datetime as dt
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime, time

from sqlmodel import Session, col, select

from app.models import (
    Activity,
    ActivityCardio,
    Confidence,
    PhaseIn,
    PlanRecalibration,
    RecalibrationKind,
    RecalibrationSource,
    RunningPhase,
    RunningPlan,
    RunningPlanCreate,
    RunningWeek,
    RunningWorkout,
    WeekIn,
    WorkoutBlock,
    WorkoutBlockIn,
    WorkoutIn,
)
from app.services.plan_calendar import week_start_offset
from app.services.running import RUNNING_TIMEZONE, run_activity_query
from app.services.running_math import calculate_vdot, get_training_paces_seconds
from app.services.workout_library import resolve_block_paces

# Recency window "W" and minimum qualifying distance "D" from the spec glossary.
RECENCY_WINDOW_DAYS = 42
MIN_QUALIFYING_DISTANCE_M = 3000.0

# A jump above this many VDOT points is flagged `suspicious` (R15).
SUSPICIOUS_DELTA_THRESHOLD = 2.0

# Workout-level pace key per workout type; `race` keeps its stored pace (D6).
_WORKOUT_PACE_KEY: dict[str, str] = {
    "easy_run": "easy_min",
    "regeneration": "easy_min",
    "activation": "easy_min",
    "long_run": "easy_min",
    "tempo": "threshold",
    "intervals": "interval",
    "test": "threshold",
}


@dataclass(frozen=True)
class PlanSnapshot:
    """The plan's live, session-bound ORM objects (mutating them persists)."""

    plan: RunningPlan
    phases: list[RunningPhase]
    weeks: list[RunningWeek]
    workouts: list[RunningWorkout]
    blocks: dict[uuid.UUID, list[WorkoutBlock]]


@dataclass(frozen=True)
class RecalibrationChange:
    workout_id: uuid.UUID
    date: dt.date
    type: str
    old_pace: float | None
    new_pace: float | None


@dataclass(frozen=True)
class RecalibrationClassification:
    delta_vdot: float
    kind: RecalibrationKind
    suspicious: bool


@dataclass(frozen=True)
class RecalibrationPreview:
    old_vdot: float
    new_vdot: float
    delta_vdot: float
    kind: RecalibrationKind
    suspicious: bool
    source: RecalibrationSource
    evidence: dict
    old_paces: dict[str, float]
    new_paces: dict[str, float]
    effective_from_week: int
    effective_from_date: dt.date
    affected_weeks: list[int]
    changes: list[RecalibrationChange]


@dataclass(frozen=True)
class RecalibrationResult:
    affected_workouts: int
    affected_blocks: int
    affected_weeks: list[int]


@dataclass(frozen=True)
class RecentEffort:
    """A piece of real evidence: one activity and how it was matched."""

    activity_id: uuid.UUID
    date: dt.date
    distance_meters: float
    time_seconds: float
    matched_workout_id: uuid.UUID | None = None

    @property
    def is_test_mark(self) -> bool:
        """A fitness-test mark is an activity matched to a `test` workout."""
        return self.matched_workout_id is not None


@dataclass(frozen=True)
class VdotEstimate:
    vdot: float
    source: RecalibrationSource
    confidence: Confidence
    evidence: dict


def _local_date(moment: datetime) -> dt.date:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(RUNNING_TIMEZONE).date()


def _recency_window(as_of: dt.date, window_days: int) -> tuple[datetime, datetime]:
    start = datetime.combine(
        as_of - dt.timedelta(days=window_days), time(0), tzinfo=RUNNING_TIMEZONE
    ).astimezone(UTC)
    end = datetime.combine(
        as_of + dt.timedelta(days=1), time(0), tzinfo=RUNNING_TIMEZONE
    ).astimezone(UTC)
    return start, end


def _qualifies(
    effort: RecentEffort,
    *,
    as_of: dt.date,
    window_days: int,
    min_distance_m: float,
) -> bool:
    return (
        effort.time_seconds > 0
        and effort.distance_meters >= min_distance_m
        and (as_of - effort.date).days <= window_days
    )


def _effort_from_activity(
    activity: Activity, cardio: ActivityCardio, *, matched_workout_id: uuid.UUID | None = None
) -> RecentEffort:
    return RecentEffort(
        activity_id=activity.id,
        date=_local_date(activity.timestamp),
        distance_meters=float(cardio.distance_meters),
        time_seconds=float(activity.duration_seconds),
        matched_workout_id=matched_workout_id,
    )


def _effort_vdot(effort: RecentEffort) -> float:
    return calculate_vdot(effort.distance_meters, effort.time_seconds)


def _rank_efforts(efforts: Sequence[RecentEffort]) -> list[RecentEffort]:
    """Highest implied VDOT first; ties resolved deterministically (R3)."""
    return sorted(
        efforts,
        key=lambda effort: (
            _effort_vdot(effort),
            effort.date,
            str(effort.activity_id),
        ),
        reverse=True,
    )


def _secondary_entries(
    efforts: Sequence[RecentEffort], *, exclude: uuid.UUID | None = None
) -> list[dict]:
    """Competing evidence, highest VDOT first, deduplicated and without the winner."""
    seen: set[uuid.UUID] = set()
    entries: list[dict] = []
    for effort in _rank_efforts(efforts):
        if effort.activity_id == exclude or effort.activity_id in seen:
            continue
        seen.add(effort.activity_id)
        entries.append(
            {
                "source_id": str(effort.activity_id),
                "distance_meters": effort.distance_meters,
                "time_seconds": effort.time_seconds,
                "effective_date": effort.date.isoformat(),
                "vdot": _effort_vdot(effort),
            }
        )
    return entries


def _qualifying_test_efforts(
    session: Session,
    plan: RunningPlan,
    *,
    as_of: dt.date,
    max_age_days: int = RECENCY_WINDOW_DAYS,
) -> list[RecentEffort]:
    rows = session.exec(
        select(RunningWorkout, Activity, ActivityCardio)
        .join(Activity, Activity.id == RunningWorkout.matched_activity_id)
        .join(ActivityCardio)
        .where(
            RunningWorkout.plan_id == plan.id,
            RunningWorkout.type == "test",
            RunningWorkout.matched_activity_id.is_not(None),
            Activity.user_id == plan.user_id,
        )
    ).all()
    efforts = [
        _effort_from_activity(activity, cardio, matched_workout_id=workout.id)
        for workout, activity, cardio in rows
    ]
    return [
        effort
        for effort in efforts
        if _qualifies(
            effort,
            as_of=as_of,
            window_days=max_age_days,
            min_distance_m=MIN_QUALIFYING_DISTANCE_M,
        )
    ]


def _qualifying_recent_efforts(
    session: Session,
    user_id: uuid.UUID,
    *,
    as_of: dt.date,
    window_days: int = RECENCY_WINDOW_DAYS,
    min_distance_m: float = MIN_QUALIFYING_DISTANCE_M,
) -> list[RecentEffort]:
    start, end = _recency_window(as_of, window_days)
    rows = session.exec(run_activity_query(user_id, start, end)).all()
    efforts = [_effort_from_activity(activity, cardio) for activity, cardio in rows]
    return [
        effort
        for effort in efforts
        if _qualifies(
            effort,
            as_of=as_of,
            window_days=window_days,
            min_distance_m=min_distance_m,
        )
    ]


def best_test_effort(
    session: Session,
    plan: RunningPlan,
    *,
    as_of: dt.date,
    max_age_days: int = RECENCY_WINDOW_DAYS,
) -> RecentEffort | None:
    """Best fitness-test mark inside the window, if any (R2/R5)."""
    ranked = _rank_efforts(
        _qualifying_test_efforts(session, plan, as_of=as_of, max_age_days=max_age_days)
    )
    return ranked[0] if ranked else None


def best_recent_effort(
    session: Session,
    user_id: uuid.UUID,
    *,
    as_of: dt.date,
    window_days: int = RECENCY_WINDOW_DAYS,
    min_distance_m: float = MIN_QUALIFYING_DISTANCE_M,
) -> RecentEffort | None:
    """Best synced-activity effort inside the window, if any (R2/R3)."""
    ranked = _rank_efforts(
        _qualifying_recent_efforts(
            session,
            user_id,
            as_of=as_of,
            window_days=window_days,
            min_distance_m=min_distance_m,
        )
    )
    return ranked[0] if ranked else None


def estimate_vdot_from_activity(activity: RecentEffort) -> VdotEstimate:
    """Derive a VDOT estimate from one piece of evidence (R1/R6/R27).

    Pure: it only delegates to the frozen Daniels math and never touches state.
    """
    vdot = calculate_vdot(activity.distance_meters, activity.time_seconds)
    source: RecalibrationSource = "test" if activity.is_test_mark else "activity"
    confidence: Confidence = "measured" if activity.is_test_mark else "estimated"
    evidence = {
        "source": source,
        "source_id": str(activity.activity_id),
        "matched_workout_id": (
            str(activity.matched_workout_id) if activity.matched_workout_id else None
        ),
        "distance_meters": activity.distance_meters,
        "time_seconds": activity.time_seconds,
        "effective_date": activity.date.isoformat(),
        "confidence": confidence,
        "secondary": [],
    }
    return VdotEstimate(
        vdot=vdot, source=source, confidence=confidence, evidence=evidence
    )


def estimate_vdot_for_plan(
    session: Session, plan: RunningPlan, *, as_of: dt.date
) -> VdotEstimate | None:
    """Best available estimate for a plan: test mark > activity > None (R4/R5)."""
    test_efforts = _rank_efforts(_qualifying_test_efforts(session, plan, as_of=as_of))
    activity_efforts = _rank_efforts(
        _qualifying_recent_efforts(session, plan.user_id, as_of=as_of)
    )

    if test_efforts:
        estimate = estimate_vdot_from_activity(test_efforts[0])
        secondary = _secondary_entries(
            [*test_efforts, *activity_efforts], exclude=test_efforts[0].activity_id
        )
        return replace(estimate, evidence={**estimate.evidence, "secondary": secondary})

    if activity_efforts:
        estimate = estimate_vdot_from_activity(activity_efforts[0])
        secondary = _secondary_entries(
            activity_efforts, exclude=activity_efforts[0].activity_id
        )
        return replace(estimate, evidence={**estimate.evidence, "secondary": secondary})

    return None


def classify_recalibration(
    current_vdot: float, new_vdot: float
) -> RecalibrationClassification:
    """Classify a recalibration against the derived current VDOT (R15/R16/R29).

    `current_vdot` is the latest applied recalibration, never `baseline.vdot`.
    """
    delta = round(new_vdot - current_vdot, 1)
    kind: RecalibrationKind = "decline" if new_vdot < current_vdot else "improve"
    return RecalibrationClassification(
        delta_vdot=delta,
        kind=kind,
        suspicious=delta > SUSPICIOUS_DELTA_THRESHOLD,
    )


def workout_pace_for(
    workout_type: str, paces: dict[str, float], current_pace: float | None
) -> float | None:
    """Workout-level pace for a workout type; `race` keeps its stored pace (R11/R12)."""
    if workout_type == "race":
        return current_pace
    return paces.get(_WORKOUT_PACE_KEY.get(workout_type, "easy_min"))


def block_paces_for(
    workout_type: str,
    *,
    block_type: str,
    block_count: int,
    paces: dict[str, float],
    target_km: float,
    progression_level: int,
    total_km: float,
    current_pace: float | None,
    current_range: float | None,
) -> tuple[float | None, float | None]:
    """Block pace + range, delegated to the generator's own rules (R11/R12/R24).

    `block_type`/`progression_level`/`total_km` are the same inputs the plan
    generator uses, so a recalibration reproduces the generated paces exactly and
    distances and repetition counts are never touched. `race` blocks are
    goal-pinned (D6): their stored pace pair is returned unchanged.
    """
    if workout_type == "race":
        return (current_pace, current_range)
    return resolve_block_paces(
        workout_type=workout_type,
        block_type=block_type,
        paces=paces,
        total_km=total_km,
        target_km=target_km,
        progression_level=progression_level,
        block_count=block_count,
    )


def _phase_levels(snapshot: PlanSnapshot) -> dict[uuid.UUID, int]:
    """Workout id → `progression_level` (its phase position), as generated (R12)."""
    level_by_phase = {phase.id: phase.position for phase in snapshot.phases}
    level_by_week = {
        week.id: level_by_phase.get(week.phase_id, 1) for week in snapshot.weeks
    }
    return {
        workout.id: level_by_week.get(workout.week_id, 1)
        for workout in snapshot.workouts
    }


def resolve_effective_from_week(
    weeks: Sequence[RunningWeek],
    *,
    week_start_day: int,
    plan_start_date: dt.date,
    today_local: dt.date,
) -> tuple[int, dt.date] | None:
    """First week strictly after today, per the plan's week_start_day (R14).

    The current week is NEVER selected, even when apply runs exactly on the
    plan's week-start day. Returns `None` when no future week remains.
    """
    first_week_start = plan_start_date - dt.timedelta(
        days=week_start_offset(plan_start_date.isoweekday(), week_start_day)
    )
    candidates: list[tuple[int, dt.date]] = []
    for week in weeks:
        start = week.start_date or (
            first_week_start + dt.timedelta(days=7 * (week.number - 1))
        )
        if start > today_local:
            candidates.append((week.number, start))
    if not candidates:
        return None
    return min(candidates, key=lambda item: (item[1], item[0]))


def _workout_in(
    workout: RunningWorkout, blocks: Sequence[WorkoutBlock]
) -> WorkoutIn:
    return WorkoutIn(
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
        blocks=[
            WorkoutBlockIn(
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
            for block in sorted(blocks, key=lambda item: item.position)
        ],
    )


def plan_to_create(snapshot: PlanSnapshot) -> RunningPlanCreate:
    """Rebuild the persisted plan as a `RunningPlanCreate` for validation (R17)."""
    plan = snapshot.plan

    weeks_by_phase: dict[uuid.UUID, list[RunningWeek]] = {}
    for week in sorted(snapshot.weeks, key=lambda item: item.number):
        weeks_by_phase.setdefault(week.phase_id, []).append(week)

    workouts_by_week: dict[uuid.UUID, list[RunningWorkout]] = {}
    for workout in sorted(
        snapshot.workouts, key=lambda item: (item.date, str(item.id))
    ):
        workouts_by_week.setdefault(workout.week_id, []).append(workout)

    phases = [
        PhaseIn(
            position=phase.position,
            name=phase.name,
            color=phase.color,
            start_week=phase.start_week,
            end_week=phase.end_week,
            objective=phase.objective,
            description=phase.description,
            weeks=[
                WeekIn(
                    number=week.number,
                    start_date=week.start_date,
                    end_date=week.end_date,
                    name=week.name,
                    objective=week.objective,
                    notes=week.notes,
                    workouts=[
                        _workout_in(workout, snapshot.blocks.get(workout.id, ()))
                        for workout in workouts_by_week.get(week.id, [])
                    ],
                )
                for week in weeks_by_phase.get(phase.id, [])
            ],
        )
        for phase in sorted(snapshot.phases, key=lambda item: item.position)
    ]

    return RunningPlanCreate(
        name=plan.name,
        goal=plan.goal,
        distance_km=plan.distance_km,
        distance_unit=plan.distance_unit,
        target_time_seconds=plan.target_time_seconds,
        target_pace_seconds_per_km=plan.target_pace_seconds_per_km,
        start_date=plan.start_date,
        end_date=plan.end_date,
        week_start_day=plan.week_start_day,
        status=plan.status,
        notes=plan.notes,
        engine_version=plan.engine_version,
        baseline=plan.baseline,
        generation_params=plan.generation_params,
        race_id=plan.race_id,
        phases=phases,
    )


def recalibration_preview(
    snapshot: PlanSnapshot,
    *,
    current_vdot: float,
    new_vdot: float,
    source: RecalibrationSource,
    evidence: dict,
    effective_from: tuple[int, dt.date],
) -> RecalibrationPreview:
    """Deterministic, read-only preview of a future-only pace rewrite (R7/R8/R9).

    Only workouts whose start date is on/after `effective_from` are considered,
    and only sessions whose pace actually moves are reported as changes.
    """
    effective_week, effective_date = effective_from
    old_paces = get_training_paces_seconds(current_vdot)
    new_paces = get_training_paces_seconds(new_vdot)
    classification = classify_recalibration(current_vdot, new_vdot)
    target_km = snapshot.plan.distance_km or 0.0
    weeks_by_id = {week.id: week for week in snapshot.weeks}
    levels = _phase_levels(snapshot)

    changes: list[RecalibrationChange] = []
    affected_weeks: set[int] = set()

    for workout in sorted(
        snapshot.workouts, key=lambda item: (item.date, str(item.id))
    ):
        if workout.date < effective_date:
            continue

        blocks = snapshot.blocks.get(workout.id, [])
        new_workout_pace = workout_pace_for(
            workout.type, new_paces, workout.pace_seconds_per_km
        )
        changed = new_workout_pace != workout.pace_seconds_per_km
        for block in blocks:
            block_pace, block_range = block_paces_for(
                workout.type,
                block_type=block.block_type,
                block_count=len(blocks),
                paces=new_paces,
                target_km=target_km,
                progression_level=levels.get(workout.id, 1),
                total_km=workout.distance_km or 0.0,
                current_pace=block.pace_seconds_per_km,
                current_range=block.pace_range_end_seconds_per_km,
            )
            if (
                block_pace != block.pace_seconds_per_km
                or block_range != block.pace_range_end_seconds_per_km
            ):
                changed = True

        if not changed:
            continue

        changes.append(
            RecalibrationChange(
                workout_id=workout.id,
                date=workout.date,
                type=workout.type,
                old_pace=workout.pace_seconds_per_km,
                new_pace=new_workout_pace,
            )
        )
        week = weeks_by_id.get(workout.week_id)
        if week is not None:
            affected_weeks.add(week.number)

    return RecalibrationPreview(
        old_vdot=current_vdot,
        new_vdot=new_vdot,
        delta_vdot=classification.delta_vdot,
        kind=classification.kind,
        suspicious=classification.suspicious,
        source=source,
        evidence=evidence,
        old_paces=old_paces,
        new_paces=new_paces,
        effective_from_week=effective_week,
        effective_from_date=effective_date,
        affected_weeks=sorted(affected_weeks),
        changes=changes,
    )


def snapshot_plan(session: Session, plan: RunningPlan) -> PlanSnapshot:
    """Load the plan's structure as its LIVE session-bound ORM objects (D3/NEW-5).

    Returning the plan's own Session objects — never detached copies — is what
    makes `apply_recalibration` + `session.flush()` persist.
    """
    phases = list(
        session.exec(
            select(RunningPhase)
            .where(RunningPhase.plan_id == plan.id)
            .order_by(col(RunningPhase.position))
        ).all()
    )

    weeks: list[RunningWeek] = []
    workouts: list[RunningWorkout] = []
    blocks: dict[uuid.UUID, list[WorkoutBlock]] = {}
    for phase in phases:
        phase_weeks = session.exec(
            select(RunningWeek)
            .where(RunningWeek.phase_id == phase.id)
            .order_by(col(RunningWeek.number))
        ).all()
        for week in phase_weeks:
            weeks.append(week)
            week_workouts = session.exec(
                select(RunningWorkout)
                .where(RunningWorkout.week_id == week.id)
                .order_by(col(RunningWorkout.date))
            ).all()
            for workout in week_workouts:
                workouts.append(workout)
                blocks[workout.id] = list(
                    session.exec(
                        select(WorkoutBlock)
                        .where(WorkoutBlock.workout_id == workout.id)
                        .order_by(col(WorkoutBlock.position))
                    ).all()
                )

    return PlanSnapshot(
        plan=plan, phases=phases, weeks=weeks, workouts=workouts, blocks=blocks
    )


def derive_current_vdot(
    baseline: dict | None, last_applied: PlanRecalibration | None
) -> float | None:
    """Current VDOT: latest applied recalibration, else `baseline.vdot` (R29).

    `baseline.vdot` is never written back, so generation stays untouched.
    """
    if last_applied is not None:
        return last_applied.new_vdot
    if baseline:
        vdot = baseline.get("vdot")
        if isinstance(vdot, dict) and vdot.get("value") is not None:
            return float(vdot["value"])
    return None


def latest_applied_recalibration(
    session: Session, plan: RunningPlan
) -> PlanRecalibration | None:
    """Most recent APPLIED recalibration for a plan, or None (R29).

    Takes the plan (not a raw `plan_id`) and filters by its owner as well, so no
    caller — present or future — can read another user's recalibration history.
    A row whose `plan_id` matches but whose `user_id` does not is ignored.
    """
    return session.exec(
        select(PlanRecalibration)
        .where(
            PlanRecalibration.plan_id == plan.id,
            PlanRecalibration.user_id == plan.user_id,
            PlanRecalibration.applied.is_(True),
        )
        .order_by(
            col(PlanRecalibration.created_at).desc(),
            col(PlanRecalibration.id).desc(),
        )
    ).first()


def apply_recalibration(
    snapshot: PlanSnapshot, *, new_vdot: float, effective_from_date: dt.date
) -> RecalibrationResult:
    """Rewrite future-workout paces in place (R10-R14, R25).

    Mutates the snapshot's LIVE session-bound ORM objects: the caller's
    `session.flush()`/`commit()` persists the change. Only
    `pace_seconds_per_km` and the paired block range move — never dates,
    distances, structure, statuses or past weeks.
    """
    new_paces = get_training_paces_seconds(new_vdot)
    target_km = snapshot.plan.distance_km or 0.0
    weeks_by_id = {week.id: week for week in snapshot.weeks}
    levels = _phase_levels(snapshot)

    affected_workouts = 0
    affected_blocks = 0
    affected_weeks: set[int] = set()

    for workout in snapshot.workouts:
        if workout.date < effective_from_date:
            continue

        blocks = snapshot.blocks.get(workout.id, [])
        changed = False

        new_pace = workout_pace_for(
            workout.type, new_paces, workout.pace_seconds_per_km
        )
        if new_pace != workout.pace_seconds_per_km:
            workout.pace_seconds_per_km = new_pace
            changed = True

        for block in blocks:
            pace, pace_range = block_paces_for(
                workout.type,
                block_type=block.block_type,
                block_count=len(blocks),
                paces=new_paces,
                target_km=target_km,
                progression_level=levels.get(workout.id, 1),
                total_km=workout.distance_km or 0.0,
                current_pace=block.pace_seconds_per_km,
                current_range=block.pace_range_end_seconds_per_km,
            )
            block_changed = False
            if pace != block.pace_seconds_per_km:
                block.pace_seconds_per_km = pace
                block_changed = True
            if pace_range != block.pace_range_end_seconds_per_km:
                block.pace_range_end_seconds_per_km = pace_range
                block_changed = True
            if block_changed:
                affected_blocks += 1
                changed = True

        if changed:
            affected_workouts += 1
            week = weeks_by_id.get(workout.week_id)
            if week is not None:
                affected_weeks.add(week.number)

    return RecalibrationResult(
        affected_workouts=affected_workouts,
        affected_blocks=affected_blocks,
        affected_weeks=sorted(affected_weeks),
    )
