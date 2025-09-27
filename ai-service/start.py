#!/usr/bin/env python3

import logging
import sys
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_dependencies():
    required = ['cv2', 'numpy', 'ultralytics', 'fastapi', 'sklearn']
    missing = []
    
    for module in required:
        try:
            __import__(module)
        except ImportError:
            missing.append(module)
    
    if missing:
        logger.error(f"Missing modules: {missing}")
        return False
    return True

def main():
    logger.info("Starting PennyProtect AI Service...")
    
    if not check_dependencies():
        sys.exit(1)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0", 
        port=8001,
        log_level="info"
    )

if __name__ == "__main__":
    main()
