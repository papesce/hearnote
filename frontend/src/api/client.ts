import type { Transcript, TranscriptListItem } from '../types';

export async function fetchTranscripts(): Promise<TranscriptListItem[]> {
  const resp = await fetch('/api/transcripts');
  const data = await resp.json();
  return data.transcripts;
}

export async function fetchTranscript(id: string): Promise<Transcript> {
  const resp = await fetch(`/api/transcripts/${id}`);
  if (!resp.ok) throw new Error('Transcript not found');
  return resp.json();
}

export async function deleteTranscript(id: string): Promise<void> {
  await fetch(`/api/transcripts/${id}`, { method: 'DELETE' });
}

export async function uploadRecording(transcriptId: string, blob: Blob): Promise<void> {
  const formData = new FormData();
  formData.append('file', blob, 'recording.webm');
  const resp = await fetch(`/api/recordings/${transcriptId}`, {
    method: 'POST',
    body: formData,
  });
  if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
}

export async function summarizeText(text: string): Promise<string> {
  const resp = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.detail || `Error ${resp.status}`);
  }
  const data = await resp.json();
  return data.summary;
}

export async function getModelSize(): Promise<string> {
  const resp = await fetch('/api/settings/model');
  const data = await resp.json();
  return data.size;
}

export async function setModelSize(size: string): Promise<void> {
  await fetch('/api/settings/model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ size }),
  });
}

export async function cancelJob(jobId: string): Promise<void> {
  await fetch(`/api/transcribe/cancel/${jobId}`, { method: 'POST' });
}

export async function retranscribe(
  transcriptId: string,
  lang: string | null
): Promise<{ transcriptId: string; segments: Array<{ text: string; start: number; end: number }> }> {
  const resp = await fetch('/api/transcribe/retranscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript_id: transcriptId, lang }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.detail || `Error ${resp.status}`);
  }
  return resp.json();
}
