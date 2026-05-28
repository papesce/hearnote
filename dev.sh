#!/bin/bash
export HEARNOTE_DEV=1

if [[ "$1" == "--open" || "$1" == "-o" ]]; then
    (sleep 2 && open http://localhost:8000) &
fi

exec uv run python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
