"""Dynamic plan adaptation service (M2: adherence, missed long runs, RPE & injury).

Implements deterministic, explicable adaptation rules (R1 to R5) according to
coaching principles:
- R1 (Low adherence): when <60% completed & missed quality -> repeat volume load.
- R2 (Missed long run): when long run skipped -> freeze long run distance next week.
- R3 (High perceived effort): 2+ easy runs with RPE >= 8 -> ease paces +8s/km.
- R4 (Under-stimulated): 2+ quality runs with RPE <= 3 -> tighten paces -5s/km.
- R5 (Injury/fatigue): injury/sickness reported -> replace quality with regeneration & reduce vol 25%.
"""

import datetime as dt
import logging
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, time

from sqlmodel import Session, col, select

from app.models import (
    Activity,
    ActivityCardio,
    AdaptationSuggestionPublic,
    PlanAdaptation,
    RunningPhase,
    RunningPlan,
    RunningWeek,
    RunningWorkout,
    WorkoutBlock,
    WorkoutStatus,
)
from app.services.fitness import snapshot_plan
from app.services.running import RUNNING_TIMEZONE, resolve_workout_status

logger = logging.getLogger(__name__)

INJURY_KEYWORDS = (
    "lesión",
    "lesion",
    "dolor",
    "molestia",
    "tendón",
    "tendon",
    "enfermo",
    "gripe",
    "fiebre",
    "injury",
    "sick",
    "pain",
    "illness",
)

HIGH_EFFORT_KEYWORDS = (
    "duro",
    "dura",
    "agotad",
    "fatiga",
    "exhaust",
    "fundid",
    "strong",
    "pesad",
)

LOW_EFFORT_KEYWORDS = (
    "fácil",
    "facil",
    "sin esfuerzo",
    "demasiado lento",
    "muy comodo",
    "muy cómodo",
)


def _today_local() -> dt.date:
    return datetime.now(RUNNING_TIMEZONE).date()


def _get_workout_activity_info(
    session: Session, user_id: uuid.UUID, workout: RunningWorkout
) -> tuple[WorkoutStatus, ActivityCardio | None, str | None]:
    """Resolves workout status and its cardio/effort metadata."""
    status, matched = resolve_workout_status(session, user_id, workout)
    cardio: ActivityCardio | None = None
    notes: str | None = workout.notes

    if matched and "activity_id" in matched:
        act_cardio = session.exec(
            select(ActivityCardio).where(
                ActivityCardio.activity_id == matched["activity_id"]
            )
        ).first()
        if act_cardio:
            cardio = act_cardio
            if act_cardio.perceived_effort_notes:
                notes = (
                    f"{notes or ''} {act_cardio.perceived_effort_notes}".strip()
                )

    return status, cardio, notes


