"""
Módulo de Fisiología Deportiva y Matemática del Corredor para OpenRunning.

Implementa:
- VDOT (Fórmula de Jack Daniels) y cálculo de ritmos de entrenamiento (Easy, Marathon, Threshold, Interval, Repetition).
- Predictor de tiempos de carrera mediante la fórmula de Pete Riegel.
- Zonas de frecuencia cardíaca por la fórmula de Karvonen (FC de reserva) y porcentaje de FCmáx.
- Conversiones entre ritmos (min/km, min/mi) y velocidades (km/h).
"""

import math
from typing import Any


def format_seconds_to_time(total_seconds: float) -> str:
    """Convierte segundos totales en formato 'hh:mm:ss' o 'mm:ss'."""
    if total_seconds <= 0 or math.isnan(total_seconds):
        return "0:00"
    total_sec_int = round(total_seconds)
    hours = total_sec_int // 3600
    minutes = (total_sec_int % 3600) // 60
    seconds = total_sec_int % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def format_pace(seconds_per_km: float) -> str:
    """Convierte ritmo en segundos por km a formato 'mm:ss /km'."""
    if seconds_per_km <= 0 or math.isnan(seconds_per_km) or math.isinf(seconds_per_km):
        return "--:--"
    sec_int = round(seconds_per_km)
    minutes = sec_int // 60
    seconds = sec_int % 60
    return f"{minutes}:{seconds:02d}"


def parse_time_string(time_str: str) -> int:
    """
    Parsea cadenas como '45:30', '1:45:00' o '01:45:30' a segundos totales.
    """
    parts = [int(p.strip()) for p in time_str.split(":") if p.strip()]
    if len(parts) == 1:
        return parts[0]
    elif len(parts) == 2:
        return parts[0] * 60 + parts[1]
    elif len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0


def kmh_to_pace_seconds(kmh: float) -> float:
    """Convierte velocidad en km/h a ritmo en segundos/km."""
    if kmh <= 0:
        return 0.0
    return 3600.0 / kmh


def pace_seconds_to_kmh(seconds_per_km: float) -> float:
    """Convierte ritmo en segundos/km a km/h."""
    if seconds_per_km <= 0:
        return 0.0
    return 3600.0 / seconds_per_km


def predict_time_riegel(
    source_distance_m: float,
    source_time_seconds: float,
    target_distance_m: float,
    fatigue_factor: float = 1.06,
) -> float:
    """
    Predicción de tiempo de carrera mediante la fórmula de Pete Riegel:
    T2 = T1 * (D2 / D1) ^ 1.06
    """
    if source_distance_m <= 0 or source_time_seconds <= 0 or target_distance_m <= 0:
        return 0.0
    return source_time_seconds * ((target_distance_m / source_distance_m) ** fatigue_factor)


def calculate_vdot(distance_meters: float, time_seconds: float) -> float:
    """
    Calcula el VDOT aproximado de Jack Daniels a partir de una distancia en metros
    y un tiempo en segundos.

    Fórmulas estándar de Daniels & Gilbert:
    VO2 = -4.60 + 0.182258 * v + 0.000104 * v^2
    %VO2max = 0.8 + 0.1894393 * exp(-0.012778 * t) + 0.2989558 * exp(-0.1932605 * t)
    VDOT = VO2 / %VO2max
    donde v es velocidad en m/min y t es tiempo en minutos.
    """
    if distance_meters <= 0 or time_seconds <= 0:
        return 0.0

    time_minutes = time_seconds / 60.0
    velocity_m_per_min = distance_meters / time_minutes

    vo2 = (
        -4.60
        + 0.182258 * velocity_m_per_min
        + 0.000104 * (velocity_m_per_min**2)
    )

    percent_max = (
        0.8
        + 0.1894393 * math.exp(-0.012778 * time_minutes)
        + 0.2989558 * math.exp(-0.1932605 * time_minutes)
    )

    if percent_max <= 0:
        return 0.0

    vdot = vo2 / percent_max
    return round(vdot, 2)


