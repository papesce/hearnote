import io
import numpy as np
from faster_whisper import WhisperModel

_live_model: WhisperModel | None = None
_upload_model: WhisperModel | None = None


def get_live_model() -> WhisperModel:
    global _live_model
    if _live_model is None:
        _live_model = WhisperModel("base", compute_type="int8")
    return _live_model


def get_upload_model() -> WhisperModel:
    global _upload_model
    if _upload_model is None:
        _upload_model = WhisperModel("medium", compute_type="int8")
    return _upload_model


def transcribe_audio_chunk(audio_bytes: bytes) -> str:
    audio = np.frombuffer(audio_bytes, dtype=np.float32)
    if len(audio) == 0:
        return ""
    model = get_live_model()
    segments, _ = model.transcribe(audio, language="en", vad_filter=True)
    return " ".join(seg.text.strip() for seg in segments)


def transcribe_file(file_path: str) -> list[dict]:
    model = get_upload_model()
    segments, _ = model.transcribe(file_path, language="en", vad_filter=True)
    results = []
    for seg in segments:
        results.append({
            "start": round(seg.start, 1),
            "end": round(seg.end, 1),
            "text": seg.text.strip(),
        })
    return results
