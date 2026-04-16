from fastapi import APIRouter

from app.routers.api_keys import router as api_keys_router
from app.routers.proxy import router as proxy_router
from app.routers.dashboard import router as dashboard_router
from app.routers.analysis import router as analysis_router
from app.routers.settings import router as settings_router

api_router = APIRouter()

api_router.include_router(api_keys_router, prefix="/api/v1/keys", tags=["api-keys"])
api_router.include_router(proxy_router, prefix="/v1", tags=["proxy"])
api_router.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["dashboard"])
api_router.include_router(analysis_router, prefix="/api/v1/analysis", tags=["analysis"])
api_router.include_router(settings_router, tags=["settings"])
