import { useRef, useState } from 'react';

interface Props {
  src: string;
  downloadFilename?: string;
}

export function AudioPlayer({ src, downloadFilename }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setPlaying(true);
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        className="flex items-center gap-1 px-3 py-1.5 bg-bg-tertiary hover:bg-accent/20 text-text-primary rounded text-sm transition-colors"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
        {playing ? 'Pause' : 'Play'}
      </button>
      {downloadFilename && (
        <a
          href={src}
          download={downloadFilename}
          className="flex items-center gap-1 px-3 py-1.5 bg-bg-tertiary hover:bg-accent/20 text-text-primary rounded text-sm transition-colors no-underline"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </a>
      )}
    </div>
  );
}
