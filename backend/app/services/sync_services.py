"""Sincronización de actividades desde Strava.

Lee las credenciales cifradas del usuario, consulta la API de Strava y
persiste actividades deduplicadas por (user, source_type, source_id).
"""

import uuid
from datetime import UTC, datetime

import httpx
from sqlmodel import Session, col, func, select

from app.core.encryption import decrypt_secret
from app.models import (
    Activity,
    ActivityCardio,
    AuthToken,
    Shoe,
    User,
)
from app.services.integrations import (
    STRAVA_API,
    TIMEOUT_SECONDS,
    refresh_strava_token,
)

STRAVA_CARDIO_TYPES = {
    "Run",
    "Ride",
    "Swim",
    "Walk",
    "Hike",
    "TrailRun",
    "VirtualRide",
    "VirtualRun",
    "Elliptical",
    "StairStepper",
}
MAX_PAGES = 10
PAGE_SIZE = 10


def get_integration(
    session: Session, user_id: uuid.UUID, provider: str
) -> AuthToken | None:
    return session.exec(
        select(AuthToken).where(
            AuthToken.user_id == user_id, AuthToken.provider == provider
        )
    ).first()


def _decrypt(value: str | None) -> str:
    if not value:
        return ""
    try:
        return decrypt_secret(value)
    except ValueError:
        return ""


def _decrypt_metadata(token: AuthToken) -> dict[str, str]:
    return {key: _decrypt(str(value)) for key, value in token.metadata_json.items()}


try:
    from tenacity import retry, stop_after_attempt, wait_exponential

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    def _get_with_retry(
        client: httpx.Client,
        url: str,
        headers: dict[str, str],
        params: dict[str, str | int] | None = None,
    ) -> httpx.Response:
        response = client.get(url, headers=headers, params=params)
        if response.status_code == 429:
            raise httpx.HTTPStatusError(
                "Rate limited", request=response.request, response=response
            )
        return response

except ImportError:
    # tenacity is optional: fall back to a simple wrapper
    def _get_with_retry(  # type: ignore[misc]
        client: httpx.Client,
        url: str,
        headers: dict[str, str],
        params: dict[str, str | int] | None = None,
    ) -> httpx.Response:
        response = client.get(url, headers=headers, params=params)
        if response.status_code == 429:
            raise httpx.HTTPStatusError(
                "Rate limited", request=response.request, response=response
            )
        return response


def _ensure_strava_access(session: Session, token: AuthToken) -> str:
    """Devuelve un access token vigente, refrescándolo si expiró o no existe."""
    access = _decrypt(token.access_token)
    now = datetime.now(UTC)

    # Si tenemos un access token válido que no expiró, lo devolvemos
    if access and (not token.expires_at or token.expires_at > now):
        return access

    # Si falta el access_token o ya expiró, intentamos refrescarlo si hay refresh_token
    if token.refresh_token:
        metadata = _decrypt_metadata(token)
        client_id = metadata.get("client_id", "")
        client_secret = metadata.get("client_secret", "")
        refresh_tok = _decrypt(token.refresh_token)
        if client_id and client_secret and refresh_tok:
            result = refresh_strava_token(
                client_id,
                client_secret,
                refresh_tok,
            )
            if result and result.get("access_token"):
                new_access = str(result["access_token"])
                new_refresh = str(result.get("refresh_token") or refresh_tok)
                new_expires = None
                if result.get("expires_at"):
                    new_expires = datetime.fromtimestamp(
                        int(str(result["expires_at"])), tz=UTC
                    )
                token.access_token = _encrypt_for_storage(new_access)
                token.refresh_token = _encrypt_for_storage(new_refresh)
                token.expires_at = new_expires
                session.add(token)
                session.commit()
                return new_access

    return access


def _encrypt_for_storage(value: str) -> str:
    from app.core.encryption import encrypt_secret

    return encrypt_secret(value)


