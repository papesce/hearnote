import json
import os
import re
import uuid
import asyncio
import multiprocessing
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from pydantic import BaseModel

from transcriber import (
    transcribe_audio_chunk,
    transcribe_file,
    transcribe_file_stream,
    set_live_model,
    get_live_model_size,
)

app = FastAPI()

DEV_MODE = os.environ.get("HEARNOTE_DEV", "0") == "1"

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

TRANSCRIPTS_DIR = Path("transcripts")
TRANSCRIPTS_DIR.mkdir(exist_ok=True)

RECORDINGS_DIR = Path("recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)

STATIC_DIR = Path("static")

_server_start_id = str(uuid.uuid4())

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')


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


@app.get("/favicon.svg")
async def favicon():
    favicon_path = STATIC_DIR / "favicon.svg"
    if favicon_path.exists():
        return FileResponse(favicon_path, media_type="image/svg+xml")
    raise HTTPException(status_code=404)


@app.get("/")
async def index():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        return HTMLResponse("<h1>Frontend not built</h1><p>Run: cd frontend && npm run build</p>")
    if DEV_MODE:
        html = index_path.read_text()
        html = html.replace("</body>", LIVERELOAD_SCRIPT + "</body>")
        return HTMLResponse(html)
    return FileResponse(index_path)


# --- Live Transcription ---

@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    lang = websocket.query_params.get("lang") or None
    chunks: list[str] = []
    saved = False
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            if "bytes" in message:
                data = message["bytes"]
                text = await asyncio.to_thread(transcribe_audio_chunk, data, lang)
                if text.strip():
                    chunks.append(text.strip())
                    await websocket.send_json({"text": text})
            elif "text" in message:
                text_data = message["text"]
                client_id = None
                client_full_text = None
                is_stop = False
                if text_data == "stop":
                    is_stop = True
                else:
                    try:
                        payload = json.loads(text_data)
                        if payload.get("action") == "stop":
                            is_stop = True
                            client_id = payload.get("transcriptId")
                            client_full_text = payload.get("fullText")
                    except (json.JSONDecodeError, AttributeError):
                        pass
                if is_stop:
                    transcript_id = None
                    # Prefer client-provided fullText (fixes sync bug where
                    # server chunks may be incomplete if audio was still processing)
                    full_text = client_full_text or (" ".join(chunks) if chunks else None)
                    if full_text and full_text.strip():
                        transcript_id = save_transcript(source="live", text=full_text.strip(), transcript_id=client_id)
                        saved = True
                    await websocket.send_json({"event": "stopped", "transcriptId": transcript_id})
                    break
    except WebSocketDisconnect:
        if chunks and not saved:
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


# --- Streaming File Transcription ---


def _transcribe_worker(file_path: str, language: str | None, pipe_conn):
    """Runs in a separate process so it can be killed immediately."""
    from transcriber import transcribe_file_stream
    try:
        for seg in transcribe_file_stream(file_path, language=language):
            pipe_conn.send(seg)
        pipe_conn.send(None)
    except Exception as e:
        pipe_conn.send({"_error": str(e)})
    finally:
        pipe_conn.close()


_active_jobs: dict[str, multiprocessing.Process] = {}


@app.post("/api/transcribe/stream")
async def upload_transcribe_stream(file: UploadFile = File(...), lang: str | None = None):
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix or ".mp4"
    file_path = UPLOAD_DIR / f"{file_id}{ext}"

    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    filename = file.filename
    language = lang or None

    async def event_stream():
        segments = []
        parent_conn, child_conn = multiprocessing.Pipe(duplex=False)

        proc = multiprocessing.Process(
            target=_transcribe_worker,
            args=(str(file_path), language, child_conn),
            daemon=True,
        )
        _active_jobs[file_id] = proc
        proc.start()
        child_conn.close()

        yield f"event: job\ndata: {json.dumps({'jobId': file_id})}\n\n"

        cancelled = False
        try:
            while True:
                item = await asyncio.to_thread(parent_conn.recv)
                if item is None:
                    break
                if isinstance(item, dict) and "_error" in item:
                    yield f"event: error\ndata: {json.dumps({'error': item['_error']})}\n\n"
                    return
                segments.append(item)
                yield f"data: {json.dumps(item)}\n\n"
        except EOFError:
            if proc.exitcode is None or proc.exitcode < 0:
                cancelled = True

        proc.join(timeout=2)
        _active_jobs.pop(file_id, None)

        if cancelled:
            file_path.unlink(missing_ok=True)
            yield f"event: cancelled\ndata: {json.dumps({'count': len(segments)})}\n\n"
            return

        full_text = " ".join(s["text"] for s in segments)
        transcript_id = save_transcript(
            source="upload",
            text=full_text,
            segments=segments,
            filename=filename,
        )

        # Move uploaded file to recordings for playback
        recording_path = RECORDINGS_DIR / f"{transcript_id}{ext}"
        file_path.rename(recording_path)

        # Mark transcript as having a recording
        transcript_path = TRANSCRIPTS_DIR / f"{transcript_id}.json"
        if transcript_path.exists():
            data = json.loads(transcript_path.read_text())
            data["has_recording"] = True
            data["recording_ext"] = ext
            transcript_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))

        yield f"event: done\ndata: {json.dumps({'count': len(segments), 'transcriptId': transcript_id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class RetranscribeRequest(BaseModel):
    transcript_id: str
    lang: str | None = None


