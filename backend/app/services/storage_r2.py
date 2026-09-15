"""Storage en Cloudflare R2 (S3 compatible) usando boto3."""

import uuid
from pathlib import Path
from typing import Any

import boto3  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from app.core.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _client() -> Any:
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def is_configured() -> bool:
    return bool(
        settings.R2_BUCKET_NAME
        and settings.R2_ENDPOINT_URL
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
    )


def upload_file(data: bytes, filename: str) -> dict[str, str]:
    """Sube un archivo a R2 y devuelve filename + url."""
    if not is_configured():
        raise RuntimeError("Cloudflare R2 no está configurado")
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Tipo de imagen no soportado")
    key = f"{uuid.uuid4()}{extension}"
    try:
        _client().put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType=CONTENT_TYPES.get(extension, "application/octet-stream"),
        )
    except ClientError as error:
        raise RuntimeError("No se pudo subir el archivo a R2") from error
    public_base = settings.R2_PUBLIC_BASE_URL.rstrip("/") if settings.R2_PUBLIC_BASE_URL else None
    if public_base:
        return {"filename": key, "url": f"{public_base}/{key}"}
    return {"filename": key, "url": f"/api/v1/storage/{key}"}
