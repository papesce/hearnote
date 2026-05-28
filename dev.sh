#!/bin/bash
export HEARNOTE_DEV=1
exec uv run python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
