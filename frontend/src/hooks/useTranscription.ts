import { useState, useRef, useCallback } from 'react';
import type { Segment } from '../types';
import { cancelJob } from '../api/client';

interface TranscriptionState {
  segments: Segment[];
  status: 'idle' | 'processing' | 'done' | 'cancelled' | 'error';
  progress: number;
  elapsed: number;
  error: string | null;
  transcriptId: string | null;
}

export function useTranscription() {
  const [state, setState] = useState<TranscriptionState>({
    segments: [],
    status: 'idle',
    progress: 0,
    elapsed: 0,
    error: null,
    transcriptId: null,
  });

  const jobIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startUpload = useCallback(async (file: File, lang?: string) => {
    setState({ segments: [], status: 'processing', progress: 0, elapsed: 0, error: null, transcriptId: null });
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setState(prev => ({ ...prev, elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000) }));
    }, 1000);

    const formData = new FormData();
    formData.append('file', file);

    const langParam = lang ? `?lang=${lang}` : '';

    try {
      const response = await fetch(`/api/transcribe/stream${langParam}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let segments: Segment[] = [];
      let duration: number | null = null;
      let cancelled = false;
      let transcriptId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith('event: cancelled')) {
            cancelled = true;
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.jobId) {
                jobIdRef.current = data.jobId;
              } else if (data.transcriptId) {
                transcriptId = data.transcriptId;
              } else if (data.text) {
                if (!duration && data.duration) duration = data.duration;
                const seg: Segment = { start: data.start, end: data.end, text: data.text };
                segments = [...segments, seg];

                const progress = duration && data.end
                  ? Math.min(100, Math.round((data.end / duration) * 100))
                  : 0;

                setState(prev => ({ ...prev, segments, progress }));
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      jobIdRef.current = null;

      if (cancelled) {
        setState(prev => ({ ...prev, status: 'cancelled', progress: 100 }));
      } else {
        setState(prev => ({ ...prev, status: 'done', progress: 100, transcriptId }));
      }
    } catch (err) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setState(prev => ({ ...prev, status: 'error', error: (err as Error).message }));
    }
  }, []);

  const cancel = useCallback(async () => {
    if (jobIdRef.current) {
      await cancelJob(jobIdRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    jobIdRef.current = null;
    setState({ segments: [], status: 'idle', progress: 0, elapsed: 0, error: null, transcriptId: null });
  }, []);

  return { ...state, startUpload, cancel, reset };
}
