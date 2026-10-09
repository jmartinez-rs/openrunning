from typing import Dict, List, Optional
from app.models import WorkoutBlockIn, WorkoutIn
from app.services.running_math import format_pace, get_training_paces_seconds


class WorkoutTemplate:
    def __init__(
        self,
        key: str,
        workout_type: str,
        name: str,
        objective: str,
        intensity: str,
        min_progression_level: int = 1,
    ):
        self.key = key
        self.workout_type = workout_type
        self.name = name
        self.objective = objective
        self.intensity = intensity
        self.min_progression_level = min_progression_level


# Catalog of Daniels-based structured workouts
WORKOUT_CATALOG: Dict[str, List[WorkoutTemplate]] = {
    "strides": [
        WorkoutTemplate(
            key="easy_strides",
            workout_type="easy_run",
            name="Rodaje Suave + Progresiones (Strides)",
            objective="Rodaje aeróbico finalizado con progresiones de 100m para reactivación neuromuscular.",
            intensity="easy",
            min_progression_level=1,
        ),
        WorkoutTemplate(
            key="hills_activation",
            workout_type="easy_run",
            name="Rodaje Suave + Cuestas Cortas",
            objective="Rodaje base con cuestas cortas (8-10s) para fortalecimiento de tobillos y potencia sin lactato.",
            intensity="moderate",
            min_progression_level=1,
        ),
    ],
    "tempo": [
        WorkoutTemplate(
            key="tempo_continuous",
            workout_type="tempo",
            name="Tempo Continuo de Umbral",
            objective="Sostener ritmo de umbral de lactato (T) continuo para mejorar la remoción de lactato.",
            intensity="moderate",
            min_progression_level=1,
        ),
        WorkoutTemplate(
            key="tempo_cruise_intervals",
            workout_type="tempo",
            name="Cruceros de Umbral (Cruise Intervals)",
            objective="Intervalos largos a ritmo T con pausas muy breves (1 min) para acumular volumen de umbral.",
            intensity="moderate",
            min_progression_level=2,
        ),
    ],
    "intervals": [
        WorkoutTemplate(
            key="vo2max_1k_reps",
            workout_type="intervals",
            name="Intervalos de VO2máx (1000m)",
            objective="Repeticiones de 1000m a ritmo I para maximizar el consumo de oxígeno (VO2máx).",
            intensity="hard",
            min_progression_level=1,
        ),
        WorkoutTemplate(
            key="vo2max_pyramid",
            workout_type="intervals",
            name="Pirámide de Calidad Aeróbica",
            objective="Intervalos variables (400m-800m-1200m-800m-400m) para adaptación al cambio de ritmo.",
            intensity="hard",
            min_progression_level=2,
        ),
        WorkoutTemplate(
            key="repetition_speed",
            workout_type="intervals",
            name="Repeticiones R (400m) & Economía",
            objective="Series cortas a ritmo R (Repetition) con recuperación completa para economía de carrera.",
            intensity="hard",
            min_progression_level=2,
        ),
    ],
}


