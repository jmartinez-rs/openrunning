from datetime import date, timedelta
import math
from typing import Dict, List, Tuple

from app.models import (
    AthleteBaseline,
    Confidence,
    PhaseIn,
    PlanDraftResponse,
    PlanGeneratorConfig,
    PlanValidationIssue,
    RunningPlanCreate,
    WeekIn,
    WorkoutBlockIn,
    WorkoutIn,
)
from app.services.plan_validator import validate_plan_invariants
from app.services.running_math import calculate_vdot, get_training_paces_seconds
from app.services.workout_library import build_daniels_blocks_with_ranges


def _add_days(d: date, days: int) -> date:
    return d + timedelta(days=days)


def _format_pace_mmss(seconds_per_km: float) -> str:
    if not seconds_per_km or seconds_per_km <= 0:
        return "0:00"
    m = int(seconds_per_km // 60)
    s = int(round(seconds_per_km % 60))
    if s >= 60:
        m += 1
        s -= 60
    return f"{m}:{s:02d}"


def calculate_peak_volume(start_km: float, target_km: float) -> float:
    """Calculates safe peak volume based on baseline and target race distance."""
    if target_km <= 5.0:
        return max(start_km * 1.25, 25.0)
    elif target_km <= 10.0:
        return max(start_km * 1.35, 35.0)
    elif target_km <= 21.1:
        return max(start_km * 1.50, 45.0)
    else:
        return max(start_km * 1.65, 55.0)


def generate_volume_curve(
    start_km: float,
    target_km: float,
    num_weeks: int,
    confidence: Confidence = "measured",
    conservative_mode: bool = False,
) -> List[float]:
    """Generates periodized weekly volume curve with cutbacks and distance-tailored taper."""
    if num_weeks <= 0:
        return []
    if num_weeks == 1:
        return [round(target_km, 1)]

    # Growth rate mapping based on confidence
    if confidence == "measured" and not conservative_mode:
        growth_rate = 0.08
    elif confidence == "declared" and not conservative_mode:
        growth_rate = 0.065
    else: # estimated or conservative_mode
        growth_rate = 0.05

    peak_km = calculate_peak_volume(start_km, target_km)

    # Cutback frequency
    cutback_every = 3 if conservative_mode or num_weeks <= 8 else 4

    # Determine taper weeks at the end
    taper_weeks = 1
    if target_km >= 42.2 and num_weeks >= 10:
        taper_weeks = 3
    elif target_km >= 21.1 and num_weeks >= 8:
        taper_weeks = 2

    build_weeks = max(1, num_weeks - taper_weeks)

    curve: List[float] = []
    current_base = start_km
    last_non_cutback = start_km

    for w in range(build_weeks):
        is_cutback = ((w + 1) % cutback_every == 0) and (w != build_weeks - 1)

        if w == 0:
            current_vol = start_km
        elif is_cutback:
            current_vol = last_non_cutback * 0.78 # 22% reduction
        else:
            current_vol = min(last_non_cutback * (1.0 + growth_rate), peak_km)

        if not is_cutback:
            last_non_cutback = current_vol

        curve.append(round(current_vol, 1))

    actual_peak = max(curve, default=start_km)

    # Append taper weeks
    if taper_weeks == 1:
        factor = 0.70 if target_km <= 10.0 else 0.65
        curve.append(round(actual_peak * factor, 1))
    elif taper_weeks == 2:
        curve.append(round(actual_peak * 0.80, 1))
        curve.append(round(actual_peak * 0.58, 1))
    elif taper_weeks >= 3:
        curve.append(round(actual_peak * 0.85, 1))
        curve.append(round(actual_peak * 0.68, 1))
        curve.append(round(actual_peak * 0.50, 1))

    curve = curve[:num_weeks]
    while len(curve) < num_weeks:
        curve.append(round(actual_peak * 0.70, 1))

    return curve


def get_phase_splits_for_distance(target_km: float, num_weeks: int) -> List[Tuple[int, str, str, str, int, int]]:
    """Returns distance-tailored phase splits (pos, name, objective, color, start_w, end_w)."""
    if target_km <= 5.0:
        p1_w = max(1, int(num_weeks * 0.28))
        p2_w = max(1, int(num_weeks * 0.45))
        p3_w = max(1, num_weeks - p1_w - p2_w - 1)
        return [
            (1, "Base Aeróbica & Adaptación", "Construcción de resistencia general y hábitos", "emerald", 1, p1_w),
            (2, "Potencia Aeróbica (VO2máx)", "Intervalos cortos y repeticiones de velocidad", "amber", p1_w + 1, p1_w + p2_w),
            (3, "Pico & Velocidad Específica", "Simulaciones a ritmo objetivo de 5K", "indigo", p1_w + p2_w + 1, num_weeks - 1),
            (4, "Afilamiento & Carrera", "Descarga de volumen para máxima chispa", "rose", num_weeks, num_weeks),
        ]
    elif target_km <= 10.0:
        p1_w = max(1, int(num_weeks * 0.30))
        p2_w = max(1, int(num_weeks * 0.40))
        p3_w = max(1, num_weeks - p1_w - p2_w - 1)
        return [
            (1, "Base Aeróbica", "Desarrollo de capacidad aeróbica de base", "emerald", 1, p1_w),
            (2, "Umbral & VO2máx", "Combinación de rodajes tempo y repeticiones", "amber", p1_w + 1, p1_w + p2_w),
            (3, "Pico Específico 10K", "Bloques a ritmo objetivo de 10K", "indigo", p1_w + p2_w + 1, num_weeks - 1),
            (4, "Afilamiento & Competición", "Reducción de volumen y máxima frescura", "rose", num_weeks, num_weeks),
        ]
    elif target_km <= 21.1:
        p1_w = max(1, int(num_weeks * 0.35))
        p2_w = max(1, int(num_weeks * 0.35))
        taper_len = 2 if num_weeks >= 8 else 1
        p3_w = max(1, num_weeks - p1_w - p2_w - taper_len)
        p4_start = num_weeks - taper_len + 1
        return [
            (1, "Base Aeróbica & Volumen", "Acumulación de kilometraje y resistencia fundamental", "emerald", 1, p1_w),
            (2, "Desarrollo de Umbral", "Trabajo de tempo prolongado y resistencia al esfuerzo", "amber", p1_w + 1, p1_w + p2_w),
            (3, "Pico Específico 21K", "Tiradas largas con bloques a ritmo objetivo de 21K", "indigo", p1_w + p2_w + 1, p4_start - 1),
            (4, "Afilamiento & Carrera", "Puesta a punto final y descarga progresiva", "rose", p4_start, num_weeks),
        ]
    else: # Marathon 42.2K
        p1_w = max(1, int(num_weeks * 0.38))
        p2_w = max(1, int(num_weeks * 0.35))
        taper_len = 3 if num_weeks >= 12 else 2
        p3_w = max(1, num_weeks - p1_w - p2_w - taper_len)
        p4_start = num_weeks - taper_len + 1
        return [
            (1, "Capacidad Aeróbica de Base", "Construcción de volumen seguro y resistencia aeróbica pura", "emerald", 1, p1_w),
            (2, "Construcción Específica Maratón", "Rodajes largos con bloques a ritmo de maratón", "amber", p1_w + 1, p1_w + p2_w),
            (3, "Pico Específico & Máxima Tirada", "Tirada larga máxima (30-32 km) y simulaciones", "indigo", p1_w + p2_w + 1, p4_start - 1),
            (4, "Afilamiento Maratón", "Afilamiento de 2-3 semanas para asimilar cargas", "rose", p4_start, num_weeks),
        ]


def generate_plan_draft_v2(config: PlanGeneratorConfig) -> PlanDraftResponse:
    """Engine V2/V3 plan generator with distance-tailored periodization, weekly templates and tune-up races."""

    baseline = config.baseline
    vdot = baseline.vdot.value if baseline.vdot and baseline.vdot.value > 0 else 35.0
    paces = get_training_paces_seconds(vdot)

    confidence: Confidence = config.confidence or baseline.weekly_km.confidence or "measured"

    # Initial weekly volume
    start_km = baseline.weekly_km.value if baseline.weekly_km and baseline.weekly_km.value > 0 else 20.0
    if confidence == "estimated":
        start_km *= 0.90
    elif confidence == "declared":
        start_km *= 0.95

    if config.conservative_mode:
        start_km *= 0.90

    vol_curve = generate_volume_curve(
        start_km=start_km,
        target_km=config.target_km,
        num_weeks=config.num_weeks,
        confidence=confidence,
        conservative_mode=config.conservative_mode,
    )

    # ISO weekdays: 1=Mon .. 7=Sun
    selected_days = sorted(list(set(config.selected_days))) if config.selected_days else [2, 4, 6, 7]
    long_run_day = config.long_run_day if config.long_run_day in selected_days else selected_days[-1]
    other_days = [d for d in selected_days if d != long_run_day]

    # Quality days placement avoiding Sunday-Monday consecutive hard days
    valid_q_candidates = [d for d in other_days if not (d == 1 and long_run_day == 7)]
    if not valid_q_candidates:
        valid_q_candidates = other_days

    quality_days: List[int] = []
    easy_days: List[int] = []

    if len(other_days) <= 3:
        quality_days = [valid_q_candidates[0]]
        easy_days = [d for d in other_days if d not in quality_days]
    else: # 5+ days total
        q1 = valid_q_candidates[0]
        rem_candidates = [d for d in valid_q_candidates if abs(d - q1) > 1 and abs(d - q1) < 6]
        q2 = rem_candidates[0] if rem_candidates else valid_q_candidates[-1]
        quality_days = [q1, q2]
        easy_days = [d for d in other_days if d not in quality_days]

    # Dates
    start_date = config.start_date
    delta = (start_date.isoweekday() - config.week_start_day + 7) % 7
    first_week_start = _add_days(start_date, -delta)
    end_date = _add_days(first_week_start, config.num_weeks * 7 - 1)

    # Distance-specific phase splits
    phase_splits = get_phase_splits_for_distance(config.target_km, config.num_weeks)
    phases: List[PhaseIn] = []

    num_weeks = config.num_weeks

    # Determine Tune-up race week
    tuneup_week = None
    tuneup_distance = 0.0
    if config.target_km >= 42.2 and num_weeks >= 12:
        tuneup_week = num_weeks - 6
        tuneup_distance = 21.1
    elif config.target_km >= 21.1 and num_weeks >= 8:
        tuneup_week = num_weeks - 4
        tuneup_distance = 10.0

    # Distance caps for long run
    long_run_caps = {5.0: 12.0, 10.0: 16.0, 21.1: 22.0, 42.2: 32.0}
    target_cap = 32.0
    for d_t, cap in sorted(long_run_caps.items()):
        if config.target_km <= d_t:
            target_cap = cap
            break

    for pos, phase_name, phase_obj, color, start_w, end_w in phase_splits:
        weeks_in_phase: List[WeekIn] = []

        for w_idx in range(start_w - 1, end_w):
            week_num = w_idx + 1
            week_vol = vol_curve[w_idx]
            week_start = _add_days(first_week_start, w_idx * 7)
            week_end = _add_days(week_start, 6)

            is_last_week = (week_num == num_weeks)
            is_tuneup_week = (week_num == tuneup_week)
            is_cutback_week = (
                week_num < num_weeks
                and w_idx >= 1
                and vol_curve[w_idx] < vol_curve[w_idx - 1] * 0.85
            )

            def get_workout_date(iso_weekday: int) -> date:
                offset = (iso_weekday - config.week_start_day + 7) % 7
                return _add_days(week_start, offset)

            workouts: List[WorkoutIn] = []

            # 1. Long Run volume calculation (25-35% of weekly volume, subject to ceiling)
            if is_last_week:
                long_run_km = round(min(week_vol * 0.30, config.target_km * 0.6), 1)
            else:
                long_run_km = round(min(week_vol * 0.33, target_cap), 1)

            rem_vol = max(0.0, week_vol - long_run_km)

            # 2. Quality Workouts
            assigned_q_vols = []
            if not is_last_week and rem_vol > 5.0:
                for q_idx, q_day in enumerate(quality_days):
                    q_date = get_workout_date(q_day)
                    q_vol = round(min(rem_vol * (0.45 if len(quality_days) == 1 else 0.30), 12.0), 1)
                    assigned_q_vols.append(q_vol)
                    rem_vol -= q_vol

                    if q_idx == 0:
                        w_type = "tempo"
                        w_name = "Rodaje Tempo / Umbral"
                        w_obj = "Mantener un ritmo firme en zona de umbral lactato"
                        pace_sec = paces["threshold"]
                        intensity = "moderate"
                    else:
                        w_type = "intervals"
                        w_name = "Intervalos de Calidad"
                        w_obj = "Repeticiones para expandir la potencia aeróbica"
                        pace_sec = paces["interval"]
                        intensity = "hard"

                    blocks = build_daniels_blocks_with_ranges(
                        workout_type=w_type,
                        total_km=q_vol,
                        vdot=vdot,
                        paces=paces,
                        progression_level=pos,
                    )

                    workouts.append(
                        WorkoutIn(
                            date=q_date,
                            type=w_type, # type: ignore[arg-type]
                            name=w_name,
                            objective=w_obj,
                            distance_km=q_vol,
                            pace_seconds_per_km=pace_sec,
                            intensity=intensity, # type: ignore[arg-type]
                            description=f"Sesión de {w_type.upper()} de {q_vol} km totales.",
                            blocks=blocks,
                        )
                    )

            # 3. Easy Runs (Remanente del volumen dividido entre días disponibles con rangos)
            if easy_days:
                num_easy = len(easy_days)
                easy_vol_per_day = round(rem_vol / num_easy, 1) if num_easy > 0 else 0.0

                for e_idx, day_iso in enumerate(easy_days):
                    e_date = get_workout_date(day_iso)
                    e_vol = max(3.5, easy_vol_per_day)

                    e_blocks = build_daniels_blocks_with_ranges(
                        workout_type="easy_run",
                        total_km=e_vol,
                        vdot=vdot,
                        paces=paces,
                    )

                    # In Phase 1 or 2, add strides/progresiones to the first easy run of the week
                    if (pos in [1, 2]) and e_idx == 0 and e_vol >= 5.0:
                        e_blocks.append(
                            WorkoutBlockIn(
                                position=2,
                                block_type="strides",
                                repeats=4,
                                distance_m=100,
                                pace_seconds_per_km=paces["repetition"],
                                recovery_seconds=45,
                                recovery_type="walk",
                                notes="4x100m progresiones acelerando suave (técnica y cadencia)",
                            )
                        )

                    workouts.append(
                        WorkoutIn(
                            date=e_date,
                            type="easy_run",
                            name="Rodaje Suave" + (" + Strides" if (pos in [1, 2] and e_idx == 0 and e_vol >= 5.0) else ""),
                            objective="Acumular volumen aeróbico en Zona 2 sin fatiga residual",
                            distance_km=e_vol,
                            pace_seconds_per_km=paces["easy_min"],
                            intensity="easy",
                            description=f"Rodaje regenerativo de {e_vol} km a ritmo cómodo.",
                            blocks=e_blocks,
                        )
                    )

            # 4. Long Run / Tune-up Race / Target Race
            lr_date = get_workout_date(long_run_day)

            if is_last_week:
                lr_type = "race"
                lr_name = f"Carrera Objetivo {config.target_km}K"
                lr_obj = "¡Día del evento objetivo! Poné a prueba toda tu preparación."
                lr_km = config.target_km
                lr_pace = config.target_time_seconds / config.target_km if config.target_time_seconds else (paces["marathon"] if config.target_km >= 21.1 else paces["threshold"])
                lr_intensity = "hard"
                lr_blocks = [
                    WorkoutBlockIn(
                        position=1,
                        block_type="main",
                        repeats=1,
                        distance_m=int(config.target_km * 1000),
                        pace_seconds_per_km=lr_pace,
                    )
                ]
            elif is_tuneup_week:
                tuneup_label = f"{int(tuneup_distance)}K" if tuneup_distance == int(tuneup_distance) else f"{tuneup_distance}K"
                lr_type = "test"
                lr_name = f"Carrera de Control {tuneup_label} (Tune-up)"
                lr_obj = f"Test de control {tuneup_label} a ritmo de competición para validar estado de forma y VDOT."
                lr_km = tuneup_distance
                lr_pace = paces["threshold"]
                lr_intensity = "hard"
                lr_blocks = [
                    WorkoutBlockIn(
                        position=1,
                        block_type="warmup",
                        repeats=1,
                        distance_m=2000,
                        pace_seconds_per_km=paces["easy_max"],
                        notes="Entrada en calor pre-test",
                    ),
                    WorkoutBlockIn(
                        position=2,
                        block_type="main",
                        repeats=1,
                        distance_m=int(tuneup_distance * 1000),
                        pace_seconds_per_km=lr_pace,
                        notes=f"Test firme de {tuneup_distance}K",
                    ),
                    WorkoutBlockIn(
                        position=3,
                        block_type="cooldown",
                        repeats=1,
                        distance_m=1500,
                        pace_seconds_per_km=paces["easy_max"],
                        notes="Vuelta a la calma post-test",
                    ),
                ]
            else:
                lr_type = "long_run"
                lr_km = long_run_km
                lr_pace = paces["easy_min"]
                lr_intensity = "moderate"

                if pos == 3 and config.target_km >= 21.1 and lr_km >= 16.0:
                    lr_name = "Tirada Larga con Bloques a Ritmo Objetivo"
                    lr_obj = "Construcción de eficiencia neuromuscular a ritmo de carrera"
                    mp_pace = paces["marathon"] if config.target_km >= 42.2 else paces["threshold"]
                    mp_dist_m = int(min(lr_km * 0.4, 10.0) * 1000)
                    warmup_lr_m = 4000
                    cooldown_lr_m = max(2000, int((lr_km * 1000) - warmup_lr_m - mp_dist_m))

                    lr_blocks = [
                        WorkoutBlockIn(
                            position=1,
                            block_type="warmup",
                            repeats=1,
                            distance_m=warmup_lr_m,
                            pace_seconds_per_km=paces["easy_min"],
                            notes="Trote inicial progresivo",
                        ),
                        WorkoutBlockIn(
                            position=2,
                            block_type="main",
                            repeats=1,
                            distance_m=mp_dist_m,
                            pace_seconds_per_km=mp_pace,
                            notes=f"Bloque continuo de {mp_dist_m // 1000} km a ritmo de carrera",
                        ),
                        WorkoutBlockIn(
                            position=3,
                            block_type="cooldown",
                            repeats=1,
                            distance_m=cooldown_lr_m,
                            pace_seconds_per_km=paces["easy_max"],
                            notes="Finalización suave",
                        ),
                    ]
                else:
                    lr_name = "Tirada Larga Progresiva" if week_num % 2 == 0 else "Tirada Larga Aeróbica"
                    lr_obj = "Desarrollar la eficiencia metabólica y resistencia aeróbica"
                    lr_blocks = [
                        WorkoutBlockIn(
                            position=1,
                            block_type="main",
                            repeats=1,
                            distance_m=int(lr_km * 1000),
                            pace_seconds_per_km=lr_pace,
                        )
                    ]

            workouts.append(
                WorkoutIn(
                    date=lr_date,
                    type=lr_type, # type: ignore[arg-type]
                    name=lr_name,
                    objective=lr_obj,
                    distance_km=lr_km,
                    pace_seconds_per_km=lr_pace,
                    intensity=lr_intensity, # type: ignore[arg-type]
                    description=f"{lr_name} de {lr_km} km.",
                    blocks=lr_blocks,
                )
            )

            workouts.sort(key=lambda x: x.date)

            weeks_in_phase.append(
                WeekIn(
                    number=week_num,
                    start_date=week_start,
                    end_date=week_end,
                    name=f"Semana {week_num}" + (" (Descarga)" if is_cutback_week else (" (Carrera de Control)" if is_tuneup_week else "")),
                    objective=f"Volumen objetivo: {vol_curve[w_idx]} km",
                    workouts=workouts,
                )
            )

        phases.append(
            PhaseIn(
                position=pos,
                name=phase_name,
                color=color,
                start_week=start_w,
                end_week=end_w,
                objective=phase_obj,
                description=f"Fase {pos}: {phase_name}",
                weeks=weeks_in_phase,
            )
        )

    draft_plan = RunningPlanCreate(
        name=f"Plan {config.target_km}K ({config.num_weeks} Semanas)",
        goal=f"Preparación estructurada para {config.target_km}K",
        distance_km=config.target_km,
        distance_unit="km",
        target_time_seconds=config.target_time_seconds,
        target_pace_seconds_per_km=config.target_time_seconds / config.target_km if config.target_time_seconds else None,
        start_date=start_date,
        end_date=end_date,
        week_start_day=config.week_start_day,
        status="planned",
        race_id=config.race_id,
        engine_version="v3",
        baseline=config.baseline.model_dump(),
        generation_params={
            "goal_type": config.goal_type,
            "confidence": confidence,
            "conservative_mode": config.conservative_mode,
            "target_km": config.target_km,
            "num_weeks": config.num_weeks,
        },
        phases=phases,
    )

    validation_issues = validate_plan_invariants(draft_plan, config)

    meta_info = {
        "engine_version": "v3",
        "confidence_summary": {
            "applied_confidence": confidence,
            "start_weekly_km": round(start_km, 1),
            "peak_weekly_km": max(vol_curve, default=start_km),
            "tuneup_race": f"{tuneup_distance}K en Semana {tuneup_week}" if tuneup_week else "Ninguna",
            "conservative_mode": config.conservative_mode,
        },
    }

    return PlanDraftResponse(
        draft=draft_plan,
        warnings=validation_issues,
        meta=meta_info,
    )


def generate_plan_draft(config: PlanGeneratorConfig) -> RunningPlanCreate:
    """Wrapper function returning the plan draft directly for backward compatibility."""
    res = generate_plan_draft_v2(config)
    return res.draft
