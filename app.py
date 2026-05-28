import json
import os
import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from transcriber import (
    transcribe_audio_chunk,
    transcribe_file,
    set_live_model,
    get_live_model_size,
)

app = FastAPI()

DEV_MODE = os.environ.get("HEARNOTE_DEV", "0") == "1"

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

TRANSCRIPTS_DIR = Path("transcripts")
TRANSCRIPTS_DIR.mkdir(exist_ok=True)

STATIC_DIR = Path("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

_server_start_id = str(uuid.uuid4())


@app.get("/api/livereload")
async def livereload_check():
    return {"id": _server_start_id}

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"

SUMMARY_PROMPT = """Summarize this meeting transcript. Extract and format clearly:

## Key Decisions
- List each decision made

## Action Items
- List each action item (with owner if mentioned)

## Open Questions
- List unresolved questions or follow-ups

Be concise. If a section has no items, write "None identified."

Transcript:
{transcript}"""


LIVERELOAD_SCRIPT = """
<script>
(function() {
    let lastId = null;
    let lastMtime = 0;
    async function check() {
        try {
            const resp = await fetch('/api/livereload');
            const data = await resp.json();
            if (lastId && data.id !== lastId) { location.reload(); return; }
            lastId = data.id;
        } catch {}
        // Also check static file changes
        try {
            const resp = await fetch('/static/app.js', { method: 'HEAD' });
            const mtime = resp.headers.get('last-modified');
            if (lastMtime && mtime !== lastMtime) { location.reload(); return; }
            lastMtime = mtime;
        } catch {}
    }
    setInterval(check, 1000);
})();
</script>
"""


@app.get("/")
async def index():
    if DEV_MODE:
        html = STATIC_DIR.joinpath("index.html").read_text()
        html = html.replace("</body>", LIVERELOAD_SCRIPT + "</body>")
        return HTMLResponse(html)
    return FileResponse("static/index.html")


# --- Live Transcription ---

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    chunks: list[str] = []
    try:
        while True:
            data = await websocket.receive_bytes()
            text = await asyncio.to_thread(transcribe_audio_chunk, data)
            if text.strip():
                chunks.append(text.strip())
                await websocket.send_json({"text": text})
    except WebSocketDisconnect:
        pass
    finally:
        if chunks:
            full_text = " ".join(chunks)
            save_transcript(source="live", text=full_text)


# --- File Upload Transcription ---

@app.post("/api/transcribe")
async def upload_transcribe(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix or ".mp4"
    file_path = UPLOAD_DIR / f"{file_id}{ext}"

    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    try:
        segments = await asyncio.to_thread(transcribe_file, str(file_path))
        full_text = " ".join(seg["text"] for seg in segments)
        save_transcript(
            source="upload",
            text=full_text,
            segments=segments,
            filename=file.filename,
        )
        return {"segments": segments}
    finally:
        file_path.unlink(missing_ok=True)


# --- Summarize with Ollama ---

class SummarizeRequest(BaseModel):
    text: str


@app.post("/api/summarize")
async def summarize(req: SummarizeRequest):
    prompt = SUMMARY_PROMPT.format(transcript=req.text[:15000])

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(OLLAMA_URL, json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
            })
            resp.raise_for_status()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Start it with: ollama serve",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Ollama error: {e.response.text}")

    data = resp.json()
    return {"summary": data.get("response", "")}


# --- Transcript History ---

def save_transcript(
    source: str,
    text: str,
    segments: list[dict] | None = None,
    filename: str | None = None,
):
    transcript_id = str(uuid.uuid4())
    record = {
        "id": transcript_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "text": text,
        "segments": segments,
        "filename": filename,
    }
    path = TRANSCRIPTS_DIR / f"{transcript_id}.json"
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2))


@app.get("/api/transcripts")
async def list_transcripts():
    transcripts = []
    for path in sorted(TRANSCRIPTS_DIR.glob("*.json"), reverse=True):
        try:
            data = json.loads(path.read_text())
            transcripts.append({
                "id": data["id"],
                "timestamp": data["timestamp"],
                "source": data["source"],
                "filename": data.get("filename"),
                "preview": data["text"][:120],
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return {"transcripts": transcripts}


@app.get("/api/transcripts/{transcript_id}")
async def get_transcript(transcript_id: str):
    path = TRANSCRIPTS_DIR / f"{transcript_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Transcript not found")
    return json.loads(path.read_text())


@app.delete("/api/transcripts/{transcript_id}")
async def delete_transcript(transcript_id: str):
    path = TRANSCRIPTS_DIR / f"{transcript_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Transcript not found")
    path.unlink()
    return {"ok": True}


# --- Model Settings ---

class ModelRequest(BaseModel):
    size: str


@app.get("/api/settings/model")
async def get_model():
    return {"size": get_live_model_size()}


@app.post("/api/settings/model")
async def update_model(req: ModelRequest):
    try:
        set_live_model(req.size)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"size": get_live_model_size()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
