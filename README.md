# Hearnote

**Private meeting transcription — nothing leaves your machine.**

Hearnote is a local-first transcription app powered by Whisper. Record live or upload a file — your audio never touches a cloud.

## Features

- **Live Recording** — transcribe in real-time from your microphone or system audio (BlackHole)
- **Upload MP4** — drop in a video/audio file and get a timestamped transcript
- **Copy to clipboard** — one-click copy of your transcript

## Quick Start

```bash
uv sync
uv run python app.py
```

Open http://localhost:8000

## System Audio Capture (Teams/Zoom)

1. Install BlackHole: `brew install blackhole-2ch`
2. Open Audio MIDI Setup → create a Multi-Output Device (speakers + BlackHole)
3. Set Multi-Output Device as system output
4. In Hearnote, select BlackHole as the audio source

## Requirements

- Python 3.10–3.12
- macOS (Intel or Apple Silicon)
