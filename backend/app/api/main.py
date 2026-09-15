from fastapi import APIRouter

from app.api.routes import (
    activities,
    analytics,
    auth,
    login,
    private,
    races,
    running_plans,
    shoes,
    storage,
    sync,
    users,
    utils,
    webhooks,
)
from app.api.routes import (
    settings as settings_routes,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(analytics.router)
api_router.include_router(auth.router)
api_router.include_router(activities.router)
api_router.include_router(races.router)
api_router.include_router(running_plans.router)
api_router.include_router(shoes.router)
api_router.include_router(settings_routes.router)
api_router.include_router(sync.router)
api_router.include_router(storage.router)
api_router.include_router(webhooks.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
