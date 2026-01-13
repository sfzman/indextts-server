# IndexTTS Server Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build dependencies
FROM python:3.10-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    git-lfs \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Initialize git-lfs
RUN git lfs install

# Install uv for dependency management
RUN pip install uv

# Clone IndexTTS repository
RUN git clone https://github.com/index-tts/index-tts.git /build/indextts

WORKDIR /build/indextts

# Create virtual environment and install dependencies
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install PyTorch with CUDA support first
RUN uv pip install torch==2.8.* torchaudio==2.8.* --index-url https://download.pytorch.org/whl/cu128

# Install IndexTTS and dependencies
RUN uv pip install -e . --no-deps
RUN uv pip install \
    transformers==4.52.1 \
    accelerate \
    einops \
    safetensors \
    librosa \
    omegaconf \
    pandas \
    numpy \
    jieba \
    g2p-en \
    WeTextProcessing \
    fastapi \
    uvicorn[standard] \
    python-multipart \
    aiofiles

# Stage 2: Runtime image
FROM nvidia/cuda:12.8.0-runtime-ubuntu22.04

# Install Python and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    libsndfile1 \
    ffmpeg \
    git \
    git-lfs \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3.10 /usr/bin/python

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /build/indextts /opt/indextts

ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/opt/indextts:$PYTHONPATH"

WORKDIR /app

# Copy application code
COPY app/ /app/app/
COPY scripts/ /app/scripts/

# Create directories
RUN mkdir -p /app/checkpoints /app/outputs /app/references

# Make scripts executable
RUN chmod +x /app/scripts/*.sh

# Environment variables
ENV MODEL_DIR=/app/checkpoints
ENV OUTPUT_DIR=/app/outputs
ENV REFERENCE_DIR=/app/references
ENV HOST=0.0.0.0
ENV PORT=8000

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
