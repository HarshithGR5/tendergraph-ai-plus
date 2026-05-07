#!/bin/bash
set -e

echo "=== TenderGraph AI+ Build ==="

echo "[1/3] Installing Python dependencies..."
pip install -r requirements.txt

echo "[2/3] Installing Node.js dependencies..."
cd frontend && npm install

echo "[3/3] Building Next.js frontend..."
npm run build

echo "=== Build complete ==="