def evaluate_plan_adaptations(
    session: Session,
    plan: RunningPlan,
    *,
    today_local: dt.date | None = None,
) -> tuple[list[AdaptationSuggestionPublic], int | None]:
    """Evaluates rules R1 to R5 on the plan given current athlete status."""
    today = today_local or _today_local()
    snapshot = snapshot_plan(session, plan)

    if not snapshot.weeks:
        return [], None

    weeks_sorted = sorted(snapshot.weeks, key=lambda w: w.number)
    weeks_by_id = {w.id: w.number for w in snapshot.weeks}

    # Determine current or evaluated week based on today
    current_week_idx: int | None = None
    for idx, w in enumerate(weeks_sorted):
        if w.start_date and w.end_date:
            if w.start_date <= today <= w.end_date:
                current_week_idx = idx
                break
        elif w.start_date and w.start_date <= today:
            current_week_idx = idx

    # If before first week, no adaptation needed yet
    if current_week_idx is None:
        if weeks_sorted[0].start_date and today < weeks_sorted[0].start_date:
            return [], None
        # Default to latest started week
        current_week_idx = len(weeks_sorted) - 1

    current_week = weeks_sorted[current_week_idx]

    # For weekly adherence and progression rules (R1, R2):
    # Evaluate the most recently completed full week if available, or the current week.
    completed_weeks = [w for w in weeks_sorted if w.end_date and w.end_date < today]
    if completed_weeks:
        eval_week = completed_weeks[-1]
    else:
        eval_week = current_week

    # Target week to which adjustments can be applied
    next_week: RunningWeek | None = None
    for w in weeks_sorted:
        if w.number == eval_week.number + 1:
            next_week = w
            break
    if next_week is None and eval_week == current_week and current_week_idx + 1 < len(weeks_sorted):
        next_week = weeks_sorted[current_week_idx + 1]

    # Helper: whether a workout is pending/upcoming and can be adapted
    def is_upcoming(w: RunningWorkout) -> bool:
        return (w.date > today) or (w.date == today and statuses.get(w.id) != "completed")

    # Resolve workout statuses for all workouts up to today
    statuses: dict[uuid.UUID, WorkoutStatus] = {}
    cardios: dict[uuid.UUID, ActivityCardio | None] = {}
    notes_map: dict[uuid.UUID, str | None] = {}

    for w in snapshot.workouts:
        st, c, n = _get_workout_activity_info(session, plan.user_id, w)
        statuses[w.id] = st
        cardios[w.id] = c
        notes_map[w.id] = n

    suggestions: list[AdaptationSuggestionPublic] = []

    # -------------------------------------------------------------------------
    # R1: Low Adherence (<60% & missed quality) -> Freeze / repeat volume
    # -------------------------------------------------------------------------
    eval_workouts = [w for w in snapshot.workouts if w.week_id == eval_week.id and not w.cancelled]
    if len(eval_workouts) >= 2 and next_week is not None:
        completed_count = sum(1 for w in eval_workouts if statuses.get(w.id) == "completed")
        adherence_ratio = completed_count / len(eval_workouts)
        missed_quality = any(
            w for w in eval_workouts
            if w.type in ("intervals", "tempo")
            and statuses.get(w.id) in ("missed", "cancelled", "planned")
            and w.date <= today
        )

        if adherence_ratio < 0.60 and missed_quality:
            eval_vol = sum(w.distance_km or 0.0 for w in eval_workouts)
            next_workouts = [w for w in snapshot.workouts if w.week_id == next_week.id and not w.cancelled]
            next_vol = sum(w.distance_km or 0.0 for w in next_workouts)

            if next_vol > eval_vol:
                suggestions.append(
                    AdaptationSuggestionPublic(
                        rule_code="R1_LOW_ADHERENCE",
                        title="Adherencia baja en la última semana (<60%)",
                        reason=(
                            f"Completaste {completed_count} de {len(eval_workouts)} sesiones y se perdió "
                            f"una sesión de calidad clave. Progresar la carga en este momento "
                            f"incrementa el riesgo de sobreentrenamiento."
                        ),
                        severity="warning",
                        before_summary=f"Progresión de volumen a {round(next_vol, 1)} km en Semana {next_week.number}.",
                        after_summary=f"Repetir carga de {round(eval_vol, 1)} km para consolidar adaptaciones antes de aumentar volumen.",
                        affected_weeks=[next_week.number],
                        affected_workouts_count=len(next_workouts),
                        params={"target_volume_km": round(eval_vol, 1), "week_number": next_week.number},
                    )
                )

    # -------------------------------------------------------------------------
    # R2: Missed Long Run -> Freeze long run distance next week
    # -------------------------------------------------------------------------
    if next_week is not None:
        eval_lr = next(
            (w for w in eval_workouts if w.type == "long_run" and not w.cancelled),
            None,
        )
        if eval_lr and statuses.get(eval_lr.id) in ("missed", "cancelled") and eval_lr.date <= today:
            next_lr = next(
                (w for w in snapshot.workouts if w.week_id == next_week.id and w.type == "long_run" and not w.cancelled),
                None,
            )
            if next_lr and (next_lr.distance_km or 0.0) > (eval_lr.distance_km or 0.0):
                suggestions.append(
                    AdaptationSuggestionPublic(
                        rule_code="R2_MISSED_LONG_RUN",
                        title="Tirada larga previa no completada",
                        reason=(
                            f"No se completó la tirada larga de {eval_lr.distance_km} km. "
                            f"Aumentar los kilómetros de fondo sin la base previa aumenta la fatiga residual."
                        ),
                        severity="warning",
                        before_summary=f"Tirada larga de {next_lr.distance_km} km prevista en Semana {next_week.number}.",
                        after_summary=f"Mantener tirada larga en {eval_lr.distance_km} km para evitar saltos bruscos.",
                        affected_weeks=[next_week.number],
                        affected_workouts_count=1,
                        params={"frozen_km": eval_lr.distance_km, "workout_id": str(next_lr.id)},
                    )
                )

    # -------------------------------------------------------------------------
    # R3: High Perceived Effort (2+ easy runs with RPE >= 8 or fatigue)
    # -------------------------------------------------------------------------
    cutoff_14d = today - dt.timedelta(days=14)
    recent_workouts = [w for w in snapshot.workouts if cutoff_14d <= w.date <= today and statuses.get(w.id) == "completed"]

    high_effort_easy_runs = []
    for w in recent_workouts:
        if w.type in ("easy_run", "regeneration", "activation"):
            c = cardios.get(w.id)
            n = (notes_map.get(w.id) or "").lower()
            rpe = c.rpe if c and c.rpe else None
            is_high_effort = (rpe is not None and rpe >= 8) or any(kw in n for kw in HIGH_EFFORT_KEYWORDS)
            if is_high_effort:
                high_effort_easy_runs.append(w)

    if len(high_effort_easy_runs) >= 2:
        future_easy = [w for w in snapshot.workouts if is_upcoming(w) and w.type in ("easy_run", "regeneration", "activation")]
        if future_easy:
            suggestions.append(
                AdaptationSuggestionPublic(
                    rule_code="R3_HIGH_PERCEIVED_EFFORT",
                    title="Sobrecoste percibido en rodajes suaves (RPE ≥ 8)",
                    reason=(
                        f"En {len(high_effort_easy_runs)} rodajes suaves recientes registraste un esfuerzo "
                        f"elevado (RPE ≥ 8 o fatiga alta). Conviene suavizar los ritmos para que sigan "
                        f"siendo regenerativos (Zona 2 real)."
                    ),
                    severity="warning",
                    before_summary="Ritmos de rodaje suave actuales.",
                    after_summary="Suavizar ritmos +8 s/km en sesiones fáciles futuras para asegurar asimilación.",
                    affected_weeks=sorted(list({w_num for w in future_easy if (w_num := weeks_by_id.get(w.week_id)) is not None})),
                    affected_workouts_count=len(future_easy),
                    params={"pace_offset_seconds": 8},
                )
            )

    # -------------------------------------------------------------------------
    # R4: Under-stimulated (2+ quality runs with RPE <= 3)
    # -------------------------------------------------------------------------
    low_effort_quality_runs = []
    for w in recent_workouts:
        if w.type in ("intervals", "tempo"):
            c = cardios.get(w.id)
            n = (notes_map.get(w.id) or "").lower()
            rpe = c.rpe if c and c.rpe else None
            is_low_effort = (rpe is not None and rpe <= 3) or any(kw in n for kw in LOW_EFFORT_KEYWORDS)
            if is_low_effort:
                low_effort_quality_runs.append(w)

    if len(low_effort_quality_runs) >= 2:
        future_quality = [w for w in snapshot.workouts if is_upcoming(w) and w.type in ("intervals", "tempo")]
        if future_quality:
            suggestions.append(
                AdaptationSuggestionPublic(
                    rule_code="R4_UNDER_STIMULATED",
                    title="Sesiones de calidad infrautilizadas (RPE ≤ 3)",
                    reason=(
                        f"En {len(low_effort_quality_runs)} entrenamientos de calidad reportaste un esfuerzo "
                        f"muy bajo (RPE ≤ 3). Tu estado de forma permite aumentar la exigencia para "
                        f"maximizar la mejora de umbral y VO2máx."
                    ),
                    severity="info",
                    before_summary="Ritmos de umbral e intervalos actuales.",
                    after_summary="Acelerar ritmos -5 s/km en entrenamientos de calidad futuros.",
                    affected_weeks=sorted(list({w_num for w in future_quality if (w_num := weeks_by_id.get(w.week_id)) is not None})),
                    affected_workouts_count=len(future_quality),
                    params={"pace_offset_seconds": -5},
                )
            )

    # -------------------------------------------------------------------------
    # R5: Injury / Fatigue keywords reported -> Recovery block
    # -------------------------------------------------------------------------
    injury_reported = False
    injury_mention = ""
    for w in recent_workouts:
        n = (notes_map.get(w.id) or "").lower()
        for kw in INJURY_KEYWORDS:
            if kw in n:
                injury_reported = True
                injury_mention = kw
                break
        if injury_reported:
            break

    if injury_reported and next_week is not None:
        next_workouts = [w for w in snapshot.workouts if w.week_id == next_week.id and not w.cancelled]
        quality_in_next = [w for w in next_workouts if w.type in ("intervals", "tempo")]
        if quality_in_next or next_workouts:
            suggestions.append(
                AdaptationSuggestionPublic(
                    rule_code="R5_INJURY_FATIGUE",
                    title="Alerta de molestia o lesión reportada",
                    reason=(
                        f"Se detectó mención de molestia o fatiga extrema ('{injury_mention}') en tus "
                        f"notas recientes. Recomendamos convertir las sesiones de calidad en "
                        f"regeneración activa y descargar volumen para prevenir lesiones mayores."
                    ),
                    severity="critical",
                    before_summary=f"Semana {next_week.number} con sesiones de intensidad programadas.",
                    after_summary="Sustituir series/tempo por regeneración y reducir volumen un 25%.",
                    affected_weeks=[next_week.number],
                    affected_workouts_count=len(next_workouts),
                    params={"week_number": next_week.number, "volume_factor": 0.75},
                )
            )

    return suggestions, eval_week.number


