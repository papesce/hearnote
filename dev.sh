#!/bin/bash
# Development mode: runs FastAPI backend + Vite dev server with HMR
# The Vite dev server proxies API/WS requests to FastAPI.
# Access the app at http://localhost:5173

export HEARNOTE_DEV=1

if [[ "$1" == "--open" || "$1" == "-o" ]]; then
    (sleep 3 && open http://localhost:5173) &
fi

# Start FastAPI backend in background
uv run python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start Vite dev server
cd frontend && npm run dev &
FRONTEND_PID=$!

# Clean up both on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
