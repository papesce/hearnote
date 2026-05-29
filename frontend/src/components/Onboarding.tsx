import { useState, useEffect } from 'react';

const STORAGE_KEY = 'hearnote-onboarded';

export function Onboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative bg-bg-secondary border border-bg-tertiary rounded-2xl p-8 max-w-md w-full animate-scale-in shadow-2xl">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-text-primary text-center mb-2">
          Welcome to Hearnote
        </h2>
        <p className="text-text-secondary text-sm text-center mb-6">
          Transcribe meetings, lectures, and conversations locally with AI.
        </p>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-accent">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Record or upload</p>
              <p className="text-xs text-text-secondary">Hit Record to capture live audio, or drag in an audio/video file.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-accent">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Get your transcript</p>
              <p className="text-xs text-text-secondary">Whisper AI transcribes locally — nothing leaves your machine.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-accent">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Summarize & search</p>
              <p className="text-xs text-text-secondary">AI-powered summaries extract key decisions and action items. All transcripts are searchable.</p>
            </div>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          Get started
        </button>
      </div>
    </div>
  );
}
