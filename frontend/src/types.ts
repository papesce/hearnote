export interface Segment {
  start: number;
  end: number;
  text: string;
  duration?: number;
  speaker?: string;
}

export interface Transcript {
  id: string;
  timestamp: string;
  source: 'live' | 'upload' | 'retranscribe';
  text: string;
  segments: Segment[] | null;
  filename: string | null;
  has_recording: boolean;
  recording_ref?: string;
  recording_ext?: string;
}

export interface TranscriptListItem {
  id: string;
  timestamp: string;
  source: string;
  filename: string | null;
  preview: string;
  has_recording: boolean;
  duration_seconds: number | null;
  word_count: number;
}
