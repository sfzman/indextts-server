# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IndexTTS Server is a synchronous TTS (Text-to-Speech) synthesis REST API server based on IndexTTS-2. It wraps the IndexTTS library in a FastAPI server with JWT authentication support, emotion control, and voice cloning capabilities.

## Build & Run Commands

### Local Development Setup

```bash
# Install uv (fast Python package manager)
pip install uv

# Create virtual environment
uv venv .venv
source .venv/bin/activate

# Install the indextts package (required - it's a local package)
uv pip install -e ./indextts

# Install server dependencies
uv pip install -r requirements.txt

# Download model (~5GB)
huggingface-cli download IndexTeam/IndexTTS-2 --local-dir=checkpoints
```

### Running the Server

```bash
# Development with auto-reload
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

### Docker Commands

```bash
make build        # Build Docker image
make run          # Start with GPU
make run-cpu      # Start CPU-only
make stop         # Stop server
make logs         # View logs
make test         # Test TTS endpoint
```

## Architecture

### Server Layer (`app/`)

- `main.py` - FastAPI application with lifespan management, JWT middleware, and TTS endpoint
- `config.py` - Settings loaded from environment variables via python-dotenv
- `models.py` - Pydantic request/response models (TTSRequest, HealthResponse)

The server loads the TTS model at startup via `lifespan()` and exposes two endpoints:
- `GET /health` - Health check (no auth required)
- `POST /api/v1/tts` - Synthesize speech (returns WAV audio)

### IndexTTS Library (`indextts/`)

A local Python package containing the IndexTTS-2 model implementation. Key entry point:

- `indextts/infer_v2.py:IndexTTS2` - Main inference class used by the server

The `IndexTTS2` class handles:
- Multi-device support (CUDA, XPU, MPS, CPU)
- Model loading (GPT, semantic codec, s2mel, BigVGAN vocoder)
- Reference audio caching for performance
- Emotion control via audio prompts, vectors, or text-based detection (QwenEmotion)

### Request Flow

1. Client POSTs to `/api/v1/tts` with text and optional reference audio URLs
2. Server downloads reference audio files to temp files if URLs provided
3. `tts_engine.infer()` generates speech with emotion parameters
4. Server returns WAV audio as streaming response
5. Temp files are cleaned up

## Key Configuration

Environment variables (set in `.env` or container):

- `MODEL_DIR` - Path to checkpoints directory (default: `/app/checkpoints`)
- `DEFAULT_REFERENCE` - Default voice reference audio path
- `JWT_PUBLIC_KEY` - RSA public key for JWT auth (empty = auth disabled)
- `JWT_MAX_AGE` - Token expiry in seconds (default: 10)

## Emotion System

IndexTTS-2 supports 8-dimensional emotion vectors:
`[happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]`

Three control methods:
1. `emotion_prompt` - URL to emotion reference audio
2. `emotion_vector` - Direct 8-element float array (0.0-1.0 each)
3. `use_emotion_text` - Auto-detect from synthesis text via QwenEmotion model
