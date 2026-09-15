"""Encriptación en reposo para secretos de integraciones.

Se usa Fernet (AES-128-CBC + HMAC-SHA256) con una clave derivada de
SECRET_KEY. Esto evita guardar tokens o API keys en texto plano en la base de
datos.

Nota: si se rota SECRET_KEY, los secretos almacenados dejan de poder
desencriptarse y el usuario deberá reconectar las integraciones.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _get_fernet() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    )
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """Encripta un secreto y devuelve texto base64 url-safe."""
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    """Desencripta un secreto previamente cifrado con encrypt_secret."""
    if not ciphertext:
        return ""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as error:
        raise ValueError("No se pudo desencriptar el secreto almacenado") from error
