from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import SyncLog, SyncLogPublic, SyncLogsPublic
from app.services.sync_services import sync_strava

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post(
    "/{provider}", response_model=SyncLogPublic, status_code=status.HTTP_202_ACCEPTED
)
def trigger_sync(
    provider: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> SyncLogPublic:
    if provider != "strava":
        raise HTTPException(status_code=400, detail="Proveedor de sync no soportado")

    started_at = datetime.now(UTC)
    sync_log = SyncLog(
        provider=provider,
        status="running",
        details={"message": "Sincronización en curso"},
        started_at=started_at,
        user_id=current_user.id,
    )
    session.add(sync_log)
    session.commit()
    session.refresh(sync_log)

    try:
        result = sync_strava(session, current_user)
    except Exception as error:  # noqa: BLE001
        session.rollback()
        stored_log = session.get(SyncLog, sync_log.id)
        if stored_log:
            stored_log.status = "failed"
            stored_log.completed_at = datetime.now(UTC)
            stored_log.details = {
                "message": f"Error de sincronización: {type(error).__name__}"
            }
            session.add(stored_log)
            session.commit()
            session.refresh(stored_log)
        raise HTTPException(
            status_code=500, detail="La sincronización falló"
        ) from error

    imported = int(str(result.get("imported", 0)))
    skipped = int(str(result.get("skipped", 0)))
    errors = int(str(result.get("errors", 0)))
    status_value = "success" if errors == 0 else "partial"
    sync_log.status = status_value
    sync_log.completed_at = datetime.now(UTC)
    sync_log.details = {
        "message": str(result.get("message", "")),
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }
    session.add(sync_log)
    session.commit()
    session.refresh(sync_log)
    return SyncLogPublic.model_validate(sync_log)


@router.get("/logs", response_model=SyncLogsPublic)
def read_sync_logs(
    session: SessionDep, current_user: CurrentUser, limit: int = 50
) -> SyncLogsPublic:
    count = session.exec(
        select(func.count())
        .select_from(SyncLog)
        .where(SyncLog.user_id == current_user.id)
    ).one()
    logs = session.exec(
        select(SyncLog)
        .where(SyncLog.user_id == current_user.id)
        .order_by(col(SyncLog.started_at).desc())
        .limit(limit)
    ).all()
    return SyncLogsPublic(
        data=[SyncLogPublic.model_validate(log) for log in logs], count=count
    )
