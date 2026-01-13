"""Data models for TTS server."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class TaskStatus(str, Enum):
    """Task status enum."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TTSRequest(BaseModel):
    """Request model for TTS synthesis."""
    text: str = Field(..., description="Text to synthesize", min_length=1, max_length=5000)
    reference_audio: Optional[str] = Field(
        None,
        description="Path or URL to reference audio for voice cloning"
    )
    emotion_prompt: Optional[str] = Field(
        None,
        description="Emotion audio prompt path for emotional control"
    )
    emotion_text: Optional[str] = Field(
        None,
        description="Text description of desired emotion"
    )


class TaskInfo(BaseModel):
    """Task information model."""
    task_id: str = Field(..., description="Unique task identifier")
    status: TaskStatus = Field(..., description="Current task status")
    created_at: datetime = Field(..., description="Task creation timestamp")
    started_at: Optional[datetime] = Field(None, description="Processing start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    result_url: Optional[str] = Field(None, description="URL to download result audio")
    progress: float = Field(0.0, description="Progress percentage (0-100)")


class TTSResponse(BaseModel):
    """Response model for task submission."""
    task_id: str = Field(..., description="Task ID for tracking")
    message: str = Field(..., description="Response message")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model_loaded: bool
    gpu_available: bool
    pending_tasks: int
