import { useState, useEffect, useCallback } from 'react';
import type { TranscriptListItem, Transcript } from '../types';
import { fetchTranscripts, fetchTranscript, deleteTranscript, retranscribe } from '../api/client';
import { TranscriptView } from './TranscriptView';
import { SummaryPanel } from './SummaryPanel';
import { AudioPlayer } from './AudioPlayer';
import { LANGUAGES } from './SettingsBar';

export function History() {
  const [transcripts, setTranscripts] = useState<TranscriptListItem[]>([]);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Transcript | null>(null);
  const [retranscribeLang, setRetranscribeLang] = useState('');
  const [retranscribeStatus, setRetranscribeStatus] = useState('');
  const [showRetranscribe, setShowRetranscribe] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await fetchTranscripts();
      setTranscripts(items);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleView = async (id: string) => {
    const data = await fetchTranscript(id);
    setDetail(data);
    setShowRetranscribe(false);
    setRetranscribeStatus('');
  };

  const handleDelete = async (id: string) => {
    await deleteTranscript(id);
    load();
  };

  const handleRetranscribe = async () => {
    if (!detail) return;
    setRetranscribeStatus('Re-transcribing with medium model...');
    try {
      const result = await retranscribe(detail.id, retranscribeLang || null);
      setRetranscribeStatus(`Done! ${result.segments.length} segments.`);
      setShowRetranscribe(false);
      setTimeout(() => handleView(result.transcriptId), 500);
    } catch (err) {
      setRetranscribeStatus(`Error: ${(err as Error).message}`);
    }
  };

  const filtered = search
    ? transcripts.filter(t =>
        t.preview.toLowerCase().includes(search.toLowerCase()) ||
        (t.filename?.toLowerCase().includes(search.toLowerCase()))
      )
    : transcripts;

  if (detail) {
    const hasRecording = detail.has_recording || !!detail.recording_ref;
    return (
      <div className="space-y-4">
        <button
          onClick={() => setDetail(null)}
          className="text-sm text-text-secondary hover:text-accent transition-colors"
        >
          &larr; Back to list
        </button>

        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className={`px-2 py-0.5 rounded text-xs font-medium
            ${detail.source === 'live' ? 'bg-success/20 text-success' : ''}
            ${detail.source === 'upload' ? 'bg-accent/20 text-accent' : ''}
            ${detail.source === 'retranscribe' ? 'bg-warning/20 text-warning' : ''}
          `}>
            {detail.source}
          </span>
          <span className="text-text-secondary">
            {new Date(detail.timestamp).toLocaleString()}
          </span>
          {detail.filename && (
            <span className="text-text-secondary">{detail.filename}</span>
          )}
        </div>

        {hasRecording && (
          <AudioPlayer
            src={`/api/recordings/${detail.id}`}
            downloadFilename={`${detail.id}.webm`}
          />
        )}

        <TranscriptView
          segments={detail.segments ?? undefined}
          text={!detail.segments ? [detail.text] : undefined}
        />

        {hasRecording && (
          <div className="space-y-2">
            <button
              onClick={() => setShowRetranscribe(!showRetranscribe)}
              className="text-sm text-text-secondary hover:text-accent transition-colors"
            >
              Re-transcribe with different settings
            </button>
            {showRetranscribe && (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={retranscribeLang}
                  onChange={(e) => setRetranscribeLang(e.target.value)}
                  className="bg-bg-tertiary text-text-primary border border-bg-tertiary rounded px-2 py-1 text-sm"
                >
                  {LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleRetranscribe}
                  className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded text-sm transition-colors"
                >
                  Go
                </button>
                {retranscribeStatus && (
                  <span className="text-xs text-text-secondary">{retranscribeStatus}</span>
                )}
              </div>
            )}
          </div>
        )}

        <SummaryPanel
          getTranscriptText={() =>
            detail.segments
              ? detail.segments.map(s => s.text).join(' ')
              : detail.text
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search transcripts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-bg-secondary border border-bg-tertiary rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
      />

      {transcripts.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto mb-3 text-text-secondary" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p className="text-text-secondary">No recordings yet</p>
          <p className="text-text-secondary text-sm mt-1">Record live or upload a file to get started</p>
        </div>
      )}

      {filtered.length === 0 && transcripts.length > 0 && (
        <p className="text-text-secondary text-sm text-center py-8">No results matching your search.</p>
      )}

      {filtered.map(t => (
        <div
          key={t.id}
          className="flex items-start justify-between bg-bg-secondary rounded-lg p-3 hover:bg-bg-tertiary transition-colors cursor-pointer group"
        >
          <div className="flex-1 min-w-0" onClick={() => handleView(t.id)}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium
                ${t.source === 'live' ? 'bg-success/20 text-success' : ''}
                ${t.source === 'upload' ? 'bg-accent/20 text-accent' : ''}
                ${t.source === 'retranscribe' ? 'bg-warning/20 text-warning' : ''}
              `}>
                {t.source}
              </span>
              <span className="text-xs text-text-secondary">
                {new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                {' '}
                {new Date(t.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
              {t.filename && <span className="text-xs text-text-secondary truncate">{t.filename}</span>}
            </div>
            <p className="text-sm text-text-primary truncate">{t.preview}...</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
            className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-error transition-all"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
