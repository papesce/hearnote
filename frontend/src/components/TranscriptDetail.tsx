import { useState, useEffect, useRef, useCallback } from 'react';
import type { Transcript } from '../types';
import { fetchTranscript, retranscribe } from '../api/client';
import { TranscriptView } from './TranscriptView';
import { SummaryPanel } from './SummaryPanel';
import { AudioPlayer, type AudioPlayerHandle } from './AudioPlayer';
import { LANGUAGES } from './SettingsBar';

interface Props {
  transcriptId: string;
}

export function TranscriptDetail({ transcriptId }: Props) {
  const [detail, setDetail] = useState<Transcript | null>(null);
  const [retranscribeLang, setRetranscribeLang] = useState('');
  const [retranscribeStatus, setRetranscribeStatus] = useState('');
  const [showRetranscribe, setShowRetranscribe] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<AudioPlayerHandle>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchTranscript(transcriptId);
      if (!cancelled) {
        setDetail(data);
        setShowRetranscribe(false);
        setRetranscribeStatus('');
        setCurrentTime(0);
      }
    })();
    return () => { cancelled = true; };
  }, [transcriptId]);

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seek(time);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleRetranscribe = async () => {
    if (!detail) return;
    setRetranscribeStatus('Re-transcribing with medium model...');
    try {
      const result = await retranscribe(detail.id, retranscribeLang || null);
      setRetranscribeStatus(`Done! ${result.segments.length} segments.`);
      setShowRetranscribe(false);
      const data = await fetchTranscript(result.transcriptId);
      setDetail(data);
    } catch (err) {
      setRetranscribeStatus(`Error: ${(err as Error).message}`);
    }
  };

  if (!detail) {
    return <p className="text-text-secondary text-sm">Loading...</p>;
  }

  const hasRecording = detail.has_recording || !!detail.recording_ref;

  return (
    <div className="space-y-4">
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
          ref={playerRef}
          src={`/api/recordings/${detail.id}`}
          downloadFilename={`${detail.id}.webm`}
          onTimeUpdate={handleTimeUpdate}
        />
      )}

      <TranscriptView
        segments={detail.segments ?? undefined}
        text={!detail.segments ? [detail.text] : undefined}
        currentTime={hasRecording ? currentTime : undefined}
        onSeek={hasRecording ? handleSeek : undefined}
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
