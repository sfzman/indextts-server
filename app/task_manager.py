"""Task manager for handling TTS synthesis tasks."""

import asyncio
import uuid
import logging
from datetime import datetime
from typing import Dict, Optional
from pathlib import Path

from app.models import TaskStatus, TaskInfo, TTSRequest
from app.config import settings

logger = logging.getLogger(__name__)


class TaskManager:
    """Manages TTS synthesis tasks with async queue processing."""

    def __init__(self):
        self.tasks: Dict[str, TaskInfo] = {}
        self.task_requests: Dict[str, TTSRequest] = {}
        self.queue: asyncio.Queue = None
        self.tts_engine = None
        self._worker_task: Optional[asyncio.Task] = None
        self._running = False

    async def initialize(self):
        """Initialize the task manager and start worker."""
        settings.ensure_dirs()
        self.queue = asyncio.Queue(maxsize=settings.MAX_QUEUE_SIZE)
        self._running = True
        self._worker_task = asyncio.create_task(self._process_queue())
        logger.info("Task manager initialized")

    async def shutdown(self):
        """Shutdown the task manager."""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Task manager shutdown complete")

    def load_model(self):
        """Load the TTS model."""
        try:
            from indextts.infer_v2 import IndexTTS2
            self.tts_engine = IndexTTS2(
                cfg_path=str(settings.CONFIG_PATH),
                model_dir=str(settings.MODEL_DIR)
            )
            logger.info("TTS model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load TTS model: {e}")
            return False

    def is_model_loaded(self) -> bool:
        """Check if model is loaded."""
        return self.tts_engine is not None

    async def submit_task(self, request: TTSRequest) -> str:
        """Submit a new TTS task."""
        task_id = str(uuid.uuid4())

        task_info = TaskInfo(
            task_id=task_id,
            status=TaskStatus.PENDING,
            created_at=datetime.utcnow(),
            progress=0.0
        )

        self.tasks[task_id] = task_info
        self.task_requests[task_id] = request

        await self.queue.put(task_id)
        logger.info(f"Task {task_id} submitted to queue")

        return task_id

    def get_task(self, task_id: str) -> Optional[TaskInfo]:
        """Get task information by ID."""
        return self.tasks.get(task_id)

    def get_pending_count(self) -> int:
        """Get number of pending tasks."""
        return sum(
            1 for t in self.tasks.values()
            if t.status in (TaskStatus.PENDING, TaskStatus.PROCESSING)
        )

    async def _process_queue(self):
        """Worker coroutine to process tasks from queue."""
        while self._running:
            try:
                task_id = await asyncio.wait_for(
                    self.queue.get(),
                    timeout=1.0
                )
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            try:
                await self._process_task(task_id)
            except Exception as e:
                logger.error(f"Error processing task {task_id}: {e}")
                if task_id in self.tasks:
                    self.tasks[task_id].status = TaskStatus.FAILED
                    self.tasks[task_id].error_message = str(e)
                    self.tasks[task_id].completed_at = datetime.utcnow()
            finally:
                self.queue.task_done()

    async def _process_task(self, task_id: str):
        """Process a single TTS task."""
        task_info = self.tasks.get(task_id)
        request = self.task_requests.get(task_id)

        if not task_info or not request:
            logger.error(f"Task {task_id} not found")
            return

        task_info.status = TaskStatus.PROCESSING
        task_info.started_at = datetime.utcnow()
        task_info.progress = 10.0

        logger.info(f"Processing task {task_id}: {request.text[:50]}...")

        if not self.tts_engine:
            raise RuntimeError("TTS model not loaded")

        # Determine reference audio
        reference_audio = request.reference_audio
        if not reference_audio:
            reference_audio = str(settings.MODEL_DIR / settings.DEFAULT_REFERENCE)

        # Output path
        output_filename = f"{task_id}.wav"
        output_path = settings.OUTPUT_DIR / output_filename

        task_info.progress = 30.0

        # Run inference in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._run_inference,
            request,
            reference_audio,
            str(output_path)
        )

        task_info.progress = 100.0
        task_info.status = TaskStatus.COMPLETED
        task_info.completed_at = datetime.utcnow()
        task_info.result_url = f"/api/v1/results/{output_filename}"

        logger.info(f"Task {task_id} completed successfully")

    def _run_inference(self, request: TTSRequest, reference_audio: str, output_path: str):
        """Run TTS inference (blocking, called from thread pool)."""
        kwargs = {
            "spk_audio_prompt": reference_audio,
            "text": request.text,
            "output_path": output_path
        }

        # Add optional emotion parameters
        if request.emotion_prompt:
            kwargs["emo_audio_prompt"] = request.emotion_prompt
        if request.emotion_text:
            kwargs["emo_text"] = request.emotion_text
        if request.emotion_vector is not None:
            kwargs["emo_vector"] = request.emotion_vector
        if request.emotion_alpha is not None:
            kwargs["emo_alpha"] = request.emotion_alpha
        if request.use_emotion_text is not None:
            kwargs["use_emo_text"] = request.use_emotion_text

        self.tts_engine.infer(**kwargs)


# Global task manager instance
task_manager = TaskManager()