def sync_strava(session: Session, user: User) -> dict[str, object]:
    """Importa actividades cardio de Strava y devuelve un resumen."""
    token = get_integration(session, user.id, "strava")
    if not token or not token.access_token:
        return {
            "provider": "strava",
            "imported": 0,
            "skipped": 0,
            "message": "No hay credenciales de Strava guardadas",
        }

    access = _ensure_strava_access(session, token)
    if not access:
        return {
            "provider": "strava",
            "imported": 0,
            "skipped": 0,
            "message": "No se pudo obtener un token de Strava válido",
        }

    imported = 0
    skipped = 0
    errors = 0
    scope_message: str | None = None
    headers = {"Authorization": f"Bearer {access}"}
    refreshed = False
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            for page in range(1, MAX_PAGES + 1):
                response = _get_with_retry(
                    client,
                    f"{STRAVA_API}/athlete/activities",
                    headers,
                    {"per_page": PAGE_SIZE, "page": page},
                )
                if response.status_code == 401:
                    if refreshed:
                        errors += 1
                        scope_message = _strava_401_message(response)
                        break
                    refreshed = True
                    access = _ensure_strava_access(session, token)
                    if not access:
                        scope_message = _strava_401_message(response)
                        break
                    headers = {"Authorization": f"Bearer {access}"}
                    continue
                if response.status_code != 200:
                    errors += 1
                    break
                activities = response.json()
                if not activities:
                    break
                for item in activities:
                    if _store_strava_activity(session, user, item):
                        imported += 1
                    else:
                        skipped += 1
                if len(activities) < PAGE_SIZE:
                    break
    except httpx.RequestError:
        errors += 1

    if scope_message:
        return {
            "provider": "strava",
            "imported": 0,
            "skipped": 0,
            "errors": 1,
            "message": scope_message,
        }
    details_filled = _fill_strava_details(session, user, token)
    message = f"Se importaron {imported} actividades ({skipped} duplicadas)"
    if details_filled:
        message += f"; se completaron detalles de {details_filled}"
    gear_result = import_strava_gear(session, user)
    gear_message = str(gear_result.get("message", ""))
    if gear_message:
        message += f". {gear_message}"
    return {
        "provider": "strava",
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "message": message,
    }


DETAIL_CAP = 30


def _fill_strava_details(session: Session, user: User, token: AuthToken) -> int:
    """Completa splits, zonas HR y polyline de las actividades más recientes.

    Evita re-pedir las ya completadas y limita la cantidad por ejecución para
    no superar los límites de la API de Strava.
    """
    access = _ensure_strava_access(session, token)
    if not access:
        return 0

    pending = session.exec(
        select(Activity, ActivityCardio)
        .join(ActivityCardio)
        .where(
            Activity.user_id == user.id,
            Activity.source_type == "strava",
            col(ActivityCardio.map_summary_polyline).is_(None),
        )
        .order_by(col(Activity.timestamp).desc())
        .limit(DETAIL_CAP)
    ).all()
    if not pending:
        return 0

    headers = {"Authorization": f"Bearer {access}"}
    filled = 0
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            for activity, cardio in pending:
                detail = _get_with_retry(
                    client,
                    f"{STRAVA_API}/activities/{activity.source_id}",
                    headers,
                )
                if detail.status_code != 200:
                    if detail.status_code == 429:
                        break
                    continue
                detail_json = detail.json()
                payload = detail_json if isinstance(detail_json, dict) else {}
                map_raw = payload.get("map")
                map_data = map_raw if isinstance(map_raw, dict) else {}
                splits = payload.get("splits_metric") or []
                polyline = str(map_data.get("summary_polyline") or "")
                cardio.map_summary_polyline = polyline or None
                cardio.splits = [
                    {
                        "distance": s.get("distance"),
                        "moving_time": s.get("moving_time"),
                        "split": s.get("split"),
                        "pace": s.get("average_speed"),
                    }
                    for s in splits
                    if isinstance(s, dict)
                ]

                zones = _get_with_retry(
                    client,
                    f"{STRAVA_API}/activities/{activity.source_id}/zones",
                    headers,
                )
                if zones.status_code == 200:
                    zones_payload = zones.json()
                    hr_zones = None
                    if isinstance(zones_payload, list):
                        for zone_set in zones_payload:
                            if (
                                isinstance(zone_set, dict)
                                and zone_set.get("type") == "heartrate"
                            ):
                                hr_zones = zone_set.get("distribution_buckets")
                                break
                    elif isinstance(zones_payload, dict):
                        hr_zones = zones_payload.get("distribution_buckets")
                    cardio.heart_rate_zones = [
                        {
                            "min": z.get("min"),
                            "max": z.get("max"),
                            "time": z.get("time"),
                        }
                        for z in (hr_zones or [])
                        if isinstance(z, dict)
                    ]
                elif zones.status_code == 429:
                    break

                session.add(cardio)
                session.commit()
                filled += 1
    except httpx.RequestError:
        pass
    return filled


