# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
# Local development
cp .env.example .env  # First time only, then configure values
go run .              # Start server on http://localhost:8080

# Build binary
go build -o main .

# Docker build
docker build -t indextts-backend-server .
```

## Architecture Overview

This is the Go backend server for IndexTTS, a voice cloning and synthesis service. It coordinates between the React frontend and Python inference service (GPU).

### Request Flow

```
Frontend → Backend Server (this repo) → Python Inference Service
              ↓                              ↓
           MySQL DB                    TTS Processing
              ↓
          Aliyun OSS (file storage)
```

### Core Components

- **main.go** - Entry point, initializes services and sets up Gin routes
- **config/** - Configuration from environment variables (`.env` or system env)
- **handlers/** - HTTP request handlers (auth, file, task, upload)
- **middleware/** - JWT authentication middleware for protected routes
- **models/** - GORM models and database initialization (auto-migrates on startup)
- **services/** - Business logic:
  - `worker.go` - Background goroutine polling for pending TTS tasks
  - `inference.go` - Calls Python inference API with RS256 JWT auth
  - `oss.go` - Aliyun OSS file operations
  - `sms.go` - Aliyun SMS for verification codes (dev mode prints to console)
  - `auth.go` - User authentication with HS256 JWT

### Authentication

Two separate JWT systems:
1. **User auth** (HS256) - `AUTH_JWT_SECRET` - For user login via SMS verification code
2. **Inference auth** (RS256) - `JWT_PRIVATE_KEY` - For calling the Python inference service

### Task Processing

The `Worker` in `services/worker.go` polls every 5 seconds for pending tasks, processes them sequentially:
1. Fetches reference audio from OSS
2. Calls inference API with text and audio
3. Uploads result WAV to OSS
4. Updates task status in database

### API Routes

- `POST /api/v1/auth/send-code` - Send SMS verification code (public)
- `POST /api/v1/auth/login` - Login with phone + code (public)
- `GET /api/v1/auth/me` - Get current user (protected)
- `POST /api/v1/upload` - Upload audio file (protected)
- `GET /api/v1/files/:id` - Get file metadata (protected)
- `GET /api/v1/files/:id/url` - Get signed OSS URL (protected)
- `POST /api/v1/tasks` - Create TTS task (protected)
- `GET /api/v1/tasks` - List user's tasks (protected)
- `GET /api/v1/tasks/:id` - Get task details (protected)

### Database Models

- **User** - Phone-based accounts
- **VerificationCode** - SMS codes with expiry and cooldown
- **File** - Uploaded audio files (metadata, OSS key)
- **Task** - TTS synthesis tasks with status tracking and emotion control modes

### Emotion Modes

Tasks support four emotion control modes:
- `same_as_reference` - Use emotion from reference audio
- `emotion_prompt` - Use separate emotion reference audio
- `emotion_vector` - Use explicit 8-float emotion vector
- `emotion_text` - Auto-detect from text content
