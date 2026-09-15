import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from sqlmodel import col, select

from app.api.deps import CurrentUser, SessionDep
from app.core.encryption import decrypt_secret, encrypt_secret
from app.models import (
    AuthToken,
    ConnectionStatus,
    IntegrationStatus,
    IntegrationTestResult,
    SettingsPublic,
    StravaCredentialsIn,
    SyncSchedule,
    SyncSchedulePublic,
    SyncScheduleUpdate,
    WeeklyGoal,
    WeeklyGoalBase,
    WeeklyGoalPublic,
)

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_integration(
    session: SessionDep, user_id: uuid.UUID, provider: str
) -> AuthToken | None:
    return session.exec(
        select(AuthToken).where(
            AuthToken.user_id == user_id, AuthToken.provider == provider
        )
    ).first()


def _set_integration(
    session: SessionDep,
    user_id: uuid.UUID,
    provider: str,
    access_token: str,
    refresh_token: str | None = None,
    expires_at: datetime | None = None,
    metadata: dict[str, object] | None = None,
) -> AuthToken:
    token = _get_integration(session, user_id, provider)
    encrypted_access = encrypt_secret(access_token)
    encrypted_refresh = encrypt_secret(refresh_token) if refresh_token else None
    encrypted_metadata: dict[str, object] = {
        key: encrypt_secret(str(value)) for key, value in (metadata or {}).items()
    }
    if token:
        token.access_token = encrypted_access
        token.refresh_token = encrypted_refresh
        token.expires_at = expires_at
        token.metadata_json = encrypted_metadata
    else:
        token = AuthToken(
            user_id=user_id,
            provider=provider,
            access_token=encrypted_access,
            refresh_token=encrypted_refresh,
            expires_at=expires_at,
            metadata_json=encrypted_metadata,
        )
    session.add(token)
    session.commit()
    session.refresh(token)
    return token


@router.get("/", response_model=SettingsPublic)
def read_settings(session: SessionDep, current_user: CurrentUser) -> SettingsPublic:
    tokens = session.exec(
        select(AuthToken).where(AuthToken.user_id == current_user.id)
    ).all()
    latest_goal = session.exec(
        select(WeeklyGoal)
        .where(WeeklyGoal.user_id == current_user.id)
        .order_by(col(WeeklyGoal.created_at).desc())
    ).first()
    return SettingsPublic(
        connections=[
            ConnectionStatus(
                provider=token.provider,
                connected=True,
                expires_at=token.expires_at,
            )
            for token in tokens
        ],
        goals=WeeklyGoalPublic.model_validate(latest_goal) if latest_goal else None,
    )


@router.get("/goals", response_model=WeeklyGoalPublic | None)
def read_goals(
    session: SessionDep, current_user: CurrentUser
) -> WeeklyGoalPublic | None:
    goal = session.exec(
        select(WeeklyGoal)
        .where(WeeklyGoal.user_id == current_user.id)
        .order_by(col(WeeklyGoal.created_at).desc())
    ).first()
    return WeeklyGoalPublic.model_validate(goal) if goal else None


@router.put("/goals", response_model=WeeklyGoalPublic)
def update_goals(
    session: SessionDep, current_user: CurrentUser, goal_in: WeeklyGoalBase
) -> WeeklyGoalPublic:
    goal = session.exec(
        select(WeeklyGoal).where(WeeklyGoal.user_id == current_user.id)
    ).first()
    if goal:
        goal.sqlmodel_update(
            goal_in.model_dump(exclude={"id", "user_id", "created_at"})
        )
    else:
        goal = WeeklyGoal.model_validate(goal_in, update={"user_id": current_user.id})
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return WeeklyGoalPublic.model_validate(goal)


@router.put("/integrations/strava", response_model=IntegrationStatus)
def save_strava_credentials(
    session: SessionDep,
    current_user: CurrentUser,
    credentials: StravaCredentialsIn,
) -> IntegrationStatus:
    values = credentials.model_dump(exclude_unset=True)
    access_token = values.get("access_token") or ""
    refresh_token = values.get("refresh_token")
    expires_at = values.get("expires_at")
    metadata: dict[str, object] = {}
    if values.get("client_id"):
        metadata["client_id"] = str(values["client_id"])
    if values.get("client_secret"):
        metadata["client_secret"] = str(values["client_secret"])
    if not access_token and not refresh_token and not metadata:
        raise HTTPException(
            status_code=400,
            detail="Se requiere al menos un token o las credenciales de la app",
        )
    _set_integration(
        session,
        current_user.id,
        "strava",
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        metadata=metadata,
    )
    return IntegrationStatus(provider="strava", connected=True)


@router.get("/integrations/{provider}", response_model=IntegrationStatus)
def read_integration_status(
    session: SessionDep, current_user: CurrentUser, provider: str
) -> IntegrationStatus:
    if provider != "strava":
        raise HTTPException(status_code=400, detail="Proveedor no soportado")
    token = _get_integration(session, current_user.id, provider)
    if not token:
        return IntegrationStatus(provider=provider, connected=False)
    return IntegrationStatus(
        provider=provider,
        connected=True,
        message="Credenciales guardadas",
    )


