import math
import datetime as dt
from datetime import timedelta
from typing import List, Dict, Any, Optional
from app.models import RunningPlanCreate, PhaseIn, WeekIn, WorkoutIn, WorkoutBlockIn
from app.services.running_math import (
    calculate_vdot,
    get_training_paces,
    predict_time_riegel,
    parse_pace,
    format_pace,
    format_time,
)

def js_round(x: float) -> int:
    return math.floor(x + 0.5)

def iso_weekday_to_get_day(wsd: int) -> int:
    return 0 if wsd == 7 else wsd

def get_day_to_iso_weekday(gd: int) -> int:
    return 7 if gd == 0 else gd

def add_days_to_iso(date_str: str, days: int) -> str:
    date_obj = dt.datetime.strptime(date_str, "%Y-%m-%d").date()
    return (date_obj + timedelta(days=days)).isoformat()

def format_distance(km: float) -> str:
    # JS: Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(km) + " km"
    formatted = f"{km:.1f}".replace(".", ",") if km % 1 != 0 else str(int(km))
    return f"{formatted} km"

def generate_plan_structure(
    draft: Dict[str, Any],
    plan_type: str,
    target_km: float,
    num_weeks: int,
    user_level: str,
    ref_distance_km: float,
    ref_time_seconds: float,
    current_weekly_km: float,
    longest_run_km: float,
    selected_days: List[int],
    long_run_day: int
) -> RunningPlanCreate:
    start_date_iso = draft.get("start_date") or dt.datetime.now().date().isoformat()
    
    wsd = draft.get("week_start_day") or 1
    wsd_get_day = iso_weekday_to_get_day(wsd)
    start_get_day = dt.datetime.strptime(start_date_iso, "%Y-%m-%d").date().isoweekday()
    if start_get_day == 7:
        start_get_day = 0

    start_iso = get_day_to_iso_weekday(start_get_day)
    delta = (start_iso - wsd + 7) % 7
    first_week_start = add_days_to_iso(start_date_iso, -delta)
    calculated_end_date = add_days_to_iso(first_week_start, num_weeks * 7 - 1)

    vdot = calculate_vdot(ref_distance_km * 1000.0, ref_time_seconds)
    paces = get_training_paces(vdot)

    easy_pace_sec = parse_pace(paces["easyMin"]) or 330.0
    tempo_pace_sec = parse_pace(paces["threshold"]) or 270.0
    interval_pace_sec = parse_pace(paces["interval"]) or 240.0
    long_run_pace_sec = parse_pace(paces["easyMax"]) or 345.0

    predicted_finish_sec = predict_time_riegel(ref_distance_km * 1000.0, ref_time_seconds, target_km * 1000.0)
    predicted_pace_sec = float(js_round(predicted_finish_sec / target_km)) if target_km > 0 else 0.0

    p1_end = max(1, js_round(num_weeks * 0.3))
    p2_end = max(p1_end + 1, js_round(num_weeks * 0.65))
    p3_end = max(p2_end + 1, js_round(num_weeks * 0.85))
    p4_end = num_weeks

    phases_spec = [
        {
            "name": "Fase Base Aeróbica",
            "color": "emerald",
            "start": 1,
            "end": p1_end,
            "objective": f"Rodajes suaves a ritmo {paces['easyMin']}-{paces['easyMax']} min/km y adaptación neuromuscular"
        },
        {
            "name": "Fase Construcción & Tempo",
            "color": "amber",
            "start": p1_end + 1,
            "end": p2_end,
            "objective": f"Series a ritmo umbral ({paces['threshold']} min/km) e incremento controlado de carga"
        },
        {
            "name": "Fase Pico & Intervalos VO2",
            "color": "violet",
            "start": p2_end + 1,
            "end": p3_end,
            "objective": f"Intervalos de velocidad ({paces['interval']} min/km) y fondos largos máximos"
        },
        {
            "name": "Fase Tapering & Carrera",
            "color": "sky",
            "start": p3_end + 1,
            "end": p4_end,
            "objective": "Descarga de volumen (-40%), afinamiento de ritmo y día del objetivo"
        }
    ]
    phases_spec = [p for p in phases_spec if p["start"] <= p["end"]]

    def sort_key(day):
        order = 99 if day == long_run_day else (day - wsd_get_day + 7) % 7
        return order

    sorted_days = sorted(selected_days, key=sort_key)
    quality_indices = [1] if len(sorted_days) > 1 else []
    if len(sorted_days) > 3:
        quality_indices.append(2)
    last_quality_idx = max(quality_indices) if quality_indices else -1

    generated_phases = []

    for phase_idx, spec in enumerate(phases_spec):
        weeks_in_phase = []

        for w_num in range(spec["start"], spec["end"] + 1):
            week_start = add_days_to_iso(first_week_start, (w_num - 1) * 7)
            week_end = add_days_to_iso(week_start, 6)

            progress_ratio = w_num / num_weeks if num_weeks > 0 else 0
            base_long_km = max(longest_run_km, 6.0)
            target_long_km = min(target_km * 0.85, 32.0)
            week_long_km = js_round(base_long_km + progress_ratio * (target_long_km - base_long_km))

            if phase_idx == 3 and w_num < num_weeks:
                week_long_km = float(js_round(week_long_km * 0.6))
            elif w_num == num_weeks:
                week_long_km = float(target_km)

            workouts = []

            for day_idx, day_id in enumerate(sorted_days):
                offset = (day_id - wsd_get_day + 7) % 7
                workout_date = add_days_to_iso(week_start, offset)

                if workout_date < start_date_iso:
                    continue

                is_long_run_day = (day_id == long_run_day) or (day_idx == len(sorted_days) - 1 and long_run_day not in sorted_days)
                is_quality_day = day_idx in quality_indices
                is_recovery_day = (phase_idx >= 1) and (day_idx == last_quality_idx + 1) and not is_long_run_day

                w_type = "easy_run"
                name = "Rodaje Suave Aeróbico"
                dist_km = float(max(5, js_round(current_weekly_km / len(sorted_days)) if len(sorted_days) > 0 else 5))
                target_pace = easy_pace_sec
                intensity = "easy"
                blocks = []

                if is_long_run_day:
                    w_type = "race" if w_num == num_weeks else "long_run"
                    name = f"Día de Carrera Objetivo ({format_distance(target_km)})" if w_num == num_weeks else f"Tirada Larga de Fondo ({format_distance(week_long_km)})"
                    dist_km = float(week_long_km)
                    target_pace = predicted_pace_sec if w_num == num_weeks else long_run_pace_sec
                    intensity = "hard" if w_num == num_weeks else "moderate"

                    main_km = max(2.0, dist_km - 3.0)
                    blocks = [
                        {
                            "position": 1,
                            "block_type": "warmup",
                            "repeats": 1,
                            "distance_m": 2000.0,
                            "duration_seconds": None,
                            "pace_seconds_per_km": easy_pace_sec + 15,
                            "pace_range_end_seconds_per_km": None,
                            "recovery_seconds": None,
                            "recovery_type": "jog",
                            "notes": "Entrada en calor suave",
                        },
                        {
                            "position": 2,
                            "block_type": "main",
                            "repeats": 1,
                            "distance_m": main_km * 1000.0,
                            "duration_seconds": None,
                            "pace_seconds_per_km": long_run_pace_sec,
                            "pace_range_end_seconds_per_km": None,
                            "recovery_seconds": None,
                            "recovery_type": "jog",
                            "notes": "Ritmo cómodo conversacional",
                        },
                        {
                            "position": 3,
                            "block_type": "cooldown",
                            "repeats": 1,
                            "distance_m": 1000.0,
                            "duration_seconds": None,
                            "pace_seconds_per_km": easy_pace_sec + 20,
                            "pace_range_end_seconds_per_km": None,
                            "recovery_seconds": None,
                            "recovery_type": "jog",
                            "notes": "Afloje final",
                        },
                    ]
                elif is_quality_day and phase_idx >= 1:
                    if phase_idx == 1:
                        w_type = "tempo"
                        name = "Sesión Tempo (Umbral Láctico)"
                        dist_km = float(8 + js_round(w_num * 0.4))
                        target_pace = tempo_pace_sec
                        intensity = "hard"

                        tempo_km = max(3.0, dist_km - 3.0)
                        blocks = [
                            {
                                "position": 1,
                                "block_type": "warmup",
                                "repeats": 1,
                                "distance_m": 1500.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": easy_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": None,
                                "recovery_type": "jog",
                                "notes": "Calentamiento",
                            },
                            {
                                "position": 2,
                                "block_type": "main",
                                "repeats": 1,
                                "distance_m": tempo_km * 1000.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": tempo_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": None,
                                "recovery_type": "jog",
                                "notes": f"Bloque Tempo sostenido @ {paces['threshold']}/km",
                            },
                            {
                                "position": 3,
                                "block_type": "cooldown",
                                "repeats": 1,
                                "distance_m": 1500.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": easy_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": None,
                                "recovery_type": "jog",
                                "notes": "Enfriamiento",
                            },
                        ]
                    elif phase_idx == 2:
                        w_type = "intervals"
                        name = "Intervalos de Velocidad (VO2 Max)"
                        dist_km = 9.0
                        target_pace = interval_pace_sec
                        intensity = "hard"

                        reps = min(8, 4 + math.floor(w_num * 0.4))
                        blocks = [
                            {
                                "position": 1,
                                "block_type": "warmup",
                                "repeats": 1,
                                "distance_m": 1500.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": easy_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": None,
                                "recovery_type": "jog",
                                "notes": "Calentamiento + progresiones",
                            },
                            {
                                "position": 2,
                                "block_type": "interval",
                                "repeats": reps,
                                "distance_m": 800.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": interval_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": 90,
                                "recovery_type": "jog",
                                "notes": f"{reps}x800m @ {paces['interval']}/km con 90s trote",
                            },
                            {
                                "position": 3,
                                "block_type": "cooldown",
                                "repeats": 1,
                                "distance_m": 1500.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": easy_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": None,
                                "recovery_type": "jog",
                                "notes": "Enfriamiento libre",
                            },
                        ]
                    else:
                        w_type = "activation"
                        name = "Activación y Progresiones"
                        dist_km = 5.0
                        target_pace = easy_pace_sec
                        intensity = "easy"
                        blocks = [
                            {
                                "position": 1,
                                "block_type": "warmup",
                                "repeats": 1,
                                "distance_m": 3000.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": easy_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": None,
                                "recovery_type": "jog",
                                "notes": "Rodaje suave",
                            },
                            {
                                "position": 2,
                                "block_type": "strides",
                                "repeats": 4,
                                "distance_m": 100.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": interval_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": 45,
                                "recovery_type": "walk",
                                "notes": "Progresiones sueltas",
                            },
                            {
                                "position": 3,
                                "block_type": "cooldown",
                                "repeats": 1,
                                "distance_m": 1000.0,
                                "duration_seconds": None,
                                "pace_seconds_per_km": easy_pace_sec,
                                "pace_range_end_seconds_per_km": None,
                                "recovery_seconds": None,
                                "recovery_type": "jog",
                                "notes": "Afloje final",
                            },
                        ]
                else:
                    is_regeneration = is_recovery_day
                    w_type = "regeneration" if is_regeneration else "easy_run"

                    base_easy = 6.0 + w_num * 0.2
                    variation = ((day_idx % 3) - 1) * 1.5
                    
                    if is_regeneration:
                        dist_km = max(4.0, js_round((5.0 + w_num * 0.1) * 10) / 10.0)
                    else:
                        dist_km = max(5.0, js_round((base_easy + variation) * 10) / 10.0)

                    if is_regeneration:
                        name = "Rodaje Regenerativo"
                    elif dist_km <= 6.0:
                        name = "Rodaje Suave Corto"
                    elif dist_km <= 8.0:
                        name = "Rodaje Suave Medio"
                    else:
                        name = "Rodaje Suave Largo"

                    target_pace = easy_pace_sec + 20.0 if is_regeneration else easy_pace_sec
                    intensity = "easy"

                    base_blocks = [
                        {
                            "position": 1,
                            "block_type": "warmup",
                            "repeats": 1,
                            "distance_m": 1000.0,
                            "duration_seconds": None,
                            "pace_seconds_per_km": easy_pace_sec + 10.0,
                            "pace_range_end_seconds_per_km": None,
                            "recovery_seconds": None,
                            "recovery_type": "jog",
                            "notes": "Trote inicial",
                        },
                        {
                            "position": 2,
                            "block_type": "main",
                            "repeats": 1,
                            "distance_m": max(2000.0, (dist_km - 2.0) * 1000.0),
                            "duration_seconds": None,
                            "pace_seconds_per_km": target_pace,
                            "pace_range_end_seconds_per_km": None,
                            "recovery_seconds": None,
                            "recovery_type": "jog",
                            "notes": "Ritmo muy suave, recuperación activa" if is_regeneration else "Ritmo Z2 aeróbico conversacional",
                        },
                    ]

                    if not is_regeneration and day_idx == 0 and len(sorted_days) >= 3:
                        base_blocks.append({
                            "position": 3,
                            "block_type": "strides",
                            "repeats": 4,
                            "distance_m": 100.0,
                            "duration_seconds": None,
                            "pace_seconds_per_km": interval_pace_sec,
                            "pace_range_end_seconds_per_km": None,
                            "recovery_seconds": 45,
                            "recovery_type": "walk",
                            "notes": "4x100m progresiones sueltas",
                        })

                    base_blocks.append({
                        "position": len(base_blocks) + 1,
                        "block_type": "cooldown",
                        "repeats": 1,
                        "distance_m": 1000.0,
                        "duration_seconds": None,
                        "pace_seconds_per_km": easy_pace_sec + 10.0,
                        "pace_range_end_seconds_per_km": None,
                        "recovery_seconds": None,
                        "recovery_type": "jog",
                        "notes": "Soltura",
                    })

                    blocks = base_blocks

                workouts.append(WorkoutIn(
                    date=dt.datetime.strptime(workout_date, "%Y-%m-%d").date(),
                    type=w_type,
                    name=name,
                    objective=f"{name} ({format_distance(dist_km)} @ {format_pace(target_pace)}/km)",
                    distance_km=dist_km,
                    duration_seconds=None,
                    pace_seconds_per_km=target_pace,
                    intensity=intensity,
                    description="",
                    notes="",
                    cancelled=False,
                    status_override=None,
                    blocks=[WorkoutBlockIn(**b) for b in blocks]
                ))

            total_dist = sum(w.distance_km for w in workouts if w.distance_km)
            weeks_in_phase.append(WeekIn(
                number=w_num,
                start_date=dt.datetime.strptime(week_start, "%Y-%m-%d").date(),
                end_date=dt.datetime.strptime(week_end, "%Y-%m-%d").date(),
                name="",
                objective=f"Volumen semana: ~{format_distance(js_round(total_dist * 10) / 10.0)}",
                notes="",
                workouts=workouts
            ))

        generated_phases.append(PhaseIn(
            position=phase_idx + 1,
            name=spec["name"],
            color=spec["color"],
            start_week=spec["start"],
            end_week=spec["end"],
            objective=spec["objective"],
            description="",
            weeks=weeks_in_phase
        ))

    plan_name = draft.get("name", "").strip() or f"Plan {target_km}K ({num_weeks} sem)"
    goal_str = draft.get("goal") or f"Completar {format_distance(target_km)} en {format_time(predicted_finish_sec)} ({format_pace(predicted_pace_sec)}/km)"

    return RunningPlanCreate(
        name=plan_name,
        goal=goal_str,
        distance_km=target_km,
        distance_unit="km",
        target_time_seconds=int(predicted_finish_sec),
        target_pace_seconds_per_km=predicted_pace_sec,
        start_date=dt.datetime.strptime(start_date_iso, "%Y-%m-%d").date(),
        end_date=dt.datetime.strptime(calculated_end_date, "%Y-%m-%d").date(),
        week_start_day=wsd,
        status="planned",
        race_id=draft.get("race_id"),
        notes=draft.get("notes", ""),
        phases=generated_phases
    )