def build_daniels_blocks_with_ranges(
    workout_type: str,
    total_km: float,
    vdot: float,
    paces: Dict[str, float],
    progression_level: int = 1,
) -> List[WorkoutBlockIn]:
    """Generates structured workout blocks adhering strictly to Daniels rules for T/I/R volume caps and pace ranges."""

    easy_min = paces.get("easy_min", 0.0)
    easy_max = paces.get("easy_max", 0.0)
    threshold = paces.get("threshold", 0.0)
    interval = paces.get("interval", 0.0)
    repetition = paces.get("repetition", 0.0)

    blocks: List[WorkoutBlockIn] = []

    if workout_type == "easy_run":
        # Easy run with pace range (easy_min to easy_max)
        blocks.append(
            WorkoutBlockIn(
                position=1,
                block_type="main",
                repeats=1,
                distance_m=int(total_km * 1000),
                pace_seconds_per_km=easy_min,
                pace_range_end_seconds_per_km=easy_max,
                notes="Rodaje continuo en Zona 2 aeróbica",
            )
        )

    elif workout_type == "tempo":
        # Daniels Tempo rule: Tempo volume <= 10% weekly volume or max 20-30 min
        warmup_m = 2000
        cooldown_m = 1500
        tempo_m = max(2000, int((total_km * 1000) - warmup_m - cooldown_m))

        blocks.append(
            WorkoutBlockIn(
                position=1,
                block_type="warmup",
                repeats=1,
                distance_m=warmup_m,
                pace_seconds_per_km=easy_min,
                pace_range_end_seconds_per_km=easy_max,
                notes="Entrada en calor suave y movilidad",
            )
        )

        if progression_level >= 2 and tempo_m >= 4000:
            # Cruise intervals (e.g., 2x2000m or 3x2000m @ T with 60s jog recovery)
            repeats = max(2, min(4, tempo_m // 2000))
            rep_dist = int(tempo_m // repeats)
            blocks.append(
                WorkoutBlockIn(
                    position=2,
                    block_type="main",
                    repeats=repeats,
                    distance_m=rep_dist,
                    pace_seconds_per_km=round(threshold - 3, 1),
                    pace_range_end_seconds_per_km=round(threshold + 3, 1),
                    recovery_seconds=60,
                    recovery_type="jog",
                    notes=f"{repeats}x{rep_dist}m al ritmo de umbral (T)",
                )
            )
        else:
            # Continuous Tempo
            blocks.append(
                WorkoutBlockIn(
                    position=2,
                    block_type="main",
                    repeats=1,
                    distance_m=tempo_m,
                    pace_seconds_per_km=round(threshold - 4, 1),
                    pace_range_end_seconds_per_km=round(threshold + 4, 1),
                    notes=f"Bloque continuo de {tempo_m // 1000} km a ritmo Tempo (T)",
                )
            )

        blocks.append(
            WorkoutBlockIn(
                position=3,
                block_type="cooldown",
                repeats=1,
                distance_m=cooldown_m,
                pace_seconds_per_km=easy_min,
                pace_range_end_seconds_per_km=easy_max,
                notes="Vuelta a la calma y trote regenerativo",
            )
        )

    elif workout_type in ["intervals", "repetition"]:
        # Daniels Interval rule: I volume <= 8% weekly volume (max 10km); Reps 3-5 min
        warmup_m = 2000
        cooldown_m = 1500
        main_m = max(1200, int((total_km * 1000) - warmup_m - cooldown_m))

        blocks.append(
            WorkoutBlockIn(
                position=1,
                block_type="warmup",
                repeats=1,
                distance_m=warmup_m,
                pace_seconds_per_km=easy_min,
                pace_range_end_seconds_per_km=easy_max,
                notes="Entrada en calor progresiva",
            )
        )

        if workout_type == "repetition" or (progression_level == 1 and total_km <= 7.0):
            # Repetition work (400m - 600m @ R pace)
            rep_dist = 400
            repeats = max(4, min(10, main_m // rep_dist))
            blocks.append(
                WorkoutBlockIn(
                    position=2,
                    block_type="interval",
                    repeats=repeats,
                    distance_m=rep_dist,
                    pace_seconds_per_km=round(repetition - 2, 1),
                    pace_range_end_seconds_per_km=round(repetition + 2, 1),
                    recovery_seconds=90,
                    recovery_type="walk",
                    notes=f"{repeats}x{rep_dist}m a ritmo R con recuperación completa",
                )
            )
        else:
            # VO2max Intervals (800m - 1000m @ I pace)
            rep_dist = 1000 if main_m >= 3000 else 800
            repeats = max(3, min(6, main_m // rep_dist))
            blocks.append(
                WorkoutBlockIn(
                    position=2,
                    block_type="interval",
                    repeats=repeats,
                    distance_m=rep_dist,
                    pace_seconds_per_km=round(interval - 3, 1),
                    pace_range_end_seconds_per_km=round(interval + 3, 1),
                    recovery_seconds=90,
                    recovery_type="jog",
                    notes=f"{repeats}x{rep_dist}m a ritmo de VO2máx (I)",
                )
            )

        blocks.append(
            WorkoutBlockIn(
                position=3,
                block_type="cooldown",
                repeats=1,
                distance_m=cooldown_m,
                pace_seconds_per_km=easy_min,
                pace_range_end_seconds_per_km=easy_max,
                notes="Vuelta a la calma y soltar piernas",
            )
        )

    else:
        # Fallback single block
        blocks.append(
            WorkoutBlockIn(
                position=1,
                block_type="main",
                repeats=1,
                distance_m=int(total_km * 1000),
                pace_seconds_per_km=easy_min,
                pace_range_end_seconds_per_km=easy_max,
            )
        )

    return blocks
