#!/usr/bin/env python3
"""
Start script for AI microservice
"""

import os
import sys
import subprocess
import signal
import time
from pathlib import Path

def check_dependencies():
    """Check if all required dependencies are installed"""
    print("Checking dependencies...")
    
    try:
        import uvicorn
        import fastapi
        import boto3
        import cv2
        import PIL
        import numpy
        import ffmpeg
        import httpx
        print("✓ All Python dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Please install dependencies with: pip install -r requirements.txt")
        return False

def check_aws_credentials():
    """Check if AWS credentials are configured"""
    print("Checking AWS credentials...")
    
    required_env_vars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']
    missing_vars = []
    
    for var in required_env_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"✗ Missing AWS environment variables: {missing_vars}")
        print("Please set the following environment variables:")
        for var in missing_vars:
            print(f"  export {var}=your_value_here")
        return False
    
    print("✓ AWS credentials are configured")
    return True

def start_service():
    """Start the FastAPI service"""
    print("Starting AI microservice...")
    
    port = int(os.getenv('AI_SERVICE_PORT', '8001'))
    host = '0.0.0.0'
    
    # Change to the ai-service directory
    os.chdir(Path(__file__).parent)
    
    # Start uvicorn server
    cmd = [
        sys.executable, '-m', 'uvicorn',
        'main:app',
        '--host', host,
        '--port', str(port),
        '--reload',
        '--log-level', 'info'
    ]
    
    print(f"Starting service on http://{host}:{port}")
    print(f"Command: {' '.join(cmd)}")
    
    try:
        process = subprocess.Popen(cmd)
        
        # Handle graceful shutdown
        def signal_handler(sig, frame):
            print("\nShutting down AI service...")
            process.terminate()
            process.wait()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Wait for process to complete
        process.wait()
        
    except Exception as e:
        print(f"Failed to start service: {e}")
        return False
    
    return True

def main():
    """Main entry point"""
    print("=== AI Microservice Startup ===")
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Check AWS credentials
    if not check_aws_credentials():
        print("\nWarning: AWS credentials not configured. Service will start but AWS features will be disabled.")
        print("You can configure credentials later and restart the service.")
        time.sleep(3)
    
    # Start service
    if not start_service():
        sys.exit(1)

if __name__ == "__main__":
    main()