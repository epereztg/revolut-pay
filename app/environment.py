"""Tracks whether the demo app is currently targeting Revolut's sandbox or production environment."""
import threading
from .config import Config

_lock = threading.Lock()
_state = {"mode": "sandbox"}


def get_mode() -> str:
    with _lock:
        return _state["mode"]


def has_keys_for(mode: str) -> bool:
    if mode == "prod":
        return bool(Config.PROD_PUBLIC_API_KEY and Config.PROD_PRIVATE_SECRET_KEY)
    return bool(Config.PUBLIC_API_KEY and Config.PRIVATE_SECRET_KEY)


def set_mode(mode: str) -> None:
    if mode not in ("sandbox", "prod"):
        raise ValueError(f"Invalid environment: {mode}")
    if not has_keys_for(mode):
        raise ValueError(f"Missing API keys for '{mode}' environment")
    with _lock:
        _state["mode"] = mode


def toggle_mode() -> str:
    set_mode("prod" if get_mode() == "sandbox" else "sandbox")
    return get_mode()


def get_public_key() -> str:
    return Config.PROD_PUBLIC_API_KEY if get_mode() == "prod" else Config.PUBLIC_API_KEY


def get_secret_key() -> str:
    return Config.PROD_PRIVATE_SECRET_KEY if get_mode() == "prod" else Config.PRIVATE_SECRET_KEY


def get_base_url() -> str:
    return Config.REVOLUT_PROD_BASE_URL if get_mode() == "prod" else Config.REVOLUT_SANDBOX_BASE_URL
