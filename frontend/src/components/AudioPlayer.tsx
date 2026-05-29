import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

interface Props {
  src: string;
  downloadFilename?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export interface AudioPlayerHandle {
  seek: (time: number) => void;
  play: () => void;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(
  function AudioPlayer({ src, downloadFilename, onTimeUpdate }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useImperativeHandle(ref, () => ({
      seek(time: number) {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
          audioRef.current.play();
          setPlaying(true);
        }
      },
      play() {
        if (audioRef.current) {
          audioRef.current.play();
          setPlaying(true);
        }
      },
    }));

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const handleTime = () => {
        setCurrentTime(audio.currentTime);
        onTimeUpdate?.(audio.currentTime);
      };
      const handleDuration = () => setDuration(audio.duration || 0);
      audio.addEventListener('timeupdate', handleTime);
      audio.addEventListener('loadedmetadata', handleDuration);
      return () => {
        audio.removeEventListener('timeupdate', handleTime);
        audio.removeEventListener('loadedmetadata', handleDuration);
      };
    }, [onTimeUpdate]);

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

    const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = ratio * duration;
    };

    const formatTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
      <div className="flex items-center gap-3">
        <audio
          ref={audioRef}
          src={src}
          onEnded={() => setPlaying(false)}
        />
        <button
          onClick={toggle}
          className="flex items-center justify-center w-8 h-8 bg-bg-tertiary hover:bg-accent/20 text-text-primary rounded-full text-sm transition-colors flex-shrink-0"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xs text-text-secondary font-mono w-[36px] text-right flex-shrink-0">
            {formatTime(currentTime)}
          </span>
          <div
            className="flex-1 h-1.5 bg-bg-tertiary rounded-full cursor-pointer relative"
            onClick={handleScrub}
          >
            <div
              className="absolute inset-y-0 left-0 bg-accent rounded-full transition-[width] duration-100"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs text-text-secondary font-mono w-[36px] flex-shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        {downloadFilename && (
          <a
            href={src}
            download={downloadFilename}
            className="flex items-center justify-center w-8 h-8 bg-bg-tertiary hover:bg-accent/20 text-text-primary rounded-full text-sm transition-colors flex-shrink-0 no-underline"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
        )}
      </div>
    );
  }
);
