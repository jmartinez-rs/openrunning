import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser
from app.core.config import settings

router = APIRouter(prefix="/storage", tags=["storage"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(current_user: CurrentUser, file: UploadFile) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="A filename is required")
    data = await file.read()

    if settings.STORAGE_PROVIDER == "r2":
        from app.services import storage_r2

        try:
            return storage_r2.upload_file(data, file.filename)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=501, detail=str(error)) from error

    extension = Path(file.filename).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    storage_path = Path(settings.STORAGE_LOCAL_PATH)
    storage_path.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.id}-{uuid.uuid4()}{extension}"
    destination = storage_path / filename
    destination.write_bytes(data)
    return {"filename": filename, "url": f"/api/v1/storage/{filename}"}


@router.get("/{filename}")
def read_file(filename: str) -> FileResponse:
    path = Path(settings.STORAGE_LOCAL_PATH) / Path(filename).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)
