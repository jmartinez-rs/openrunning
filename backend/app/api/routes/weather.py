"""Weather forecast and running condition recommendations via Open-Meteo API."""

from __future__ import annotations

import datetime as dt
import logging
from typing import Dict, Tuple

import httpx
from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.models import WeatherForecastPublic

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/weather", tags=["weather"])

# In-memory daily cache: (iso_date, round(lat, 2), round(lon, 2)) -> WeatherForecastPublic
_WEATHER_CACHE: Dict[Tuple[str, float, float], WeatherForecastPublic] = {}

WEATHER_CONDITIONS = {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna moderada",
    55: "Llovizna intensa",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia fuerte",
    71: "Nevada ligera",
    73: "Nevada moderada",
    75: "Nevada fuerte",
    80: "Chubascos ligeros",
    81: "Chubascos moderados",
    82: "Chubascos violentos",
    95: "Tormenta eléctrica",
    96: "Tormenta eléctrica con granizo",
}


def _resolve_apparel(temp_max: float, precip_mm: float, wind_kmh: float) -> str:
    """Derives apparel and gear recommendations from forecasted conditions."""
    if precip_mm >= 2.0:
        return "Campera impermeable técnica / cortavientos, gorra con visera y calzado con buen grip."
    if temp_max < 8.0:
        return "Calzas largas térmicas, camiseta técnica de manga larga, guantes livianos y cuello térmico."
    if temp_max < 15.0:
        return "Camiseta técnica de manga larga fina o remera con manguitos, shorts o calza corta. Clima ideal para ritmos rápidos."
    if temp_max >= 25.0:
        return "Musculosa o remera ultra transpirable, shorts livianos, gorra ventilada y protector solar. Hidratación constante obligatoria."
    if wind_kmh > 30.0:
        return "Remera técnica y rompevientos liviano para evitar enfriamiento con el viento fuerte."
    return "Remera técnica de manga corta y shorts cómodos. Condiciones óptimas."


@router.get("", response_model=WeatherForecastPublic)
async def get_weather(
    current_user: CurrentUser,
    date: dt.date | None = None,
    latitude: float = -34.6037,
    longitude: float = -58.3816,
) -> WeatherForecastPublic:
    """Returns weather forecast and running apparel recommendations.

    Fetches daily forecast from Open-Meteo, with caching and fallback for offline/historical dates.
    """
    target_date = date or dt.date.today()
    cache_key = (target_date.isoformat(), round(latitude, 2), round(longitude, 2))

    if cache_key in _WEATHER_CACHE:
        return _WEATHER_CACHE[cache_key]

    # Defaults / fallback
    temp_min = 14.0
    temp_max = 22.0
    precip = 0.0
    wind = 12.0
    code = 1

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={latitude}&longitude={longitude}"
            f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weathercode"
            f"&timezone=auto"
        )
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json().get("daily", {})
                times = data.get("time", [])
                target_str = target_date.isoformat()
                if target_str in times:
                    idx = times.index(target_str)
                    temp_max = float(data.get("temperature_2m_max", [temp_max])[idx])
                    temp_min = float(data.get("temperature_2m_min", [temp_min])[idx])
                    precip = float(data.get("precipitation_sum", [precip])[idx])
                    wind = float(data.get("wind_speed_10m_max", [wind])[idx])
                    code = int(data.get("weathercode", [code])[idx])
    except Exception as exc:
        logger.warning("Error fetching Open-Meteo weather forecast: %s", exc)

    condition = WEATHER_CONDITIONS.get(code, "Parcialmente nublado")
    apparel = _resolve_apparel(temp_max, precip, wind)

    forecast = WeatherForecastPublic(
        date=target_date,
        latitude=latitude,
        longitude=longitude,
        temperature_min_c=round(temp_min, 1),
        temperature_max_c=round(temp_max, 1),
        precipitation_mm=round(precip, 1),
        wind_speed_kmh=round(wind, 1),
        weather_code=code,
        condition=condition,
        apparel_recommendation=apparel,
    )

    _WEATHER_CACHE[cache_key] = forecast
    return forecast
