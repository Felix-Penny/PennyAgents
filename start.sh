#!/bin/bash
echo "=== Starting PennyProtect Backend ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PORT: $PORT"
echo "PWD: $(pwd)"
echo "Files in current directory:"
ls -la
echo "=== Starting server ==="
node index.js