# IndexTTS Server

Async TTS synthesis server based on [IndexTTS](https://github.com/index-tts/index-tts).

## Features

- Async task queue for handling multiple TTS requests
- REST API for submitting tasks and querying status
- Docker deployment with GPU support
- Voice cloning with reference audio
- Emotion control support

## Quick Start

### 1. Download Model

```bash
# Create checkpoints directory
mkdir -p checkpoints

# Download model using huggingface-cli
pip install huggingface_hub
huggingface-cli download IndexTeam/IndexTTS-2 --local-dir=checkpoints
```

### 2. Start Server

**With GPU (recommended):**

```bash
docker-compose up -d
```

**CPU only (slower):**

```bash
docker-compose -f docker-compose.cpu.yml up -d
```

### 3. Use the API

**Submit TTS task:**

```bash
curl -X POST http://localhost:8000/api/v1/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test."}'
```

**Query task status:**

```bash
curl http://localhost:8000/api/v1/tasks/{task_id}
```

**Download result:**

```bash
curl -O http://localhost:8000/api/v1/results/{task_id}.wav
```

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/tts` | Submit TTS task |
| GET | `/api/v1/tasks/{task_id}` | Get task status |
| GET | `/api/v1/results/{filename}` | Download result |
| DELETE | `/api/v1/tasks/{task_id}` | Delete task |

### TTS Request Body

```json
{
  "text": "Text to synthesize",
  "reference_audio": "/path/to/reference.wav",
  "emotion_prompt": "/path/to/emotion.wav",
  "emotion_text": "happy"
}
```

### Task Response

```json
{
  "task_id": "uuid",
  "status": "pending|processing|completed|failed",
  "created_at": "2024-01-01T00:00:00",
  "started_at": "2024-01-01T00:00:01",
  "completed_at": "2024-01-01T00:00:10",
  "error_message": null,
  "result_url": "/api/v1/results/uuid.wav",
  "progress": 100.0
}
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `MODEL_DIR` | `/app/checkpoints` | Model directory |
| `OUTPUT_DIR` | `/app/outputs` | Output directory |
| `MAX_QUEUE_SIZE` | `100` | Max pending tasks |
| `TASK_TIMEOUT` | `300` | Task timeout (seconds) |
| `DOWNLOAD_MODEL` | `false` | Auto-download model |

## Development

### Local Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --reload
```

### Build Docker Image

```bash
docker build -t indextts-server .
```

## License

This project uses IndexTTS which is under Bilibili license. Please check the original repository for license details.