def import_strava_gear(session: Session, user: User) -> dict[str, object]:
    """Importa las zapatillas de Strava (gear) como calzado local.

    Usa ``GET /athlete`` (lista resumida de ``shoes``) y ``GET /gear/{id}``
    para los detalles. Hace upsert por ``strava_gear_id``; si ya existe una
    zapatilla local con el mismo nombre, la vincula en vez de duplicar.
    Auto-asigna el calzado a las actividades cardio cuyo ``gear_id`` coincida.
    """
    token = get_integration(session, user.id, "strava")
    if not token or not token.access_token:
        return {
            "imported": 0,
            "updated": 0,
            "linked": 0,
            "assigned": 0,
            "message": "No hay credenciales de Strava guardadas",
        }
    access = _ensure_strava_access(session, token)
    if not access:
        return {
            "imported": 0,
            "updated": 0,
            "linked": 0,
            "assigned": 0,
            "message": "No se pudo obtener un token de Strava válido",
        }

    headers = {"Authorization": f"Bearer {access}"}
    imported = updated = linked = assigned = 0
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            athlete = _get_with_retry(client, f"{STRAVA_API}/athlete", headers)
            if athlete.status_code != 200:
                return {
                    "imported": 0,
                    "updated": 0,
                    "linked": 0,
                    "assigned": 0,
                    "message": f"Strava respondió {athlete.status_code}",
                }
            payload = athlete.json()
            shoes = payload.get("shoes") if isinstance(payload, dict) else None
            for summary in shoes if isinstance(shoes, list) else []:
                if not isinstance(summary, dict):
                    continue
                gear_id = str(summary.get("id") or "").strip()
                if not gear_id:
                    continue
                detail = _get_with_retry(
                    client, f"{STRAVA_API}/gear/{gear_id}", headers
                )
                if detail.status_code != 200:
                    continue
                gear = detail.json()
                if not isinstance(gear, dict):
                    continue
                result = _upsert_strava_shoe(session, user, gear)
                if result == "imported":
                    imported += 1
                elif result == "updated":
                    updated += 1
                elif result == "linked":
                    linked += 1
                assigned += _assign_gear_to_activities(session, user, gear_id)
    except httpx.RequestError:
        pass

    message = f"Se importaron {imported} zapatillas de Strava"
    if updated:
        message += f" ({updated} actualizadas)"
    if linked:
        message += f", {linked} vinculadas a zapatillas existentes"
    if assigned:
        message += f"; {assigned} sesiones asignadas"
    return {
        "imported": imported,
        "updated": updated,
        "linked": linked,
        "assigned": assigned,
        "message": message,
    }


def _upsert_strava_shoe(session: Session, user: User, gear: dict[str, object]) -> str:
    """Crea/actualiza/vincula una zapatilla local desde un gear de Strava.

    Devuelve "imported" (nueva), "updated" (ya existía por gear_id) o
    "linked" (se vinculó a una zapatilla local con el mismo nombre).
    """
    gear_id = str(gear.get("id") or "").strip()
    brand = str(gear.get("brand_name") or "").strip() or None
    model = str(gear.get("model_name") or "").strip() or None
    name = str(gear.get("name") or "").strip()
    if not name and brand:
        name = f"{brand} {model or ''}".strip()
    if not name:
        name = "Zapatilla Strava"

    existing = session.exec(
        select(Shoe).where(
            Shoe.user_id == user.id, Shoe.strava_gear_id == gear_id
        )
    ).first()
    if existing:
        changed = False
        if name and existing.name != name:
            existing.name = name
            changed = True
        if brand and existing.brand != brand:
            existing.brand = brand
            changed = True
        if model and existing.model != model:
            existing.model = model
            changed = True
        if changed:
            session.add(existing)
            session.commit()
        return "updated"

    by_name = session.exec(
        select(Shoe).where(
            Shoe.user_id == user.id, func.lower(Shoe.name) == name.lower()
        )
    ).first()
    if by_name:
        by_name.strava_gear_id = gear_id
        session.add(by_name)
        session.commit()
        return "linked"

    session.add(
        Shoe(
            user_id=user.id,
            name=name,
            brand=brand,
            model=model,
            category="training",
            strava_gear_id=gear_id,
        )
    )
    session.commit()
    return "imported"


