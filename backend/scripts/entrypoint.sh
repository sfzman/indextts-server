#!/bin/bash
# Entrypoint script for IndexTTS Server

set -e

MODEL_DIR="${MODEL_DIR:-/app/checkpoints}"
DOWNLOAD_MODEL="${DOWNLOAD_MODEL:-false}"

# Check if model exists
if [ ! -f "$MODEL_DIR/config.yaml" ]; then
    echo "Model not found in $MODEL_DIR"

    if [ "$DOWNLOAD_MODEL" = "true" ]; then
        echo "Downloading model..."
        /app/scripts/download_model.sh
    else
        echo "ERROR: Model not found. Please mount the model directory or set DOWNLOAD_MODEL=true"
        echo "You can download the model manually with:"
        echo "  huggingface-cli download IndexTeam/IndexTTS-2 --local-dir=$MODEL_DIR"
        exit 1
    fi
fi

echo "Starting IndexTTS Server..."
exec python -m uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
