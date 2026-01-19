"""Main FastAPI application for TTS server."""

import io
import logging
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
import jwt
import torch
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.models import TTSRequest, HealthResponse
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global TTS engine
tts_engine = None

# Load JWT public key from environment variable
jwt_public_key = settings.JWT_PUBLIC_KEY if settings.JWT_PUBLIC_KEY else None
if jwt_public_key:
    logger.info("JWT authentication enabled")


def load_model():
    """Load the TTS model."""
    global tts_engine
    try:
        from indextts.infer_v2 import IndexTTS2
        tts_engine = IndexTTS2(
            cfg_path=str(settings.CONFIG_PATH),
            model_dir=str(settings.MODEL_DIR)
        )
        logger.info("TTS model loaded successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}")
        return False


def is_model_loaded() -> bool:
    """Check if model is loaded."""
    return tts_engine is not None


async def download_audio(url: str) -> str:
    """Download audio from URL to a temporary file.

    Returns the path to the temporary file.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()

        # Determine file extension from URL or content-type
        suffix = ".wav"
        if url.lower().endswith((".mp3", ".wav", ".flac", ".ogg")):
            suffix = Path(url).suffix.lower()

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_file:
            tmp_file.write(response.content)
            return tmp_file.name


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting TTS server...")

    # Load model
    logger.info("Loading TTS model...")
    if load_model():
        logger.info("TTS model loaded successfully")
    else:
        logger.warning("Failed to load TTS model - server running in degraded mode")

    yield

    # Shutdown
    logger.info("Shutting down TTS server...")


app = FastAPI(
    title="IndexTTS Server",
    description="Synchronous TTS synthesis server based on IndexTTS",
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


@app.middleware("http")
async def verify_jwt(request: Request, call_next):
    """Verify JWT token for protected endpoints."""
    # Skip auth for health check
    if request.url.path == "/health":
        return await call_next(request)

    # Skip auth if no public key configured
    if not jwt_public_key:
        return await call_next(request)

    # Get token from Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or invalid Authorization header"}
        )

    token = auth_header[7:]  # Remove "Bearer " prefix

    try:
        jwt.decode(
            token,
            jwt_public_key,
            algorithms=["RS256"],
            options={"require": ["exp"], "verify_exp": True}
        )
    except jwt.ExpiredSignatureError:
        return JSONResponse(
            status_code=401,
            content={"detail": "Token has expired"}
        )
    except jwt.InvalidTokenError as e:
        return JSONResponse(
            status_code=401,
            content={"detail": f"Invalid token: {str(e)}"}
        )

    return await call_next(request)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check server health status."""
    return HealthResponse(
        status="healthy",
        model_loaded=is_model_loaded(),
        gpu_available=torch.cuda.is_available()
    )


@app.post("/api/v1/tts", tags=["TTS"])
async def synthesize(request: TTSRequest):
    """
    Synthesize speech from text.

    Returns the generated audio as a WAV file.
    """
    if not is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="TTS model not loaded. Server is not ready."
        )

    logger.info(f"Synthesizing: {request.text[:50]}...")

    # Track temp files for cleanup
    temp_files = []

    try:
        # Download reference audio from URL or use default
        if request.reference_audio:
            reference_audio = await download_audio(request.reference_audio)
            temp_files.append(reference_audio)
        else:
            reference_audio = str(settings.MODEL_DIR / settings.DEFAULT_REFERENCE)

        # Download emotion prompt from URL if provided
        emotion_prompt_path = None
        if request.emotion_prompt:
            emotion_prompt_path = await download_audio(request.emotion_prompt)
            temp_files.append(emotion_prompt_path)

        # Create a temporary file for output
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            output_path = tmp_file.name
            temp_files.append(output_path)

        # Build inference kwargs
        kwargs = {
            "spk_audio_prompt": reference_audio,
            "text": request.text,
            "output_path": output_path
        }

        # Add optional emotion parameters
        if emotion_prompt_path:
            kwargs["emo_audio_prompt"] = emotion_prompt_path
        if request.emotion_vector is not None:
            kwargs["emo_vector"] = request.emotion_vector
        if request.emotion_alpha is not None:
            kwargs["emo_alpha"] = request.emotion_alpha
        if request.use_emotion_text is not None:
            kwargs["use_emo_text"] = request.use_emotion_text

        # Run inference
        tts_engine.infer(**kwargs)

        # Read the generated audio file
        with open(output_path, "rb") as f:
            audio_data = f.read()

        logger.info("Synthesis completed successfully")

        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=output.wav"}
        )

    except httpx.HTTPError as e:
        logger.error(f"Failed to download audio: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download audio from URL: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Synthesis failed: {str(e)}"
        )
    finally:
        # Clean up all temp files
        for temp_file in temp_files:
            Path(temp_file).unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=settings.WORKERS
    )
