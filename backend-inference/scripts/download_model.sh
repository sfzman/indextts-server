#!/bin/bash
# Script to download IndexTTS models

set -e

MODEL_DIR="${MODEL_DIR:-/app/checkpoints}"
MODEL_NAME="${MODEL_NAME:-IndexTeam/IndexTTS-2}"

echo "Downloading model: $MODEL_NAME"
echo "Target directory: $MODEL_DIR"

# Ensure git-lfs is initialized
git lfs install

# Check if huggingface-cli is available
if command -v huggingface-cli &> /dev/null; then
    echo "Using huggingface-cli to download model..."
    huggingface-cli download "$MODEL_NAME" --local-dir="$MODEL_DIR"
else
    echo "Using git clone to download model..."
    # Create temp directory
    TEMP_DIR=$(mktemp -d)

    # Clone the model repository
    git clone "https://huggingface.co/$MODEL_NAME" "$TEMP_DIR"

    # Move files to target directory
    mv "$TEMP_DIR"/* "$MODEL_DIR"/

    # Cleanup
    rm -rf "$TEMP_DIR"
fi

echo "Model download complete!"

# List downloaded files
echo "Downloaded files:"
ls -la "$MODEL_DIR"
