import { useState, useRef, useEffect } from 'react';
import type { Segment } from '../types';
import { exportTxt, exportSrt, exportVtt, exportMarkdown, downloadFile } from '../utils/export';

interface Props {
  segments: Segment[] | null;
  text: string;
  filename?: string;
}

export function ExportMenu({ segments, text, filename }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const baseName = filename?.replace(/\.[^.]+$/, '') || 'transcript';

  const handleTxt = () => {
    downloadFile(exportTxt(segments, text), `${baseName}.txt`, 'text/plain');
    setOpen(false);
  };

  const handleSrt = () => {
    if (!segments) return;
    downloadFile(exportSrt(segments), `${baseName}.srt`, 'application/x-subrip');
    setOpen(false);
  };

  const handleVtt = () => {
    if (!segments) return;
    downloadFile(exportVtt(segments), `${baseName}.vtt`, 'text/vtt');
    setOpen(false);
  };

  const handleMarkdown = () => {
    const md = exportMarkdown(segments, text);
    navigator.clipboard.writeText(md);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary hover:bg-accent/20 text-text-primary rounded-lg text-sm transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {copied ? 'Copied!' : 'Export'}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-bg-secondary border border-bg-tertiary rounded-lg shadow-lg py-1 z-10 min-w-[170px] animate-scale-in">
          <button
            onClick={handleTxt}
            className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            Plain text (.txt)
          </button>
          {segments && (
            <>
              <button
                onClick={handleSrt}
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                Subtitles (.srt)
              </button>
              <button
                onClick={handleVtt}
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                WebVTT (.vtt)
              </button>
            </>
          )}
          <button
            onClick={handleMarkdown}
            className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            Copy as Markdown
          </button>
        </div>
      )}
    </div>
  );
}
