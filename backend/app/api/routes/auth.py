"""Flujo OAuth 2.0 real para conectar Strava con el scope correcto."""

import uuid
from datetime import UTC, datetime
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.core.encryption import decrypt_secret, encrypt_secret
from app.models import AuthToken

router = APIRouter(prefix="/auth", tags=["auth"])

STRAVA_AUTHORIZE = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN = "https://www.strava.com/oauth/token"
STRAVA_SCOPE = "read,activity:read,profile:read_all"


def _get_strava_token(session: SessionDep, user_id: uuid.UUID) -> AuthToken | None:
    return session.exec(
        select(AuthToken).where(
            AuthToken.user_id == user_id, AuthToken.provider == "strava"
        )
    ).first()


def _decrypt_meta(token: AuthToken) -> dict[str, str]:
    return {
        key: decrypt_secret(str(value)) for key, value in token.metadata_json.items()
    }


def _callback_url(request: Request) -> str:
    if settings.STRAVA_REDIRECT_URI:
        return settings.STRAVA_REDIRECT_URI
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/v1/auth/strava/callback"


@router.get("/strava")
def start_strava_auth(
    session: SessionDep, current_user: CurrentUser, request: Request
) -> dict[str, str]:
    token = _get_strava_token(session, current_user.id)
    client_id = ""
    if token:
        client_id = _decrypt_meta(token).get("client_id", "")
    if not client_id:
        raise HTTPException(
            status_code=400,
            detail="Primero guardá el Client ID y Client Secret de tu app de Strava "
            "en Configuración → Integraciones",
        )
    redirect_uri = _callback_url(request)
    url = (
        f"{STRAVA_AUTHORIZE}?client_id={client_id}"
        f"&response_type=code&redirect_uri={quote(redirect_uri)}"
        f"&approval_prompt=auto&scope={quote(STRAVA_SCOPE)}"
        f"&state={current_user.id}"
    )
    return {"url": url}


@router.get("/strava/callback")
def finish_strava_auth(
    session: SessionDep,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    scope: str | None = None,
) -> RedirectResponse:
    frontend = f"{settings.FRONTEND_HOST.rstrip('/')}/settings"
    if error:
        return RedirectResponse(f"{frontend}?strava=error")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Falta el código de autorización")

    try:
        user_id = uuid.UUID(state)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="Estado de autorización inválido"
        ) from exc

    token = _get_strava_token(session, user_id)
    if not token:
        raise HTTPException(
            status_code=400, detail="No hay integración Strava para este usuario"
        )
    meta = _decrypt_meta(token)
    client_id = meta.get("client_id", "")
    client_secret = meta.get("client_secret", "")
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Faltan Client ID o Client Secret")

    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(
                STRAVA_TOKEN,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502, detail="No se pudo contactar a Strava"
        ) from exc

    if response.status_code != 200:
        return RedirectResponse(f"{frontend}?strava=error")

    payload = response.json()
    access_token = str(payload.get("access_token", ""))
    refresh_token = str(payload.get("refresh_token", ""))
    expires_in = payload.get("expires_in")
    expires_at = (
        datetime.now(UTC).timestamp() + int(str(expires_in)) if expires_in else None
    )
    granted_scope = str(payload.get("scope") or scope or "")

    token.access_token = encrypt_secret(access_token)
    token.refresh_token = encrypt_secret(refresh_token) if refresh_token else None
    token.expires_at = (
        datetime.fromtimestamp(expires_at, tz=UTC) if expires_at else None
    )
    meta["scope"] = granted_scope
    token.metadata_json = {key: encrypt_secret(value) for key, value in meta.items()}
    session.add(token)
    session.commit()

    return RedirectResponse(f"{frontend}?strava=connected")
