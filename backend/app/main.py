"""Main FastAPI application for TTS server."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    TTSRequest,
    TTSResponse,
    TaskInfo,
    HealthResponse,
    TaskStatus
)
from app.task_manager import task_manager
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting TTS server...")
    await task_manager.initialize()

    # Load model
    logger.info("Loading TTS model...")
    if task_manager.load_model():
        logger.info("TTS model loaded successfully")
    else:
        logger.warning("Failed to load TTS model - server running in degraded mode")

    yield

    # Shutdown
    logger.info("Shutting down TTS server...")
    await task_manager.shutdown()


app = FastAPI(
    title="IndexTTS Server",
    description="Async TTS synthesis server based on IndexTTS",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check server health status."""
    return HealthResponse(
        status="healthy",
        model_loaded=task_manager.is_model_loaded(),
        gpu_available=torch.cuda.is_available(),
        pending_tasks=task_manager.get_pending_count()
    )


@app.post("/api/v1/tts", response_model=TTSResponse, tags=["TTS"])
async def submit_tts_task(request: TTSRequest):
    """
    Submit a new TTS synthesis task.

    The task will be processed asynchronously. Use the returned task_id
    to query the status and retrieve results.
    """
    if not task_manager.is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="TTS model not loaded. Server is not ready."
        )

    if task_manager.get_pending_count() >= settings.MAX_QUEUE_SIZE:
        raise HTTPException(
            status_code=429,
            detail="Task queue is full. Please try again later."
        )

    task_id = await task_manager.submit_task(request)

    return TTSResponse(
        task_id=task_id,
        message="Task submitted successfully"
    )


@app.get("/api/v1/tasks/{task_id}", response_model=TaskInfo, tags=["TTS"])
async def get_task_status(task_id: str):
    """
    Get the status of a TTS task.

    Returns task information including status, progress, and result URL when completed.
    """
    task_info = task_manager.get_task(task_id)

    if not task_info:
        raise HTTPException(
            status_code=404,
            detail=f"Task {task_id} not found"
        )

    return task_info


@app.get("/api/v1/results/{filename}", tags=["TTS"])
async def download_result(filename: str):
    """
    Download the synthesized audio file.

    Only available after task is completed.
    """
    file_path = settings.OUTPUT_DIR / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Result file not found"
        )

    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        filename=filename
    )


@app.delete("/api/v1/tasks/{task_id}", tags=["TTS"])
async def delete_task(task_id: str):
    """
    Delete a task and its associated result file.
    """
    task_info = task_manager.get_task(task_id)

    if not task_info:
        raise HTTPException(
            status_code=404,
            detail=f"Task {task_id} not found"
        )

    # Delete result file if exists
    result_file = settings.OUTPUT_DIR / f"{task_id}.wav"
    if result_file.exists():
        result_file.unlink()

    # Remove from task manager
    del task_manager.tasks[task_id]
    if task_id in task_manager.task_requests:
        del task_manager.task_requests[task_id]

    return {"message": f"Task {task_id} deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS
    )