@app.post("/api/transcribe/retranscribe")
async def retranscribe(req: RetranscribeRequest):
    # Find the recording file
    recording_path = None
    for path in RECORDINGS_DIR.glob(f"{req.transcript_id}.*"):
        recording_path = path
        break

    if not recording_path:
        raise HTTPException(status_code=404, detail="No recording found for this transcript")

    # Load original transcript for metadata
    orig_path = TRANSCRIPTS_DIR / f"{req.transcript_id}.json"
    orig_data = {}
    if orig_path.exists():
        orig_data = json.loads(orig_path.read_text())

    # Transcribe with the upload (medium) model
    segments = await asyncio.to_thread(
        transcribe_file, str(recording_path), req.lang
    )
    full_text = " ".join(seg["text"] for seg in segments)

    # Save as a new transcript, referencing the same recording
    new_id = save_transcript(
        source="retranscribe",
        text=full_text,
        segments=segments,
        filename=orig_data.get("filename"),
    )

    # Link the new transcript to the same recording
    new_transcript_path = TRANSCRIPTS_DIR / f"{new_id}.json"
    new_data = json.loads(new_transcript_path.read_text())
    new_data["has_recording"] = True
    new_data["recording_ref"] = req.transcript_id
    new_transcript_path.write_text(json.dumps(new_data, ensure_ascii=False, indent=2))

    return {"transcriptId": new_id, "segments": segments}


@app.post("/api/transcribe/cancel/{job_id}")
async def cancel_transcription(job_id: str):
    proc = _active_jobs.get(job_id)
    if proc and proc.is_alive():
        proc.terminate()
        proc.join(timeout=3)
        if proc.is_alive():
            proc.kill()
        _active_jobs.pop(job_id, None)
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Job not found or already finished")


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
        try:
            err_body = e.response.json()
            err_msg = err_body.get("error", "")
        except Exception:
            err_msg = e.response.text

        if "not found" in err_msg:
            raise HTTPException(
                status_code=502,
                detail=f"Model '{OLLAMA_MODEL}' not found. Pull it with: ollama pull {OLLAMA_MODEL}",
            )
        raise HTTPException(status_code=502, detail=f"Ollama error: {err_msg}")

    data = resp.json()
    return {"summary": data.get("response", "")}


# --- Transcript History ---

def save_transcript(
    source: str,
    text: str,
    segments: list[dict] | None = None,
    filename: str | None = None,
    transcript_id: str | None = None,
) -> str:
    if not transcript_id or not _UUID_RE.match(transcript_id):
        transcript_id = str(uuid.uuid4())
    record = {
        "id": transcript_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "text": text,
        "segments": segments,
        "filename": filename,
        "has_recording": False,
    }
    path = TRANSCRIPTS_DIR / f"{transcript_id}.json"
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2))
    return transcript_id


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
                "has_recording": data.get("has_recording", False) or bool(data.get("recording_ref")),
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
    for rec_path in RECORDINGS_DIR.glob(f"{transcript_id}.*"):
        rec_path.unlink(missing_ok=True)
    return {"ok": True}


# --- Recordings ---

@app.post("/api/recordings/{transcript_id}")
async def upload_recording(transcript_id: str, file: UploadFile = File(...)):
    if not _UUID_RE.match(transcript_id):
        raise HTTPException(status_code=400, detail="Invalid transcript ID")

    recording_path = RECORDINGS_DIR / f"{transcript_id}.webm"
    with open(recording_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    transcript_path = TRANSCRIPTS_DIR / f"{transcript_id}.json"
    if transcript_path.exists():
        data = json.loads(transcript_path.read_text())
        data["has_recording"] = True
        transcript_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        record = {
            "id": transcript_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "live",
            "text": "(Recording saved without transcript)",
            "segments": None,
            "filename": None,
            "has_recording": True,
        }
        transcript_path.write_text(json.dumps(record, ensure_ascii=False, indent=2))

    return {"ok": True}


@app.get("/api/recordings/{transcript_id}")
async def get_recording(transcript_id: str):
    # Check for recording with any extension
    for path in RECORDINGS_DIR.glob(f"{transcript_id}.*"):
        media_types = {
            ".webm": "audio/webm",
            ".mp4": "video/mp4",
            ".m4a": "audio/mp4",
            ".wav": "audio/wav",
            ".mp3": "audio/mpeg",
        }
        media_type = media_types.get(path.suffix, "application/octet-stream")
        return FileResponse(path, media_type=media_type, filename=f"{transcript_id}{path.suffix}")

    # Check if this transcript references another's recording
    transcript_path = TRANSCRIPTS_DIR / f"{transcript_id}.json"
    if transcript_path.exists():
        data = json.loads(transcript_path.read_text())
        ref_id = data.get("recording_ref")
        if ref_id:
            for path in RECORDINGS_DIR.glob(f"{ref_id}.*"):
                media_types = {
                    ".webm": "audio/webm",
                    ".mp4": "video/mp4",
                    ".m4a": "audio/mp4",
                    ".wav": "audio/wav",
                    ".mp3": "audio/mpeg",
                }
                media_type = media_types.get(path.suffix, "application/octet-stream")
                return FileResponse(path, media_type=media_type, filename=f"{transcript_id}{path.suffix}")

    raise HTTPException(status_code=404, detail="Recording not found")


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


# Mount static files last so API routes take priority
_assets_dir = STATIC_DIR / "assets"
if _assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
