"""Configuration settings for TTS server."""

import os
from pathlib import Path


class Settings:
    """Server configuration settings."""

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    WORKERS: int = int(os.getenv("WORKERS", "1"))

    # Model settings
    MODEL_DIR: Path = Path(os.getenv("MODEL_DIR", "/app/checkpoints"))
    CONFIG_PATH: Path = MODEL_DIR / "config.yaml"

    # Storage settings
    OUTPUT_DIR: Path = Path(os.getenv("OUTPUT_DIR", "/app/outputs"))
    REFERENCE_DIR: Path = Path(os.getenv("REFERENCE_DIR", "/app/references"))

    # Task settings
    MAX_QUEUE_SIZE: int = int(os.getenv("MAX_QUEUE_SIZE", "100"))
    TASK_TIMEOUT: int = int(os.getenv("TASK_TIMEOUT", "300"))  # seconds
    CLEANUP_INTERVAL: int = int(os.getenv("CLEANUP_INTERVAL", "3600"))  # 1 hour
    RESULT_RETENTION: int = int(os.getenv("RESULT_RETENTION", "86400"))  # 24 hours

    # Default reference audio
    DEFAULT_REFERENCE: str = os.getenv("DEFAULT_REFERENCE", "examples/voice.wav")

    @classmethod
    def ensure_dirs(cls):
        """Ensure required directories exist."""
        cls.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        cls.REFERENCE_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
