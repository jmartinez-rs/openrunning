"""Sincronización programada con APScheduler.

Revisa periódicamente los SyncSchedule habilitados y ejecuta la
sincronización de Strava cuando el intervalo ha vencido.
"""

import logging
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.background import (  # type: ignore[import-untyped]
    BackgroundScheduler,
)
from apscheduler.triggers.interval import (  # type: ignore[import-untyped]
    IntervalTrigger,
)
from sqlmodel import Session, select

from app.core.db import engine
from app.models import SyncLog, SyncSchedule, User
from app.services.sync_services import sync_strava

logger = logging.getLogger(__name__)

CHECK_INTERVAL_MINUTES = 30
MAX_SYNC_DURATION_MINUTES = 15


def _run_sync_for_schedule(schedule: SyncSchedule) -> None:
    """Ejecuta el sync de Strava si el intervalo ha vencido."""
    now = datetime.now(UTC)
    if schedule.last_run_at:
        last_run = schedule.last_run_at
        if last_run.tzinfo is None:
            last_run = last_run.replace(tzinfo=UTC)
        if now - last_run < timedelta(hours=schedule.interval_hours):
            return

    with Session(engine) as session:
        user = session.get(User, schedule.user_id)
        if not user:
            return

        sync_log = SyncLog(
            provider=schedule.provider,
            status="running",
            details={"message": "Sincronización automática en curso"},
            started_at=now,
            user_id=schedule.user_id,
        )
        session.add(sync_log)
        session.commit()
        session.refresh(sync_log)

        try:
            result = sync_strava(session, user)
            errors = int(str(result.get("errors", 0)))
            sync_log.status = "success" if errors == 0 else "partial"
            sync_log.details = {
                "message": str(result.get("message", "")),
                "imported": int(str(result.get("imported", 0))),
                "skipped": int(str(result.get("skipped", 0))),
                "errors": errors,
            }
        except Exception as error:  # noqa: BLE001
            logger.exception("Sync automático falló para %s", schedule.provider)
            sync_log.status = "failed"
            sync_log.details = {
                "message": f"Error de sincronización: {type(error).__name__}"
            }
        sync_log.completed_at = datetime.now(UTC)
        session.add(sync_log)

        refreshed = session.get(SyncSchedule, schedule.id)
        if refreshed:
            refreshed.last_run_at = datetime.now(UTC)
            session.add(refreshed)
        session.commit()


def run_due_syncs() -> None:
    """Revisa todos los schedules habilitados y ejecuta los vencidos."""
    with Session(engine) as session:
        schedules = session.exec(
            select(SyncSchedule).where(SyncSchedule.enabled == True)  # noqa: E712
        ).all()
    for schedule in schedules:
        try:
            _run_sync_for_schedule(schedule)
        except Exception:  # noqa: BLE001
            logger.exception("Fallo al procesar schedule %s", schedule.provider)


scheduler: BackgroundScheduler | None = None


def start_scheduler() -> None:
    """Inicia el scheduler global de sincronización."""
    global scheduler
    if scheduler is not None:
        return
    background = BackgroundScheduler(timezone=UTC)
    background.add_job(
        run_due_syncs,
        trigger=IntervalTrigger(minutes=CHECK_INTERVAL_MINUTES),
        id="sync_due",
        replace_existing=True,
    )
    background.start()
    scheduler = background
    logger.info("Scheduler de sincronización iniciado (cada %s min)", CHECK_INTERVAL_MINUTES)


def stop_scheduler() -> None:
    """Detiene el scheduler global."""
    global scheduler
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        scheduler = None