def _assign_gear_to_activities(
    session: Session, user: User, gear_id: str
) -> int:
    """Asigna la zapatilla importada a las sesiones con ese gear_id."""
    shoe = session.exec(
        select(Shoe).where(
            Shoe.user_id == user.id, Shoe.strava_gear_id == gear_id
        )
    ).first()
    if not shoe:
        return 0
    rows = session.exec(
        select(ActivityCardio)
        .join(Activity)
        .where(
            Activity.user_id == user.id,
            Activity.source_type == "strava",
            ActivityCardio.gear_id == gear_id,
            ActivityCardio.shoe_id == None,  # noqa: E711  (SQLAlchemy → IS NULL)
        )
    ).all()
    if not rows:
        return 0
    for cardio in rows:
        cardio.shoe_id = shoe.id
        session.add(cardio)
    session.commit()
    return len(rows)


def _strava_401_message(response: httpx.Response) -> str:
    """Genera un mensaje útil para un 401 de Strava."""
    try:
        body = response.json()
        errors = body.get("errors") if isinstance(body, dict) else None
        if errors:
            fields = [str(e.get("field", "")) for e in errors if isinstance(e, dict)]
            if any("permission" in f or "scope" in f for f in fields):
                return (
                    "El token de Strava no tiene el permiso para leer actividades "
                    "(activity:read). Generá un token nuevo con ese scope."
                )
    except (ValueError, AttributeError):
        pass
    return "Token de Strava inválido o expirado"


def _store_strava_activity(
    session: Session, user: User, item: dict[str, object]
) -> bool:
    activity_type = str(item.get("type", ""))
    if activity_type not in STRAVA_CARDIO_TYPES:
        return False

    source_id = str(item.get("id", "")).strip()
    if not source_id:
        return False

    existing = session.exec(
        select(Activity).where(
            Activity.user_id == user.id,
            Activity.source_type == "strava",
            Activity.source_id == source_id,
        )
    ).first()
    if existing:
        return False

    start = item.get("start_date")
    timestamp = (
        datetime.fromisoformat(str(start).replace("Z", "+00:00"))
        if start
        else datetime.now(UTC)
    )
    moving_time = int(
        float(str(item.get("moving_time") or item.get("elapsed_time") or 0))
    )
    distance = float(str(item.get("distance") or 0))
    avg_pace = None
    if distance > 0 and moving_time > 0:
        avg_pace = moving_time / (distance / 1000)

    activity = Activity(
        user_id=user.id,
        source_id=source_id,
        source_type="strava",
        timestamp=timestamp,
        duration_seconds=moving_time,
        name=str(item.get("name") or "Actividad Strava")[:255],
        sport_type=str(item.get("type") or "")[:32] or None,
    )
    session.add(activity)
    session.flush()
    session.add(
        ActivityCardio(
            activity_id=activity.id,
            distance_meters=distance,
            avg_pace_seconds_per_km=round(avg_pace, 2) if avg_pace else None,
            avg_hr=_to_int(item.get("average_heartrate")),
            max_hr=_to_int(item.get("max_heartrate")),
            elevation_gain_meters=float(str(item.get("total_elevation_gain") or 0)),
            calories=_to_int(item.get("calories")),
            gear_id=str(item.get("gear_id") or "")[:64] or None,
        )
    )
    session.commit()
    return True


def _to_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(float(str(value)))
    except (TypeError, ValueError):
        return None
