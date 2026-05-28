# Hearnote

**Private meeting transcription — nothing leaves your machine.**

Hearnote is a local-first transcription app powered by Whisper. Record live or upload a file — your audio never touches a cloud.

## Features

- **Live Recording** — transcribe in real-time from your microphone or system audio (BlackHole)
- **Upload MP4** — drop in a video/audio file and get a streaming, timestamped transcript
- **Streaming transcription** — segments appear one by one as they're processed, with a progress bar and elapsed timer
- **Cancel** — stop an in-progress upload transcription instantly (kills the process, CPU freed immediately)
- **AI Summaries** — summarize transcripts locally with Ollama (llama3) or copy a prompt to paste into any AI chat (Copilot, ChatGPT, Claude, etc.)
- **Preview prompt** — see the full prompt inline before copying
- **Transcript History** — all sessions saved locally, browsable and deletable
- **Model Selector** — choose between Fast (base), Balanced (small), or Accurate (medium) for live transcription
- **Language Selector** — pick the language you're listening to, or leave as Auto-detect
- **Copy to clipboard** — one-click copy of your transcript

## Quick Start

```bash
uv sync
uv run python app.py
```

Open http://localhost:8000

## Development

For auto-reload on file changes (both Python and static files):

```bash
./dev.sh          # start dev server
./dev.sh --open   # start and open browser automatically
./dev.sh -o       # same, short form
```

This starts the server with:
- Auto-restart on Python file changes (uvicorn `--reload`)
- Auto browser refresh on HTML/CSS/JS changes (live-reload script injected in dev mode)

## AI Summarization

Hearnote offers two ways to summarize transcripts:

### Option 1: Local with Ollama (fully private)

No data leaves your machine. Requires Ollama running locally:

```bash
brew install ollama
ollama serve
ollama pull llama3
```

After transcribing, click **"Summarize with AI"** — the summary is generated entirely on your machine.

### Option 2: Copy prompt for external AI

Click **"Copy summary prompt"** to copy a pre-built prompt with your transcript to the clipboard. Paste it into any AI assistant:
- Microsoft 365 Copilot
- ChatGPT
- Claude
- Gemini
- Or any other LLM chat

Use **"Preview prompt"** to see the full prompt inline before copying.

The prompt asks for key decisions, action items, open questions, and a brief summary.

## Language Selection

Both the Live and Upload tabs have a language dropdown. Choose the language being spoken for faster, more accurate transcription — or leave it on "Auto-detect" to let Whisper figure it out.

Supported languages: English, Spanish, Portuguese, French, German, Italian, Dutch, Japanese, Chinese, Korean, Arabic, Hindi, Russian.

## System Audio Capture (Teams/Zoom)

To transcribe audio from virtual meetings (Teams, Zoom, Google Meet) or any app playing audio on your Mac, you need to route system audio through a virtual loopback driver. Hearnote uses [BlackHole](https://github.com/ExistentialAudio/BlackHole) for this.

### 1. Install BlackHole

```bash
brew install blackhole-2ch
```

> If you don't use Homebrew, download the installer from https://github.com/ExistentialAudio/BlackHole/releases and run the `.pkg` file.

After installing, restart your Mac or log out/log in to ensure the audio driver loads.

### 2. Create a Multi-Output Device

This lets you hear audio through your speakers/headphones **and** route it to Hearnote simultaneously.

1. Open **Audio MIDI Setup** (Spotlight → type "Audio MIDI Setup")
2. Click the **+** button in the bottom-left corner → **Create Multi-Output Device**
3. In the right panel, check **both**:
   - Your regular output (e.g. "MacBook Pro Speakers" or "External Headphones")
   - **BlackHole 2ch**
4. Make sure your regular output is listed **first** (drag to reorder) — this sets it as the clock source
5. Optionally rename the device (right-click → "Rename") to something like "Hearnote Output"

### 3. Set it as your system output

- Open **System Settings → Sound → Output** and select your new Multi-Output Device
- Alternatively, hold **Option** and click the volume icon in the menu bar to quickly switch

> **Note:** The system volume slider doesn't work with Multi-Output Devices. Control volume through your individual output device or app-level controls.

### 4. Select BlackHole in Hearnote

1. Start Hearnote and open http://localhost:8000
2. Click the audio source dropdown and select **BlackHole 2ch**
3. Start your meeting or play audio — Hearnote will now capture the system audio

### Troubleshooting

| Problem | Fix |
|---------|-----|
| BlackHole doesn't appear in Audio MIDI Setup | Restart your Mac after install; check System Settings → Privacy & Security for blocked extensions |
| No audio captured | Verify the Multi-Output Device is set as system output, not just BlackHole alone |
| Can't hear audio anymore | Make sure your speakers/headphones are checked in the Multi-Output Device |
| Meeting app uses a different output | Some apps (Zoom, Teams) let you pick an output device in their settings — set it to the Multi-Output Device |
| Choppy or glitchy audio | Ensure your regular output is the clock source (first in the list) in Audio MIDI Setup |

### Reverting

To go back to normal audio (no routing to Hearnote):

1. Open **System Settings → Sound → Output**
2. Select your regular speakers or headphones directly

## Requirements

- Python 3.10–3.12
- macOS (Intel or Apple Silicon)
- Ollama (optional, for local AI summaries)
