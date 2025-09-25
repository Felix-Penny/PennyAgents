#!/bin/bash

# AI Microservice Startup Script
# This script starts the Python FastAPI service for AWS Rekognition integration

echo "=== Starting Penny AI Microservice ==="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

# Check if required environment variables are set
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_REGION" ]; then
    echo "⚠️  Warning: AWS credentials not configured"
    echo "   Please set the following environment variables:"
    echo "   - AWS_ACCESS_KEY_ID"
    echo "   - AWS_SECRET_ACCESS_KEY" 
    echo "   - AWS_REGION"
    echo ""
    echo "   The service will start but AWS features will be disabled."
    echo ""
fi

# Set default port if not specified
export AI_SERVICE_PORT=${AI_SERVICE_PORT:-8001}

# Change to the ai-service directory
cd "$(dirname "$0")"

echo "🔧 Installing dependencies..."
pip install -r requirements.txt

echo "🚀 Starting AI service on port $AI_SERVICE_PORT..."
echo "   Health check: http://localhost:$AI_SERVICE_PORT/health"
echo "   AWS status: http://localhost:$AI_SERVICE_PORT/aws/status"
echo ""

# Start the service with uvicorn
python3 -m uvicorn main:app --host 0.0.0.0 --port $AI_SERVICE_PORT --reload