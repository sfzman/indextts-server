# IndexTTS Server

Async TTS synthesis server based on [IndexTTS](https://github.com/index-tts/index-tts).

## Features

- Async task queue for handling multiple TTS requests
- REST API for submitting tasks and querying status
- Docker deployment with GPU support
- Voice cloning with reference audio
- Emotion control support (audio, text, and vector-based)

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
  "emotion_text": "happy",
  "emotion_vector": [0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2],
  "emotion_alpha": 1.0,
  "use_emotion_text": false
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | **Required.** Text to synthesize (1-5000 chars) |
| `reference_audio` | string | Path to reference audio for voice cloning |
| `emotion_prompt` | string | Path to emotion reference audio |
| `emotion_text` | string | Emotion description (e.g., "happy", "sad") |
| `emotion_vector` | float[8] | Direct emotion control vector (see below) |
| `emotion_alpha` | float | Emotion strength (0.0-2.0, default 1.0) |
| `use_emotion_text` | bool | Auto-detect emotion from synthesis text |

### Emotion Control Methods

IndexTTS2 supports multiple emotion control methods:

1. **Emotion Audio** (`emotion_prompt`): Use a reference audio to transfer emotion
2. **Emotion Text** (`emotion_text`): Describe the emotion in text (e.g., "angry", "excited")
3. **Emotion Vector** (`emotion_vector`): Direct 8-dimensional vector control
4. **Auto-detect** (`use_emotion_text`): Automatically detect emotion from the synthesis text

### Emotion Vector Format

The `emotion_vector` is an 8-dimensional array where each value (0.0-1.0) represents emotion intensity:

| Index | Emotion (EN) | Emotion (中文) |
|-------|-------------|----------------|
| 0 | Happy | 高兴 |
| 1 | Angry | 愤怒 |
| 2 | Sad | 悲伤 |
| 3 | Afraid | 恐惧 |
| 4 | Disgusted | 反感 |
| 5 | Melancholic | 低落 |
| 6 | Surprised | 惊讶 |
| 7 | Calm | 平静/自然 |

**Example vectors:**

```json
// Happy speech
{"emotion_vector": [0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2]}

// Angry speech
{"emotion_vector": [0.0, 0.9, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0]}

// Sad and melancholic
{"emotion_vector": [0.0, 0.0, 0.6, 0.0, 0.0, 0.4, 0.0, 0.0]}

// Calm/neutral (recommended for natural speech)
{"emotion_vector": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0]}
```

**Tips:**
- Use `emotion_alpha` around 0.6 when using text-based emotion for more natural results
- Multiple emotion values can be combined for complex emotional expressions

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
