import { useMemo } from 'react';
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
}

export function TranscriptView({ text, segments, placeholder = 'Transcript will appear here...' }: Props) {
  const wordCount = useMemo(() => {
    if (segments?.length) {
      return segments.reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0);
    }
    if (text?.length) {
      return text.join(' ').split(/\s+/).filter(Boolean).length;
    }
    return 0;
  }, [text, segments]);

  const hasContent = (text && text.length > 0) || (segments && segments.length > 0);

  return (
    <div className="relative">
      <div className="bg-bg-secondary rounded-lg p-4 max-h-[500px] overflow-y-auto min-h-[120px] text-left">
        {!hasContent && (
          <p className="text-text-secondary italic">{placeholder}</p>
        )}
        {segments?.map((seg, i) => (
          <div key={i} className="mb-2">
            <span className="text-accent text-xs font-mono mr-2">{formatTime(seg.start)}</span>
            <span>{seg.text}</span>
          </div>
        ))}
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
