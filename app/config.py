"""Configuration loaded from environment variables."""
import os


class Config:
    PUBLIC_API_KEY: str = os.environ.get("PUBLIC_API_KEY", "")
    PRIVATE_SECRET_KEY: str = os.environ.get("PRIVATE_SECRET_KEY", "")
    FLASK_SECRET_KEY: str = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key")
    REVOLUT_SANDBOX_BASE_URL: str = "https://sandbox-merchant.revolut.com/api/1.0"
