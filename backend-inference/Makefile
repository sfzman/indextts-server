.PHONY: help build run stop logs clean download-model

help:
	@echo "IndexTTS Server Commands:"
	@echo "  make download-model  - Download IndexTTS model"
	@echo "  make build          - Build Docker image"
	@echo "  make run            - Start server with GPU"
	@echo "  make run-cpu        - Start server with CPU only"
	@echo "  make stop           - Stop server"
	@echo "  make logs           - View server logs"
	@echo "  make clean          - Remove containers and outputs"

download-model:
	@mkdir -p checkpoints
	@echo "Downloading IndexTTS-2 model..."
	huggingface-cli download IndexTeam/IndexTTS-2 --local-dir=checkpoints
	@echo "Model download complete!"

build:
	docker-compose build

run:
	docker-compose up -d
	@echo "Server starting at http://localhost:8000"
	@echo "View logs with: make logs"

run-cpu:
	docker-compose -f docker-compose.cpu.yml up -d
	@echo "Server starting at http://localhost:8000 (CPU mode)"
	@echo "View logs with: make logs"

stop:
	docker-compose down
	docker-compose -f docker-compose.cpu.yml down 2>/dev/null || true

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	rm -rf outputs/*
	@echo "Cleaned up containers and outputs"

test:
	@echo "Submitting test TTS task..."
	curl -X POST http://localhost:8000/api/v1/tts \
		-H "Content-Type: application/json" \
		-d '{"text": "Hello, this is a test of the IndexTTS server."}'
