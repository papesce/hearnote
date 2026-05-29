import { useMemo, useRef, useEffect, useState } from 'react';
import type { Segment } from '../types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  text?: string[];
  segments?: Segment[] | null;
  placeholder?: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

export function TranscriptView({ text, segments, placeholder = 'Transcript will appear here...', currentTime, onSeek }: Props) {
  const activeRef = useRef<HTMLDivElement>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const prevCountRef = useRef(0);

  useEffect(() => {
    const count = segments?.length ?? text?.length ?? 0;
    if (count > prevCountRef.current) {
      const latest = segments?.[count - 1]?.text ?? text?.[count - 1];
      if (latest) setLiveAnnouncement(latest);
    }
    prevCountRef.current = count;
  }, [segments, text]);

  const wordCount = useMemo(() => {
    if (segments?.length) {
      return segments.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0);
    }
    if (text?.length) {
      return text.join(' ').split(/\s+/).filter(Boolean).length;
    }
    return 0;
  }, [text, segments]);

  const activeIndex = useMemo(() => {
    if (currentTime == null || !segments?.length) return -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start) return i;
    }
    return -1;
  }, [currentTime, segments]);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  const hasContent = (text && text.length > 0) || (segments && segments.length > 0);

  return (
    <div className="relative">
      {/* Screen reader live region for streaming transcript */}
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {liveAnnouncement}
      </div>
      <div className="bg-bg-secondary rounded-lg p-4 min-h-[120px] text-left" role="log" aria-label="Transcript">
        {!hasContent && (
          <p className="text-text-secondary italic">{placeholder}</p>
        )}
        {segments?.map((seg, i) => {
          const isActive = i === activeIndex;
          const speaker = seg.speaker;
          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={`flex gap-2 py-1.5 px-2 -mx-2 rounded transition-colors
                ${isActive ? 'bg-accent/10' : ''}
              `}
            >
              <button
                onClick={() => onSeek?.(seg.start)}
                disabled={!onSeek}
                className={`text-xs font-mono flex-shrink-0 pt-0.5 transition-colors
                  ${onSeek ? 'text-text-secondary hover:text-accent cursor-pointer' : 'text-text-secondary cursor-default'}
                `}
              >
                {formatTime(seg.start)}
              </button>
              <div className="min-w-0">
                {speaker && (
                  <span className="text-xs font-medium text-text-secondary mr-1.5">{speaker}:</span>
                )}
                <span className="text-text-primary">{seg.text}</span>
              </div>
            </div>
          );
        })}
        {!segments && text?.map((chunk, i) => (
          <span key={i}>{chunk} </span>
        ))}
      </div>
      {hasContent && (
        <div className="flex justify-between items-center mt-1 px-1">
          <span className="text-xs text-text-secondary">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
          <button
            onClick={() => {
              const content = segments
                ? segments.map(s => s.text).join(' ')
                : text?.join(' ') || '';
              navigator.clipboard.writeText(content);
            }}
            className="text-xs text-text-secondary hover:text-accent transition-colors"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

export { formatTime };