@router.post("/integrations/{provider}/test", response_model=IntegrationTestResult)
def test_integration(
    session: SessionDep, current_user: CurrentUser, provider: str
) -> IntegrationTestResult:
    if provider != "strava":
        raise HTTPException(status_code=400, detail="Proveedor no soportado")
    token = _get_integration(session, current_user.id, provider)
    if not token or not token.access_token:
        raise HTTPException(
            status_code=400,
            detail=f"No hay credenciales guardadas para {provider}",
        )

    try:
        from app.services.integrations import (
            refresh_strava_token,
            test_strava_athlete,
        )

        access_token = decrypt_secret(token.access_token)
        success, message = test_strava_athlete(access_token)
        if not success and token.refresh_token and token.metadata_json:
            metadata: dict[str, object] = {
                key: decrypt_secret(str(value))
                for key, value in token.metadata_json.items()
            }
            client_id = str(metadata.get("client_id", ""))
            client_secret = str(metadata.get("client_secret", ""))
            if client_id and client_secret and token.refresh_token:
                refresh_result = refresh_strava_token(
                    client_id, client_secret, decrypt_secret(token.refresh_token)
                )
                if refresh_result:
                    new_access = str(refresh_result.get("access_token", ""))
                    new_refresh = str(refresh_result.get("refresh_token", ""))
                    new_expires = None
                    if refresh_result.get("expires_at"):
                        new_expires = datetime.fromtimestamp(
                            int(str(refresh_result["expires_at"])), tz=UTC
                        )
                    _set_integration(
                        session,
                        current_user.id,
                        "strava",
                        access_token=new_access,
                        refresh_token=new_refresh,
                        expires_at=new_expires,
                        metadata=metadata,
                    )
                    success, message = test_strava_athlete(new_access)
                else:
                    success, message = False, "El refresh de Strava falló"
        return IntegrationTestResult(
            provider="strava", success=success, message=message
        )
    except ValueError as error:
        return IntegrationTestResult(
            provider="strava",
            success=False,
            message=str(error),
        )


@router.delete("/integrations/{provider}", response_model=IntegrationStatus)
def disconnect_integration(
    session: SessionDep, current_user: CurrentUser, provider: str
) -> IntegrationStatus:
    if provider != "strava":
        raise HTTPException(status_code=400, detail="Proveedor no soportado")
    token = _get_integration(session, current_user.id, provider)
    if token:
        _revoke_strava_token(token)
        session.delete(token)
        session.commit()
    return IntegrationStatus(provider=provider, connected=False)


@router.get("/sync-schedule", response_model=list[SyncSchedulePublic])
def read_sync_schedule(
    session: SessionDep, current_user: CurrentUser
) -> list[SyncSchedulePublic]:
    schedules = session.exec(
        select(SyncSchedule).where(SyncSchedule.user_id == current_user.id)
    ).all()
    by_provider = {schedule.provider: schedule for schedule in schedules}
    result: list[SyncSchedulePublic] = []
    schedule = by_provider.get("strava")
    if schedule:
        result.append(SyncSchedulePublic.model_validate(schedule))
    else:
        result.append(
            SyncSchedulePublic(
                id=uuid.uuid4(),
                provider="strava",
                enabled=True,
                interval_hours=24,
                user_id=current_user.id,
                last_run_at=None,
            )
        )
    return result


@router.put("/sync-schedule/{provider}", response_model=SyncSchedulePublic)
def update_sync_schedule(
    session: SessionDep,
    current_user: CurrentUser,
    provider: str,
    schedule_in: SyncScheduleUpdate,
) -> SyncSchedulePublic:
    if provider != "strava":
        raise HTTPException(status_code=400, detail="Proveedor no soportado")
    schedule = session.exec(
        select(SyncSchedule).where(
            SyncSchedule.user_id == current_user.id,
            SyncSchedule.provider == provider,
        )
    ).first()
    if schedule:
        schedule.sqlmodel_update(schedule_in.model_dump(exclude_unset=True))
    else:
        schedule = SyncSchedule.model_validate(
            schedule_in.model_dump(exclude_unset=True),
            update={"user_id": current_user.id, "provider": provider},
        )
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return SyncSchedulePublic.model_validate(schedule)


def _revoke_strava_token(token: AuthToken) -> None:
    """Revoca el access token de Strava en el servidor antes de borrarlo."""
    import httpx

    try:
        access = decrypt_secret(token.access_token)
        if not access:
            return
        with httpx.Client(timeout=10) as client:
            client.post(
                "https://www.strava.com/oauth/deauthorize",
                data={"access_token": access},
            )
    except (httpx.RequestError, ValueError):
        # La revocación es best-effort: el borrado local igual se completa.
        pass
