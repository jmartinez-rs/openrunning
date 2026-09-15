from fastapi import APIRouter, HTTPException, Query, status

from app.core.config import settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/strava")
def verify_strava_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_challenge: str = Query(alias="hub.challenge"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
) -> dict[str, str]:
    if (
        hub_mode != "subscribe"
        or hub_verify_token != settings.STRAVA_WEBHOOK_VERIFY_TOKEN
    ):
        raise HTTPException(status_code=403, detail="Invalid webhook verification")
    return {"hub.challenge": hub_challenge}


@router.post("/strava", status_code=status.HTTP_202_ACCEPTED)
def receive_strava_webhook(payload: dict[str, object]) -> dict[str, str]:
    if not payload:
        raise HTTPException(status_code=400, detail="Webhook payload is required")
    return {"message": "Webhook accepted; processing will be enabled in phase 3"}