def get_training_paces_from_vdot(vdot: float) -> dict[str, Any]:
    """
    Devuelve los ritmos recomendados de entrenamiento (en sec/km y formateados)
    según las zonas de Jack Daniels:
    - Easy (E): 65% - 79% VO2max
    - Marathon (M): 80% - 88% VO2max
    - Threshold / Umbral (T): 88% - 92% VO2max
    - Interval / VO2max (I): 97% - 100% VO2max
    - Repetition (R): 105% - 110% VO2max
    """
    if vdot <= 0:
        return {}

    def velocity_from_vo2(target_vo2: float) -> float:
        """Resuelve cuadrática 0.000104 * v^2 + 0.182258 * v - (target_vo2 + 4.60) = 0"""
        a = 0.000104
        b = 0.182258
        c = -(target_vo2 + 4.60)
        discriminant = b**2 - 4 * a * c
        if discriminant < 0:
            return 0.0
        v = (-b + math.sqrt(discriminant)) / (2 * a)
        return v  # m/min

    def pace_from_velocity(v_m_min: float) -> float:
        """Convierte m/min a segundos/km."""
        if v_m_min <= 0:
            return 0.0
        return 1000.0 / (v_m_min / 60.0)

    # Factores de intensidad sobre VDOT
    easy_fast_sec = pace_from_velocity(velocity_from_vo2(vdot * 0.74))
    easy_slow_sec = pace_from_velocity(velocity_from_vo2(vdot * 0.65))
    marathon_sec = pace_from_velocity(velocity_from_vo2(vdot * 0.84))
    threshold_sec = pace_from_velocity(velocity_from_vo2(vdot * 0.88))
    interval_sec = pace_from_velocity(velocity_from_vo2(vdot * 0.98))
    repetition_sec = pace_from_velocity(velocity_from_vo2(vdot * 1.05))

    return {
        "vdot": vdot,
        "easy_pace_range": f"{format_pace(easy_fast_sec)} - {format_pace(easy_slow_sec)} /km",
        "easy_pace_seconds": {"min": round(easy_fast_sec, 1), "max": round(easy_slow_sec, 1)},
        "marathon_pace": f"{format_pace(marathon_sec)} /km",
        "marathon_pace_seconds": round(marathon_sec, 1),
        "threshold_pace": f"{format_pace(threshold_sec)} /km",
        "threshold_pace_seconds": round(threshold_sec, 1),
        "interval_pace": f"{format_pace(interval_sec)} /km",
        "interval_pace_seconds": round(interval_sec, 1),
        "repetition_pace": f"{format_pace(repetition_sec)} /km",
        "repetition_pace_seconds": round(repetition_sec, 1),
    }


def calculate_karvonen_hr_zones(resting_hr: int, max_hr: int) -> dict[str, Any]:
    """
    Calcula las 5 zonas de frecuencia cardíaca utilizando la fórmula de Karvonen
    (frecuencia cardíaca de reserva = HRmax - HRrest).
    Target HR = HRrest + (HRmax - HRrest) * %Intensidad
    """
    if max_hr <= resting_hr or resting_hr <= 0:
        return {"error": "Frecuencia cardíaca máxima debe ser mayor a la frecuencia en reposo"}

    hr_reserve = max_hr - resting_hr

    def zone_range(low_pct: float, high_pct: float) -> tuple[int, int]:
        low = round(resting_hr + hr_reserve * low_pct)
        high = round(resting_hr + hr_reserve * high_pct)
        return (low, high)

    z1 = zone_range(0.50, 0.60)
    z2 = zone_range(0.60, 0.70)
    z3 = zone_range(0.70, 0.80)
    z4 = zone_range(0.80, 0.90)
    z5 = zone_range(0.90, 1.00)

    return {
        "resting_hr": resting_hr,
        "max_hr": max_hr,
        "hr_reserve": hr_reserve,
        "zones": {
            "Z1_recovery": {"bpm_range": f"{z1[0]} - {z1[1]} bpm", "low": z1[0], "high": z1[1], "pct": "50-60%"},
            "Z2_aerobic_base": {"bpm_range": f"{z2[0]} - {z2[1]} bpm", "low": z2[0], "high": z2[1], "pct": "60-70%"},
            "Z3_tempo": {"bpm_range": f"{z3[0]} - {z3[1]} bpm", "low": z3[0], "high": z3[1], "pct": "70-80%"},
            "Z4_lactate_threshold": {"bpm_range": f"{z4[0]} - {z4[1]} bpm", "low": z4[0], "high": z4[1], "pct": "80-90%"},
            "Z5_vo2_max": {"bpm_range": f"{z5[0]} - {z5[1]} bpm", "low": z5[0], "high": z5[1], "pct": "90-100%"},
        },
    }
