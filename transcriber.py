import io
import numpy as np
from faster_whisper import WhisperModel

_live_model: WhisperModel | None = None
_live_model_size: str = "base"
_upload_model: WhisperModel | None = None


def get_live_model() -> WhisperModel:
    global _live_model
    if _live_model is None:
        _live_model = WhisperModel(_live_model_size, compute_type="int8")
    return _live_model


def set_live_model(size: str) -> None:
    global _live_model, _live_model_size
    if size not in ("base", "small", "medium"):
        raise ValueError(f"Invalid model size: {size}")
    if size != _live_model_size:
        _live_model_size = size
        _live_model = None


def get_live_model_size() -> str:
    return _live_model_size


def get_upload_model() -> WhisperModel:
    global _upload_model
    if _upload_model is None:
        _upload_model = WhisperModel("medium", compute_type="int8")
    return _upload_model


def transcribe_audio_chunk(audio_bytes: bytes, language: str | None = None) -> str:
    audio = np.frombuffer(audio_bytes, dtype=np.float32)
    if len(audio) == 0:
        return ""
    model = get_live_model()
    kwargs = {"vad_filter": True}
    if language:
        kwargs["language"] = language
    segments, _ = model.transcribe(audio, **kwargs)
    return " ".join(seg.text.strip() for seg in segments)


def transcribe_file(file_path: str) -> list[dict]:
    model = get_upload_model()
    segments, _ = model.transcribe(file_path, vad_filter=True)
    results = []
    for seg in segments:
        results.append({
            "start": round(seg.start, 1),
            "end": round(seg.end, 1),
            "text": seg.text.strip(),
        })
    return results


def transcribe_file_stream(file_path: str, language: str | None = None):
    model = get_upload_model()
    kwargs = {"vad_filter": True}
    if language:
        kwargs["language"] = language
    segments, info = model.transcribe(file_path, **kwargs)
    duration = info.duration
    for seg in segments:
        yield {
            "start": round(seg.start, 1),
            "end": round(seg.end, 1),
            "text": seg.text.strip(),
            "duration": round(duration, 1) if duration else None,
        }
