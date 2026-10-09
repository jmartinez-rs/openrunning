from datetime import timedelta
import math
from typing import List, Dict, Any

from app.models import (
    PlanGeneratorConfig,
    PlanValidationIssue,
    RunningPlanCreate,
    ValidationSeverity,
)
from app.services.running_math import calculate_vdot, get_training_paces_seconds, predict_time_riegel


def validate_plan_invariants(
    plan: RunningPlanCreate,
    config: PlanGeneratorConfig,
) -> List[PlanValidationIssue]:
    """Validates that a generated running plan satisfies all algorithmic and safety invariants."""
    issues: List[PlanValidationIssue] = []

    # Flatten all workouts across phases and weeks
    all_workouts = []
    weekly_volumes: List[float] = []
    weekly_long_runs: List[float] = []
    weekly_hard_counts: List[int] = []

    for phase in plan.phases:
        for week in phase.weeks:
            week_vol = sum(w.distance_km or 0.0 for w in week.workouts)
            weekly_volumes.append(week_vol)

            long_run_dist = max((w.distance_km or 0.0 for w in week.workouts), default=0.0)
            weekly_long_runs.append(long_run_dist)

            hard_count = sum(
                1 for w in week.workouts
                if w.intensity == "hard" or w.type in ["interval", "tempo", "repetition", "race", "fartlek"]
            )
            weekly_hard_counts.append(hard_count)

            for w in week.workouts:
                all_workouts.append(w)

    # 1. Unicidad de fechas
    seen_dates = set()
    duplicate_dates = set()
    for w in all_workouts:
        if w.date in seen_dates:
            duplicate_dates.add(w.date)
        seen_dates.add(w.date)

    if duplicate_dates:
        for d in sorted(duplicate_dates):
            issues.append(
                PlanValidationIssue(
                    code="DUPLICATE_WORKOUT_DATES",
                    severity="error",
                    message=f"Existe más de una sesión planificada para el día {d.isoformat()}.",
                    details={"date": d.isoformat()},
                )
            )

    # 2. Invariante de Días Duros Consecutivos (no 2 sesiones de calidad en días contiguos)
    sorted_workouts = sorted(all_workouts, key=lambda x: x.date)
    for i in range(len(sorted_workouts) - 1):
        w1 = sorted_workouts[i]
        w2 = sorted_workouts[i + 1]
        is_w1_hard = w1.intensity == "hard" or w1.type in ["interval", "tempo", "repetition", "race"]
        is_w2_hard = w2.intensity == "hard" or w2.type in ["interval", "tempo", "repetition", "race"]

        if is_w1_hard and is_w2_hard and (w2.date - w1.date) == timedelta(days=1):
            issues.append(
                PlanValidationIssue(
                    code="CONSECUTIVE_HARD_DAYS",
                    severity="error",
                    message=(
                        f"Sesiones de alta intensidad en días consecutivos ({w1.date.isoformat()} y {w2.date.isoformat()}). "
                        "Se requiere al menos 1 día de descanso/rodaje suave entre estímulos duros."
                    ),
                    details={"date_1": w1.date.isoformat(), "date_2": w2.date.isoformat()},
                )
            )

    # 3. Invariante de Incremento de Volumen Semanal (<= 15% semanal, excluyendo semanas post-descarga)
    num_weeks = len(weekly_volumes)
    for w in range(1, num_weeks):
        vol_prev = weekly_volumes[w - 1]
        vol_curr = weekly_volumes[w]

        # Detectar si la semana previa fue de descarga (cutback): menor que la semana anterior
        is_prev_cutback = False
        if w >= 2 and vol_prev < weekly_volumes[w - 2] * 0.85:
            is_prev_cutback = True

        # Si no fue descarga previa y hay un salto importante
        if vol_prev > 0 and not is_prev_cutback:
            growth = (vol_curr - vol_prev) / vol_prev
            if growth > 0.151: # >15% con margen de flotante
                issues.append(
                    PlanValidationIssue(
                        code="VOLUME_JUMP_EXCEEDED",
                        severity="warning" if growth < 0.25 else "error",
                        message=(
                            f"El incremento de volumen en la semana {w + 1} ({vol_curr:.1f} km vs {vol_prev:.1f} km, +{growth * 100:.1f}%) "
                            "supera el límite seguro recomendado (15%)."
                        ),
                        details={"week": w + 1, "previous_vol": vol_prev, "current_vol": vol_curr, "growth_percent": round(growth * 100, 1)},
                    )
                )

    # 4. Invariante de Tirada Larga (<= 35% del volumen semanal y topes por distancia)
    distance_caps = {
        5.0: 14.0,
        10.0: 18.0,
        21.1: 24.0,
        42.2: 35.0,
    }
    target_cap = 35.0
    for d_target, cap in sorted(distance_caps.items()):
        if config.target_km <= d_target:
            target_cap = cap
            break

    for w in range(num_weeks):
        vol = weekly_volumes[w]
        lr = weekly_long_runs[w]
        if vol > 0:
            ratio = lr / vol
            if ratio > 0.38 and vol > 15.0:
                issues.append(
                    PlanValidationIssue(
                        code="LONG_RUN_TOO_HIGH",
                        severity="warning",
                        message=(
                            f"En la semana {w + 1}, la tirada larga ({lr:.1f} km) representa el {ratio * 100:.0f}% del volumen total "
                            "semanal (recomendado <= 35%)."
                        ),
                        details={"week": w + 1, "long_run_km": lr, "weekly_vol_km": vol, "ratio_percent": round(ratio * 100, 1)},
                    )
                )
            if lr > target_cap + 0.5:
                issues.append(
                    PlanValidationIssue(
                        code="LONG_RUN_CAP_EXCEEDED",
                        severity="warning",
                        message=f"En la semana {w + 1}, la tirada larga ({lr:.1f} km) supera el máximo aconsejable para {config.target_km}K ({target_cap} km).",
                        details={"week": w + 1, "long_run_km": lr, "max_cap_km": target_cap},
                    )
                )

    # 5. Máximo 2 sesiones duras por semana
    for w in range(num_weeks):
        hard_count = weekly_hard_counts[w]
        if hard_count > 2:
            issues.append(
                PlanValidationIssue(
                    code="TOO_MANY_HARD_SESSIONS",
                    severity="warning",
                    message=f"La semana {w + 1} tiene {hard_count} sesiones de alta intensidad (máximo recomendado: 2).",
                    details={"week": w + 1, "hard_sessions": hard_count},
                )
            )

    # 6. Invariante de Afilamiento (Taper en la última semana)
    if num_weeks >= 4:
        peak_vol = max(weekly_volumes[:-1], default=0.0)
        last_vol = weekly_volumes[-1]
        if peak_vol > 0 and last_vol >= peak_vol * 0.95:
            issues.append(
                PlanValidationIssue(
                    code="MISSING_TAPER",
                    severity="warning",
                    message="Falta reducción de volumen (taper) en la última semana antes del objetivo.",
                    details={"peak_volume": peak_vol, "last_week_volume": last_vol},
                )
            )

    # 7. Brecha de objetivo (Goal Gap Analysis)
    vdot = config.baseline.vdot.value
    if vdot > 0 and config.target_time_seconds and config.target_time_seconds > 0:
        paces = get_training_paces_seconds(vdot)
        # Use threshold/marathon pace for VDOT race pace prediction
        race_pace_est = paces["marathon"] if config.target_km >= 21.1 else paces["threshold"]
        pred_seconds = race_pace_est * config.target_km if race_pace_est > 0 else 0.0

        if pred_seconds > 0 and config.target_time_seconds < pred_seconds * 0.90:
            issues.append(
                PlanValidationIssue(
                    code="GOAL_GAP_HIGH",
                    severity="warning",
                    message=(
                        f"El tiempo objetivo deseado ({config.target_time_seconds // 60} min) es muy exigente respecto a tu "
                        f"punto de partida actual (estimado {int(pred_seconds // 60)} min con VDOT {vdot:.1f}). "
                        "El plan se enfocará en construir la base sin sobrecargarte."
                    ),
                    details={"target_time_sec": config.target_time_seconds, "predicted_time_sec": pred_seconds},
                )
            )

    # 8. Modo conservador / Inactividad aviso
    if config.conservative_mode:
        issues.append(
            PlanValidationIssue(
                code="CONSERVATIVE_MODE_ACTIVE",
                severity="info",
                message="Modo conservador activo: el volumen inicial se redujo un 10% y las cargas se incrementan gradualmente.",
            )
        )

    return issues
