#!/bin/bash
set -e

echo "=== TenderGraph AI+ Backend Startup ==="

echo "Running Alembic migrations..."
python -m alembic -c backend/alembic.ini upgrade head

echo "Starting FastAPI server..."
uvicorn backend.main:app --host localhost --port 8000 --reload
