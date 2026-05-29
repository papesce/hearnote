import { useState, useMemo } from 'react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { uploadRecording } from '../api/client';
import { TranscriptView } from './TranscriptView';
import { SummaryPanel } from './SummaryPanel';
import { AudioPlayer } from './AudioPlayer';
import { SettingsBar } from './SettingsBar';
import { WaveformVisualizer } from './WaveformVisualizer';

export function LiveRecording() {
  const { devices, error: deviceError } = useAudioDevices();
  const [selectedDevice, setSelectedDevice] = useState('');
  const [lang, setLang] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const ws = useWebSocket();
  const { recordingBlob, startRecording, stopRecording } = useMediaRecorder();

  const recordingUrl = useMemo(() => {
    if (recordingBlob) return URL.createObjectURL(recordingBlob);
    return null;
  }, [recordingBlob]);

  const handleStart = async () => {
    try {
      const stream = await ws.start(selectedDevice || undefined, lang || undefined);
      startRecording(stream);
    } catch (err) {
      setSaveStatus((err as Error).message);
    }
  };

  const handleStop = async () => {
    const transcriptId = await ws.stop();
    const blob = await stopRecording();

    if (blob && transcriptId) {
      setSaveStatus('Saving recording...');
      try {
        await uploadRecording(transcriptId, blob);
        setSaveStatus('Recording saved.');
      } catch (err) {
        setSaveStatus(`Save failed: ${(err as Error).message}`);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {devices.length > 0 && (
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="bg-bg-tertiary text-text-primary border border-bg-tertiary rounded px-2 py-1.5 text-sm max-w-[200px]"
            >
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
          )}

          {!ws.isRecording ? (
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded font-medium text-sm transition-colors"
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-error hover:bg-error/80 text-white rounded font-medium text-sm transition-colors"
            >
              Stop
            </button>
          )}
        </div>

        <SettingsBar lang={lang} onLangChange={setLang} />
      </div>

      {deviceError && (
        <p className="text-error text-sm">{deviceError}</p>
      )}

      {ws.status === 'recording' && (
        <div className="animate-fade-in-up">
          <WaveformVisualizer
            audioContext={ws.audioContextRef.current}
            stream={ws.streamRef.current}
            isActive={ws.isRecording}
          />
        </div>
      )}

      {ws.status === 'stopping' && (
        <p className="text-text-secondary text-sm">Stopping...</p>
      )}

      {saveStatus && ws.status === 'done' && (
        <p className="text-sm animate-fade-in">
          {saveStatus.includes('saved') ? (
            <span className="text-success">{saveStatus}</span>
          ) : saveStatus.includes('fail') || saveStatus.includes('error') ? (
            <span className="text-error">{saveStatus}</span>
          ) : (
            <span className="text-text-secondary">{saveStatus}</span>
          )}
        </p>
      )}

      <TranscriptView
        text={ws.transcript}
        placeholder="Start recording to see live transcription..."
      />

      {recordingUrl && ws.status === 'done' && (
        <AudioPlayer src={recordingUrl} downloadFilename="recording.webm" />
      )}

      <SummaryPanel getTranscriptText={() => ws.transcript.join(' ')} />
    </div>
  );
}
