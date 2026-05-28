import { useState, useRef, useCallback } from 'react';
import { useTranscription } from '../hooks/useTranscription';
import { TranscriptView } from './TranscriptView';
import { SummaryPanel } from './SummaryPanel';
import { AudioPlayer } from './AudioPlayer';
import { LANGUAGES } from './SettingsBar';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcription = useTranscription();

  const fileUrl = file ? URL.createObjectURL(file) : null;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleUpload = () => {
    if (!file) return;
    transcription.startUpload(file, lang || undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          Language
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-bg-tertiary text-text-primary border border-bg-tertiary rounded px-2 py-1 text-sm"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-accent bg-accent/10' : 'border-bg-tertiary hover:border-text-secondary'}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
        <svg className="mx-auto mb-2 text-text-secondary" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-text-secondary text-sm">
          {file ? file.name : 'Drop audio/video file here or click to browse'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || transcription.status === 'processing'}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Transcribe
        </button>

        {transcription.status === 'processing' && (
          <button
            onClick={transcription.cancel}
            className="px-4 py-2 bg-error/20 hover:bg-error/30 text-error rounded font-medium text-sm transition-colors"
          >
            Cancel
          </button>
        )}

        {file && transcription.status === 'idle' && (
          <AudioPlayer src={fileUrl!} />
        )}
      </div>

      {transcription.status === 'processing' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>{transcription.segments.length} segments</span>
            <span>{formatElapsed(transcription.elapsed)}</span>
          </div>
          <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${transcription.progress}%` }}
            />
          </div>
        </div>
      )}

      {transcription.status === 'cancelled' && (
        <p className="text-warning text-sm">
          Cancelled — {transcription.segments.length} segments transcribed before stopping.
        </p>
      )}

      {transcription.status === 'error' && (
        <p className="text-error text-sm">{transcription.error}</p>
      )}

      {(transcription.status === 'done' || transcription.status === 'processing') && transcription.segments.length > 0 && (
        <TranscriptView segments={transcription.segments} />
      )}

      {transcription.status === 'done' && transcription.transcriptId && (
        <AudioPlayer
          src={`/api/recordings/${transcription.transcriptId}`}
          downloadFilename={`${transcription.transcriptId}.webm`}
        />
      )}

      {transcription.segments.length > 0 && (
        <SummaryPanel
          getTranscriptText={() => transcription.segments.map(s => s.text).join(' ')}
        />
      )}
    </div>
  );
}
