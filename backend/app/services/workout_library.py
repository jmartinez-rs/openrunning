from app.models import WorkoutBlockIn


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
WORKOUT_CATALOG: dict[str, list[WorkoutTemplate]] = {
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


# --- Shared block-pace rules --------------------------------------------------
# Single source of truth for how a pace-table value becomes a workout block.
# `build_daniels_blocks_with_ranges`, the plan generator and the VDOT
# recalibration (`app.services.fitness`) all resolve block paces through
# `resolve_block_paces`, so a recalibration reproduces the generator's paces
# exactly instead of maintaining a second, drifting copy of these offsets.

# Daniels offsets, in seconds per km, subtracted/added around the table pace.
TEMPO_CONTINUOUS_OFFSET_S_PER_KM = 4.0
TEMPO_CRUISE_OFFSET_S_PER_KM = 3.0
INTERVAL_OFFSET_S_PER_KM = 3.0
REPETITION_OFFSET_S_PER_KM = 2.0

# Tempo block geometry.
TEMPO_WARMUP_M = 2000
TEMPO_COOLDOWN_M = 1500
# Cruise intervals need at least this much threshold volume.
TEMPO_CRUISE_MIN_BLOCK_M = 4000

# Interval block geometry.
INTERVAL_WARMUP_M = 2000
INTERVAL_COOLDOWN_M = 1500

# A phase-1 quality session at or below this volume is repetition (R) work.
REPETITION_PHASE_MAX_VOLUME_KM = 7.0

# Stored-geometry fallbacks. Once a plan has been generated, its blocks are the
# source of truth: `RunningWorkout.distance_km` is PATCH-editable without
# restructuring the blocks, so re-deriving the tempo or repetition rule from it
# can disagree with the geometry that actually exists. The library emits
# `repeats > 1` for cruise intervals and <= 600 m reps for R work.
REPETITION_MAIN_BLOCK_MAX_DISTANCE_M = 600

# Long runs with at least this many blocks carry a goal-pace main block.
LONG_RUN_BLOCK_COUNT_FOR_GOAL_PACE = 3
# Goals at or beyond this distance run that block at marathon pace.
MARATHON_TARGET_KM = 42.2

_EASY_BLOCK_TYPES = ("warmup", "cooldown")


def offset_pair(
    paces: dict[str, float], key: str, offset: float
) -> tuple[float | None, float | None]:
    """`pace - offset` / `pace + offset` pair for one pace-table key."""
    base = paces.get(key)
    if base is None:
        return (None, None)
    return (round(base - offset, 1), round(base + offset, 1))


def uses_repetition_paces(
    *, workout_type: str, total_km: float, progression_level: int
) -> bool:
    """Daniels R rule: an explicit repetition session, or a short phase-1 session.

    One rule for both the generator and the recalibration, so short reps never
    drift into VO2max (I) paces (and vice versa).
    """
    return workout_type == "repetition" or (
        progression_level == 1 and total_km <= REPETITION_PHASE_MAX_VOLUME_KM
    )


def tempo_main_is_cruise(*, total_km: float, progression_level: int) -> bool:
    """Daniels tempo rule: cruise intervals from phase 2 with enough T volume."""
    tempo_m = max(
        TEMPO_WARMUP_M, int((total_km * 1000) - TEMPO_WARMUP_M - TEMPO_COOLDOWN_M)
    )
    return progression_level >= 2 and tempo_m >= TEMPO_CRUISE_MIN_BLOCK_M


def tempo_main_is_cruise_from_repeats(repeats: int | None) -> bool:
    """Stored-geometry cruise decision: the library emits `repeats > 1` for cruise."""
    return (repeats or 1) > 1


def interval_distance_is_repetition(distance_m: float | None) -> bool | None:
    """Stored-geometry R decision: the library emits <= 600 m reps for R work.

    Returns `None` when the geometry is unknown, so the caller can fall back to
    the volume/phase rule instead of guessing.
    """
    if distance_m is None:
        return None
    return distance_m <= REPETITION_MAIN_BLOCK_MAX_DISTANCE_M


def resolve_block_paces(
    *,
    workout_type: str,
    block_type: str,
    paces: dict[str, float],
    total_km: float = 0.0,
    target_km: float = 0.0,
    progression_level: int = 1,
    block_count: int = 1,
    uses_repetition: bool | None = None,
    tempo_is_cruise: bool | None = None,
) -> tuple[float | None, float | None]:
    """Pace pair `(pace, range end)` for one generated block.

    Mirrors the generator for every block type it emits. Tune-up (`test`) races
    and goal-pace long runs run their easy segments at a SINGLE pace with no
    range; tempo/interval warmups keep the full easy range. `race` blocks are
    goal-pinned (they come from the target time), so `(None, None)` tells the
    caller to keep the stored pace.

    `uses_repetition` / `tempo_is_cruise` let a caller that holds a plan's STORED
    block geometry pin the R-vs-I and cruise-vs-continuous decisions to that
    geometry instead of re-deriving them from a possibly-edited `total_km`. The
    generator passes neither and keeps the volume/phase rule.
    """
    easy_min = paces.get("easy_min")
    easy_max = paces.get("easy_max")

    if workout_type == "race":
        return (None, None)

    if workout_type == "test":
        if block_type == "main":
            return (paces.get("threshold"), None)
        return (easy_max, None)

    if workout_type == "long_run":
        if block_type == "main":
            if block_count >= LONG_RUN_BLOCK_COUNT_FOR_GOAL_PACE:
                key = "marathon" if target_km >= MARATHON_TARGET_KM else "threshold"
                return (paces.get(key), None)
            return (easy_min, None)
        if block_type == "cooldown":
            return (easy_max, None)
        return (easy_min, None)

    if block_type == "strides":
        return (paces.get("repetition"), None)

    if block_type in _EASY_BLOCK_TYPES:
        return (easy_min, easy_max)

    if block_type == "interval":
        repetition = (
            uses_repetition
            if uses_repetition is not None
            else uses_repetition_paces(
                workout_type=workout_type,
                total_km=total_km,
                progression_level=progression_level,
            )
        )
        if repetition:
            return offset_pair(paces, "repetition", REPETITION_OFFSET_S_PER_KM)
        return offset_pair(paces, "interval", INTERVAL_OFFSET_S_PER_KM)

    if workout_type == "tempo":
        cruise = (
            tempo_is_cruise
            if tempo_is_cruise is not None
            else tempo_main_is_cruise(
                total_km=total_km, progression_level=progression_level
            )
        )
        if cruise:
            return offset_pair(paces, "threshold", TEMPO_CRUISE_OFFSET_S_PER_KM)
        return offset_pair(paces, "threshold", TEMPO_CONTINUOUS_OFFSET_S_PER_KM)

    if workout_type in ("intervals", "repetition"):
        return offset_pair(paces, "interval", INTERVAL_OFFSET_S_PER_KM)

    return (easy_min, easy_max)


def build_daniels_blocks_with_ranges(
    workout_type: str,
    total_km: float,
    vdot: float,
    paces: dict[str, float],
    progression_level: int = 1,
) -> list[WorkoutBlockIn]:
    """Generates structured workout blocks adhering strictly to Daniels rules for T/I/R volume caps and pace ranges."""

    blocks: list[WorkoutBlockIn] = []

    def block(block_type: str, **fields: object) -> WorkoutBlockIn:
        pace, pace_range = resolve_block_paces(
            workout_type=workout_type,
            block_type=block_type,
            paces=paces,
            total_km=total_km,
            progression_level=progression_level,
        )
        return WorkoutBlockIn(
            block_type=block_type,  # type: ignore[arg-type]
            pace_seconds_per_km=pace,
            pace_range_end_seconds_per_km=pace_range,
            **fields,  # type: ignore[arg-type]
        )

    if workout_type == "easy_run":
        # Easy run with pace range (easy_min to easy_max)
        blocks.append(
            block(
                "main",
                position=1,
                repeats=1,
                distance_m=int(total_km * 1000),
                notes="Rodaje continuo en Zona 2 aeróbica",
            )
        )

    elif workout_type == "tempo":
        # Daniels Tempo rule: Tempo volume <= 10% weekly volume or max 20-30 min
        warmup_m = TEMPO_WARMUP_M
        cooldown_m = TEMPO_COOLDOWN_M
        tempo_m = max(
            TEMPO_WARMUP_M, int((total_km * 1000) - warmup_m - cooldown_m)
        )

        blocks.append(
            block(
                "warmup",
                position=1,
                repeats=1,
                distance_m=warmup_m,
                notes="Entrada en calor suave y movilidad",
            )
        )

        if tempo_main_is_cruise(
            total_km=total_km, progression_level=progression_level
        ):
            # Cruise intervals (e.g., 2x2000m or 3x2000m @ T with 60s jog recovery)
            repeats = max(2, min(4, tempo_m // 2000))
            rep_dist = int(tempo_m // repeats)
            blocks.append(
                block(
                    "main",
                    position=2,
                    repeats=repeats,
                    distance_m=rep_dist,
                    recovery_seconds=60,
                    recovery_type="jog",
                    notes=f"{repeats}x{rep_dist}m al ritmo de umbral (T)",
                )
            )
        else:
            # Continuous Tempo
            blocks.append(
                block(
                    "main",
                    position=2,
                    repeats=1,
                    distance_m=tempo_m,
                    notes=f"Bloque continuo de {tempo_m // 1000} km a ritmo Tempo (T)",
                )
            )

        blocks.append(
            block(
                "cooldown",
                position=3,
                repeats=1,
                distance_m=cooldown_m,
                notes="Vuelta a la calma y trote regenerativo",
            )
        )

    elif workout_type in ["intervals", "repetition"]:
        # Daniels Interval rule: I volume <= 8% weekly volume (max 10km); Reps 3-5 min
        warmup_m = INTERVAL_WARMUP_M
        cooldown_m = INTERVAL_COOLDOWN_M
        main_m = max(1200, int((total_km * 1000) - warmup_m - cooldown_m))

        blocks.append(
            block(
                "warmup",
                position=1,
                repeats=1,
                distance_m=warmup_m,
                notes="Entrada en calor progresiva",
            )
        )

        if uses_repetition_paces(
            workout_type=workout_type,
            total_km=total_km,
            progression_level=progression_level,
        ):
            # Repetition work (400m - 600m @ R pace)
            rep_dist = 400
            repeats = max(4, min(10, main_m // rep_dist))
            blocks.append(
                block(
                    "interval",
                    position=2,
                    repeats=repeats,
                    distance_m=rep_dist,
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
                block(
                    "interval",
                    position=2,
                    repeats=repeats,
                    distance_m=rep_dist,
                    recovery_seconds=90,
                    recovery_type="jog",
                    notes=f"{repeats}x{rep_dist}m a ritmo de VO2máx (I)",
                )
            )

        blocks.append(
            block(
                "cooldown",
                position=3,
                repeats=1,
                distance_m=cooldown_m,
                notes="Vuelta a la calma y soltar piernas",
            )
        )

    else:
        # Fallback single block
        blocks.append(
            block(
                "main",
                position=1,
                repeats=1,
                distance_m=int(total_km * 1000),
            )
        )

    return blocks
