import { useState, useEffect, useCallback } from 'react';
import type { TranscriptListItem } from '../types';
import { fetchTranscripts, deleteTranscript } from '../api/client';
import { useTheme } from '../hooks/useTheme';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  selectedId: string | null;
  activeView: 'live' | 'upload' | 'detail';
  onSelectTranscript: (id: string) => void;
  onNewRecording: () => void;
  onNewUpload: () => void;
  onCloseMobile?: () => void;
}

const PINNED_KEY = 'hearnote-pinned';

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function savePinned(ids: Set<string>) {
  localStorage.setItem(PINNED_KEY, JSON.stringify([...ids]));
}

export function Sidebar({ selectedId, activeView, onSelectTranscript, onNewRecording, onNewUpload, onCloseMobile }: Props) {
  const [transcripts, setTranscripts] = useState<TranscriptListItem[]>([]);
  const [search, setSearch] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(loadPinned);
  const { theme, toggle: toggleTheme } = useTheme();

  const load = useCallback(async () => {
    try {
      const items = await fetchTranscripts();
      setTranscripts(items);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteTranscript(id);
    load();
  };

  const handlePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePinned(next);
      return next;
    });
  };

  const handleSelect = (id: string) => {
    onSelectTranscript(id);
    onCloseMobile?.();
  };

  const handleRecord = () => {
    onNewRecording();
    onCloseMobile?.();
  };

  const handleUpload = () => {
    onNewUpload();
    onCloseMobile?.();
  };

  const filtered = search
    ? transcripts.filter(t =>
        t.preview.toLowerCase().includes(search.toLowerCase()) ||
        (t.filename?.toLowerCase().includes(search.toLowerCase()))
      )
    : transcripts;

  const sorted = [...filtered].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent flex-shrink-0">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span className="text-lg font-semibold text-text-primary">Hearnote</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg bg-bg-tertiary hover:bg-accent/20 text-text-secondary hover:text-text-primary transition-colors"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-4 pb-3">
        <button
          onClick={handleRecord}
          aria-label="Start new recording"
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${activeView === 'live' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
          Record
        </button>
        <button
          onClick={handleUpload}
          aria-label="Upload audio file"
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${activeView === 'upload' ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search transcripts"
          className="w-full bg-bg-tertiary border border-bg-tertiary rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary"
        />
      </div>

      {/* Transcript list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4" role="list" aria-label="Transcript history">
        {transcripts.length === 0 && (
          <div className="text-center py-8 px-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <p className="text-text-primary text-sm font-medium mb-1">No recordings yet</p>
            <p className="text-text-secondary text-xs mb-3">Record your first meeting or upload an audio file to get started.</p>
            <button
              onClick={handleRecord}
              className="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
            >
              Start recording
            </button>
          </div>
        )}
        {sorted.length === 0 && transcripts.length > 0 && (
          <p className="text-text-secondary text-xs text-center py-6">No results</p>
        )}
        {sorted.map(t => {
          const isPinned = pinnedIds.has(t.id);
          return (
            <div
              key={t.id}
              role="listitem"
              onClick={() => handleSelect(t.id)}
              className={`px-3 py-2.5 rounded-lg mb-1 cursor-pointer transition-colors group
                ${selectedId === t.id ? 'bg-accent/10 border border-accent/30' : 'hover:bg-bg-tertiary border border-transparent'}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                    ${t.source === 'live' ? 'bg-success' : ''}
                    ${t.source === 'upload' ? 'bg-accent' : ''}
                    ${t.source === 'retranscribe' ? 'bg-warning' : ''}
                  `} aria-label={`Source: ${t.source}`} />
                  <span className="text-xs text-text-secondary">
                    {new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(t.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={(e) => handlePin(e, t.id)}
                    className={`p-1 transition-all rounded ${isPinned ? 'text-warning opacity-100' : 'md:opacity-0 md:group-hover:opacity-100 opacity-70 text-text-secondary hover:text-warning'}`}
                    title={isPinned ? 'Unpin' : 'Pin'}
                    aria-label={isPinned ? 'Unpin transcript' : 'Pin transcript'}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, t.id)}
                    className="md:opacity-0 md:group-hover:opacity-100 opacity-70 p-1 text-text-secondary hover:text-error transition-all rounded"
                    title="Delete transcript"
                    aria-label="Delete transcript"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                    </svg>
                  </button>
                </div>
              </div>
              {t.filename && (
                <p className="text-xs text-text-secondary truncate mb-0.5">{t.filename}</p>
              )}
              <p className="text-xs text-text-primary truncate leading-relaxed mb-1">{t.preview}</p>
              <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                {isPinned && (
                  <span className="text-warning">pinned</span>
                )}
                {t.duration_seconds != null && (
                  <span className="flex items-center gap-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatDuration(t.duration_seconds)}
                  </span>
                )}
                {t.word_count > 0 && (
                  <span>{t.word_count.toLocaleString()} words</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
