"""Configuration settings for TTS server."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env file if it exists
env_path = Path(__file__).parent.parent / ".env"
loaded = load_dotenv(env_path)
print(f"[DEBUG] .env path: {env_path}")
print(f"[DEBUG] .env exists: {env_path.exists()}")
print(f"[DEBUG] .env loaded: {loaded}")
print(f"[DEBUG] MODEL_DIR from env: {os.getenv('MODEL_DIR')}")


class Settings:
    """Server configuration settings."""

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    WORKERS: int = int(os.getenv("WORKERS", "1"))

    # Model settings
    MODEL_DIR: Path = Path(os.getenv("MODEL_DIR", "/app/checkpoints"))
    CONFIG_PATH: Path = MODEL_DIR / "config.yaml"

    # Default reference audio
    DEFAULT_REFERENCE: str = os.getenv("DEFAULT_REFERENCE", "examples/voice.wav")

    # JWT authentication settings
    JWT_PUBLIC_KEY: str = os.getenv("JWT_PUBLIC_KEY", "").replace("\\n", "\n")
    JWT_MAX_AGE: int = int(os.getenv("JWT_MAX_AGE", "10"))  # seconds


settings = Settings()
