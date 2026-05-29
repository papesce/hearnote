import { useRef, useState, useCallback } from 'react';

export function useWebSocket() {
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'recording' | 'stopping' | 'done'>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBufferRef = useRef<number[]>([]);
  const transcriptIdRef = useRef<string | null>(null);
  const resolveStopRef = useRef<(() => void) | null>(null);
  const transcriptRef = useRef<string[]>([]);

  const start = useCallback(async (deviceId?: string, lang?: string) => {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } as MediaTrackConstraints,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    audioBufferRef.current = [];

    const samplesPerChunk = 16000 * 4;

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      audioBufferRef.current.push(...input);

      if (audioBufferRef.current.length >= samplesPerChunk) {
        const chunk = new Float32Array(audioBufferRef.current.splice(0, samplesPerChunk));
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(chunk.buffer);
        }
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const langParam = lang ? `?lang=${lang}` : '';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/transcribe${langParam}`);
    wsRef.current = ws;

    transcriptIdRef.current = crypto.randomUUID();
    setTranscript([]);
    transcriptRef.current = [];

    return new Promise<MediaStream>((resolve, reject) => {
      ws.onopen = () => {
        setIsRecording(true);
        setStatus('recording');
        resolve(stream);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'stopped') {
          if (resolveStopRef.current) resolveStopRef.current();
          ws.close();
          wsRef.current = null;
          return;
        }
        if (data.text) {
          transcriptRef.current = [...transcriptRef.current, data.text];
          setTranscript(transcriptRef.current);
        }
      };

      ws.onerror = () => {
        setStatus('idle');
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    });
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    setIsRecording(false);
    setStatus('stopping');

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    const transcriptId = transcriptIdRef.current;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const stopPromise = new Promise<void>((resolve) => {
        resolveStopRef.current = resolve;
        setTimeout(() => {
          if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
          resolve();
        }, 5000);
      });

      const fullText = transcriptRef.current.join(' ');
      wsRef.current.send(JSON.stringify({
        action: 'stop',
        transcriptId,
        fullText,
      }));

      await stopPromise;
    } else {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    setStatus('done');
    return transcriptId;
  }, []);

  const reset = useCallback(() => {
    setTranscript([]);
    transcriptRef.current = [];
    setStatus('idle');
    transcriptIdRef.current = null;
  }, []);

  return {
    transcript,
    isRecording,
    status,
    transcriptId: transcriptIdRef.current,
    start,
    stop,
    reset,
    audioContextRef,
    streamRef,
  };
}
