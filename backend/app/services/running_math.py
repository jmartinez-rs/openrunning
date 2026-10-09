import math
from typing import Dict, Tuple

def predict_time_riegel(source_distance_m: float, source_time_sec: float, target_distance_m: float, exponent: float = 1.06) -> float:
    if source_distance_m <= 0 or source_time_sec <= 0 or target_distance_m <= 0:
        return 0.0
    return round(source_time_sec * (target_distance_m / source_distance_m) ** exponent)

def calculate_vdot(distance_meters: float, time_seconds: float) -> float:
    if distance_meters <= 0 or time_seconds <= 0:
        return 0.0
    time_minutes = time_seconds / 60.0
    velocity_m_per_min = distance_meters / time_minutes

    vo2 = -4.6 + 0.182258 * velocity_m_per_min + 0.000104 * (velocity_m_per_min ** 2)

    percent_max = (
        0.8
        + 0.1894393 * math.exp(-0.012778 * time_minutes)
        + 0.2989558 * math.exp(-0.1932605 * time_minutes)
    )

    vdot = vo2 / percent_max
    if not math.isfinite(vdot) or vdot <= 0:
        return 0.0
    return round(vdot * 10) / 10

def format_pace(seconds_per_km: float) -> str:
    if math.isnan(seconds_per_km) or seconds_per_km <= 0 or not math.isfinite(seconds_per_km):
        return "--:--"
    minutes = math.floor(seconds_per_km / 60)
    seconds = round(seconds_per_km % 60)
    formatted_seconds = f"0{seconds}" if seconds < 10 else f"{seconds}"
    return f"{minutes}:{formatted_seconds}"

def parse_pace(pace_str: str) -> float:
    if not pace_str or ":" not in pace_str:
        return 0.0
    parts = pace_str.split(":")
    mins = int(parts[0]) if parts[0].isdigit() else 0
    secs = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    return float(mins * 60 + secs)

def get_training_paces_seconds(vdot: float) -> Dict[str, float]:
    if vdot <= 0:
        return {
            "easy_min": 0.0,
            "easy_max": 0.0,
            "marathon": 0.0,
            "threshold": 0.0,
            "interval": 0.0,
            "repetition": 0.0,
        }

    def velocity_for_vo2(vo2: float) -> float:
        a = 0.000104
        b = 0.182258
        c = -(4.6 + vo2)
        disc = b * b - 4 * a * c
        if disc <= 0:
            return 0.0
        return (-b + math.sqrt(disc)) / (2 * a)

    def pace_for_fraction(fraction: float) -> float:
        velocity = velocity_for_vo2(vdot * fraction)
        return round(60000.0 / velocity, 1) if velocity > 0 else 0.0

    return {
        "easy_min": pace_for_fraction(0.74),
        "easy_max": pace_for_fraction(0.59),
        "marathon": pace_for_fraction(0.84),
        "threshold": pace_for_fraction(0.88),
        "interval": pace_for_fraction(1.0),
        "repetition": pace_for_fraction(1.05),
    }


def get_training_paces(vdot: float) -> Dict[str, str]:
    if vdot <= 0:
        return {
            "easyMin": "--:--",
            "easyMax": "--:--",
            "marathon": "--:--",
            "threshold": "--:--",
            "interval": "--:--",
            "repetition": "--:--",
        }

    def velocity_for_vo2(vo2: float) -> float:
        a = 0.000104
        b = 0.182258
        c = -(4.6 + vo2)
        disc = b * b - 4 * a * c
        if disc <= 0:
            return 0.0
        return (-b + math.sqrt(disc)) / (2 * a)

    def pace_for_fraction(fraction: float) -> float:
        velocity = velocity_for_vo2(vdot * fraction)
        return 60000.0 / velocity if velocity > 0 else 0.0

    return {
        "easyMin": format_pace(pace_for_fraction(0.74)),
        "easyMax": format_pace(pace_for_fraction(0.59)),
        "marathon": format_pace(pace_for_fraction(0.84)),
        "threshold": format_pace(pace_for_fraction(0.88)),
        "interval": format_pace(pace_for_fraction(1.0)),
        "repetition": format_pace(pace_for_fraction(1.05)),
    }

def format_time(total_seconds: float) -> str:
    if math.isnan(total_seconds) or total_seconds <= 0:
        return "0:00"
    hours = math.floor(total_seconds / 3600)
    minutes = math.floor((total_seconds % 3600) / 60)
    seconds = round(total_seconds % 60)
    
    formatted_secs = f"0{seconds}" if seconds < 10 else f"{seconds}"
    if hours > 0:
        formatted_mins = f"0{minutes}" if minutes < 10 else f"{minutes}"
        return f"{hours}:{formatted_mins}:{formatted_secs}"
    return f"{minutes}:{formatted_secs}"
