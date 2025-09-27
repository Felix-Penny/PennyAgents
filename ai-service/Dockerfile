FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and other packages
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgthread-2.0-0 \
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    gfortran \
    openexr \
    libatlas-base-dev \
    python3-dev \
    libtbb2 \
    libtbb-dev \
    libdc1394-22-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download YOLO models
RUN mkdir -p models && \
    curl -L https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt -o models/yolov8n.pt && \
    curl -L https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n-pose.pt -o models/yolov8n-pose.pt && \
    curl -L https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n-seg.pt -o models/yolov8n-seg.pt

# Copy source code
COPY . .

# Create cache directory
RUN mkdir -p /app/cache

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

# Start the AI service
CMD ["python", "main.py"]