# IndexTTS Server

Synchronous TTS synthesis server based on [IndexTTS](https://github.com/index-tts/index-tts).

## Features

- Simple synchronous REST API for TTS synthesis
- JWT RS256 authentication support
- Docker deployment with GPU support
- Voice cloning with reference audio
- Emotion control support (audio and vector-based)

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

```bash
curl -X POST http://localhost:8000/api/v1/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test."}' \
  --output output.wav
```

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/tts` | Synthesize speech (returns WAV audio) |

### TTS Request Body

```json
{
  "text": "Text to synthesize",
  "reference_audio": "https://example.com/voice.wav",
  "emotion_prompt": "https://example.com/emotion.wav",
  "emotion_vector": [0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2],
  "emotion_alpha": 1.0,
  "use_emotion_text": false
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | **Required.** Text to synthesize (1-5000 chars) |
| `reference_audio` | string | URL to reference audio for voice cloning (WAV recommended) |
| `emotion_prompt` | string | URL to emotion reference audio (WAV recommended) |
| `emotion_vector` | float[8] | Direct emotion control vector (see below) |
| `emotion_alpha` | float | Emotion strength (0.0-2.0, default 1.0) |
| `use_emotion_text` | bool | Auto-detect emotion from synthesis text |

### TTS Response

The API returns the synthesized audio directly as a WAV file (`audio/wav`).

### Emotion Control Methods

IndexTTS2 supports multiple emotion control methods:

1. **Emotion Audio** (`emotion_prompt`): Use a reference audio to transfer emotion
2. **Emotion Vector** (`emotion_vector`): Direct 8-dimensional vector control
3. **Auto-detect** (`use_emotion_text`): Automatically detect emotion from the synthesis text

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
- Multiple emotion values can be combined for complex emotional expressions

## Authentication

The server supports JWT RS256 authentication. When enabled, all requests (except `/health`) require a valid JWT token.

### Setup

1. Generate RSA key pair:

```bash
# Generate private key (keep this secret, used by client)
openssl genrsa -out private_key.pem 2048

# Extract public key (used by server)
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

2. Configure server with public key via environment variable:

```bash
# Read public key and set as environment variable (replace newlines with \n)
export JWT_PUBLIC_KEY=$(cat public_key.pem | sed ':a;N;$!ba;s/\n/\\n/g')
export JWT_MAX_AGE=10  # Token validity in seconds (default: 10)
```

**Docker deployment:**
```bash
docker run -d \
  -p 8000:8000 \
  -v /path/to/checkpoints:/app/checkpoints \
  -e JWT_PUBLIC_KEY="$(cat public_key.pem | sed ':a;N;$!ba;s/\n/\\n/g')" \
  indextts-server
```

Or in `docker-compose.yml`:
```yaml
services:
  indextts:
    image: indextts-server
    ports:
      - "8000:8000"
    volumes:
      - ./checkpoints:/app/checkpoints
    environment:
      - JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIBI...(your key)...\n-----END PUBLIC KEY-----
```

3. Client generates JWT token with private key:

```python
import jwt
import time

private_key = open("private_key.pem").read()

token = jwt.encode(
    {"exp": int(time.time()) + 10},  # Expires in 10 seconds
    private_key,
    algorithm="RS256"
)
print(token)
```

4. Call API with token:

```bash
curl -X POST http://localhost:8000/api/v1/tts \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test."}' \
  --output output.wav
```

**Note:** If `JWT_PUBLIC_KEY` is not set, authentication is disabled.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `WORKERS` | `1` | Number of workers |
| `MODEL_DIR` | `/app/checkpoints` | Model directory |
| `DEFAULT_REFERENCE` | `examples/voice.wav` | Default reference audio |
| `JWT_PUBLIC_KEY` | `` | RSA public key content (use `\n` for newlines, empty = auth disabled) |
| `JWT_MAX_AGE` | `10` | Max token age in seconds |

## Development

### Local Setup

```bash
# Install the indextts package (required)
pip install -e ./indextts

# Install other dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --reload
```

> **Note:** The `indextts` folder contains the IndexTTS library source code. You must install it as a Python package using `pip install -e ./indextts` before running the server locally.

### Build Docker Image

```bash
docker build -t indextts-inference-server .
```

## License

This project uses IndexTTS which is under Bilibili license. Please check the original repository for license details.