def apply_plan_adaptations(
    session: Session,
    plan: RunningPlan,
    *,
    selected_rule_codes: list[str],
    today_local: dt.date | None = None,
) -> tuple[list[PlanAdaptation], int]:
    """Applies selected adaptation suggestions and records audit rows."""
    today = today_local or _today_local()
    suggestions, _ = evaluate_plan_adaptations(session, plan, today_local=today)

    active_by_code = {s.rule_code: s for s in suggestions}
    to_apply = [active_by_code[code] for code in selected_rule_codes if code in active_by_code]

    if not to_apply:
        return [], 0

    snapshot = snapshot_plan(session, plan)
    weeks_by_num = {w.number: w for w in snapshot.weeks}
    updated_workouts: set[uuid.UUID] = set()
    persisted_records: list[PlanAdaptation] = []

    for item in to_apply:
        code = item.rule_code

        if code == "R1_LOW_ADHERENCE":
            target_vol = item.params.get("target_volume_km")
            wk_num = item.params.get("week_number")
            if target_vol and wk_num and wk_num in weeks_by_num:
                target_week = weeks_by_num[wk_num]
                w_list = [w for w in snapshot.workouts if w.week_id == target_week.id and not w.cancelled]
                curr_vol = sum(w.distance_km or 0.0 for w in w_list)
                if curr_vol > target_vol and curr_vol > 0:
                    scale = target_vol / curr_vol
                    for w in w_list:
                        if w.distance_km:
                            w.distance_km = round(max(3.0, w.distance_km * scale), 1)
                            updated_workouts.add(w.id)
                            # Scale blocks
                            for b in snapshot.blocks.get(w.id, []):
                                if b.distance_m:
                                    b.distance_m = round(b.distance_m * scale)

        elif code == "R2_MISSED_LONG_RUN":
            frozen_km = item.params.get("frozen_km")
            w_id_str = item.params.get("workout_id")
            if frozen_km and w_id_str:
                w_id = uuid.UUID(str(w_id_str))
                for w in snapshot.workouts:
                    if w.id == w_id and w.distance_km and w.distance_km > frozen_km:
                        w.distance_km = frozen_km
                        updated_workouts.add(w.id)
                        # Adjust main block distance
                        for b in snapshot.blocks.get(w.id, []):
                            if b.block_type == "main" and b.distance_m:
                                b.distance_m = round(frozen_km * 1000)

        elif code == "R3_HIGH_PERCEIVED_EFFORT":
            offset = int(item.params.get("pace_offset_seconds", 8))
            for w in snapshot.workouts:
                if ((w.date > today) or (w.date == today and w.status_override != "completed")) and w.type in ("easy_run", "regeneration", "activation"):
                    if w.pace_seconds_per_km:
                        w.pace_seconds_per_km += offset
                        updated_workouts.add(w.id)
                    for b in snapshot.blocks.get(w.id, []):
                        if b.pace_seconds_per_km:
                            b.pace_seconds_per_km += offset
                        if b.pace_range_end_seconds_per_km:
                            b.pace_range_end_seconds_per_km += offset

        elif code == "R4_UNDER_STIMULATED":
            offset = int(item.params.get("pace_offset_seconds", -5))
            for w in snapshot.workouts:
                if ((w.date > today) or (w.date == today and w.status_override != "completed")) and w.type in ("intervals", "tempo"):
                    if w.pace_seconds_per_km:
                        w.pace_seconds_per_km = max(180.0, w.pace_seconds_per_km + offset)
                        updated_workouts.add(w.id)
                    for b in snapshot.blocks.get(w.id, []):
                        if b.pace_seconds_per_km:
                            b.pace_seconds_per_km = max(180.0, b.pace_seconds_per_km + offset)
                        if b.pace_range_end_seconds_per_km:
                            b.pace_range_end_seconds_per_km = max(180.0, b.pace_range_end_seconds_per_km + offset)

        elif code == "R5_INJURY_FATIGUE":
            wk_num = item.params.get("week_number")
            vol_factor = float(item.params.get("volume_factor", 0.75))
            if wk_num and wk_num in weeks_by_num:
                target_week = weeks_by_num[wk_num]
                w_list = [w for w in snapshot.workouts if w.week_id == target_week.id and not w.cancelled]
                for w in w_list:
                    if w.type in ("intervals", "tempo"):
                        w.type = "regeneration"
                        w.name = "Rodaje Regenerativo Suave"
                        w.objective = "Recuperación activa y asimilación sin estrés neuromuscular"
                        w.intensity = "easy"
                    if w.distance_km:
                        w.distance_km = round(max(3.0, w.distance_km * vol_factor), 1)
                    updated_workouts.add(w.id)

            # Enable conservative mode on plan generation params
            if plan.generation_params is None:
                plan.generation_params = {}
            params_dict = dict(plan.generation_params)
            params_dict["conservative_mode"] = True
            plan.generation_params = params_dict

        # Create audit record
        adaptation_row = PlanAdaptation(
            plan_id=plan.id,
            user_id=plan.user_id,
            rule_code=code,
            reason=item.reason,
            before_summary=item.before_summary,
            after_summary=item.after_summary,
            changes_json=item.params,
            applied=True,
        )
        session.add(adaptation_row)
        persisted_records.append(adaptation_row)

    session.flush()
    return persisted_records, len(updated_workouts)
