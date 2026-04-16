import json
import os
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

SETTINGS_FILE = Path(__file__).parent.parent.parent / "settings.json"

DEFAULT_SETTINGS = {
    "analysis_enabled": True,
    "detector_full_context": True,
    "detector_sliding_window": True,
    "detector_summarization": True,
    "proxy_timeout": 120,
    "dashboard_refresh_interval": 30,
    "log_level": "INFO",
}


def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r") as f:
            saved = json.load(f)
        return {**DEFAULT_SETTINGS, **saved}
    return {**DEFAULT_SETTINGS}


def save_settings(settings: dict):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)


class SettingsUpdate(BaseModel):
    analysis_enabled: Optional[bool] = None
    detector_full_context: Optional[bool] = None
    detector_sliding_window: Optional[bool] = None
    detector_summarization: Optional[bool] = None
    proxy_timeout: Optional[int] = None
    dashboard_refresh_interval: Optional[int] = None
    log_level: Optional[str] = None


@router.get("")
async def get_settings():
    return load_settings()


@router.put("")
async def update_settings(body: SettingsUpdate):
    current = load_settings()
    updates = body.model_dump(exclude_none=True)
    current.update(updates)
    save_settings(current)
    return current
