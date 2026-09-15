"""Clientes de conexión para probar credenciales de Strava."""

import httpx

from app.core.encryption import decrypt_secret

STRAVA_API = "https://www.strava.com/api/v3"
STRAVA_OAUTH_TOKEN = "https://www.strava.com/oauth/token"
TIMEOUT_SECONDS = 10.0


def test_strava_athlete(access_token: str) -> tuple[bool, str]:
    """Valida un access token de Strava contra /athlete."""
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.get(
                f"{STRAVA_API}/athlete",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if response.status_code == 200:
                athlete = response.json()
                name = " ".join(
                    part
                    for part in (
                        athlete.get("firstname"),
                        athlete.get("lastname"),
                    )
                    if part
                )
                return True, f"Conectado a Strava como {name or 'atleta'}"
            if response.status_code == 401:
                return False, "Token de Strava inválido o expirado"
            return False, f"Strava respondió {response.status_code}"
    except httpx.TimeoutException:
        return False, "Tiempo de espera agotado al conectar con Strava"
    except httpx.RequestError:
        return False, "No se pudo conectar con Strava"


def refresh_strava_token(
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> dict[str, object] | None:
    """Intercambia un refresh_token de Strava por tokens nuevos."""
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.post(
                STRAVA_OAUTH_TOKEN,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )
            if response.status_code == 200:
                data: dict[str, object] = dict(response.json())
                return data
            return None
    except httpx.RequestError:
        return None


def decrypt_stored_token(ciphertext: str) -> str:
    """Desencripta un token almacenado."""
    return decrypt_secret(ciphertext)
