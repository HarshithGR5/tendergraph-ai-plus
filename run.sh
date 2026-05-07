#!/bin/bash
set -e

echo "=== TenderGraph AI+ Production Start ==="

echo "[1/3] Running database migrations..."
python -m alembic -c backend/alembic.ini upgrade head

echo "[2/3] Starting FastAPI backend on port 8000..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 2 &
BACKEND_PID=$!

echo "[3/3] Starting Next.js frontend on port 5000..."
cd frontend && npm start

# If frontend exits, shut down backend too
kill $BACKEND_PID 2>/dev/null || true
