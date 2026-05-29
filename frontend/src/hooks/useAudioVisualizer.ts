import { useEffect, useRef, useState, type RefObject } from 'react';

interface UseAudioVisualizerOptions {
  audioContext: AudioContext | null;
  stream: MediaStream | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
}

const FFT_SIZE = 256;
const BIN_COUNT = FFT_SIZE / 2;
const BAR_COUNT = 48;
const SMOOTHING = 0.8;
const ACCENT = '#6c63ff';
const BG = '#0f1117';

function drawBars(ctx: CanvasRenderingContext2D, dataArray: Uint8Array, width: number, height: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  const centerY = height / 2;
  const barWidth = width / BAR_COUNT;
  const gap = 2;

  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 6;

  for (let i = 0; i < BAR_COUNT; i++) {
    const value = dataArray[i] / 255;
    const barHeight = value * centerY * 0.9;

    const x = i * barWidth + gap / 2;
    const w = barWidth - gap;

    const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY);
    gradient.addColorStop(0, 'rgba(108, 99, 255, 0.3)');
    gradient.addColorStop(1, ACCENT);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, centerY - barHeight, w, barHeight);

    const gradientBottom = ctx.createLinearGradient(0, centerY, 0, centerY + barHeight);
    gradientBottom.addColorStop(0, ACCENT);
    gradientBottom.addColorStop(1, 'rgba(108, 99, 255, 0.3)');
    ctx.fillStyle = gradientBottom;
    ctx.fillRect(x, centerY, w, barHeight);
  }

  ctx.shadowBlur = 0;
}

export function useAudioVisualizer({ audioContext, stream, canvasRef, isActive }: UseAudioVisualizerOptions) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!isActive || !audioContext || !stream || !canvasRef.current) return;
    if (audioContext.state === 'closed') return;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    source.connect(analyser);

    sourceRef.current = source;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(BIN_COUNT);
    const canvas = canvasRef.current;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    function animate() {
      analyser.getByteFrequencyData(dataArray);
      drawBars(ctx, dataArray, rect.width, rect.height);
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      try { source.disconnect(); } catch {}
      sourceRef.current = null;
      analyserRef.current = null;
    };
  }, [isActive, audioContext, stream, canvasRef]);

  useEffect(() => {
    if (!isActive) {
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    setElapsedSeconds(0);
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isActive]);

  return { elapsedSeconds };
}
