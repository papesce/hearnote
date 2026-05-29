import { useRef } from 'react';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';

interface WaveformVisualizerProps {
  audioContext: AudioContext | null;
  stream: MediaStream | null;
  isActive: boolean;
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function WaveformVisualizer({ audioContext, stream, isActive }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { elapsedSeconds } = useAudioVisualizer({
    audioContext, stream, canvasRef, isActive,
  });

  return (
    <div className="flex items-center gap-3 bg-bg-secondary rounded-lg p-3">
      <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse-recording flex-shrink-0" />
      <canvas
        ref={canvasRef}
        className="flex-1 rounded"
        style={{ height: '64px', display: 'block' }}
      />
      <span className="text-text-secondary text-sm font-mono flex-shrink-0 min-w-[48px] text-right">
        {formatElapsed(elapsedSeconds)}
      </span>
    </div>
  );
}
