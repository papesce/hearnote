import type { Segment } from '../types';

function pad(n: number, digits = 2): string {
  return n.toString().padStart(digits, '0');
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function formatSimpleTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${pad(s)}`;
}

export function exportTxt(segments: Segment[] | null, text: string): string {
  if (segments?.length) {
    return segments
      .map(s => `[${formatSimpleTime(s.start)}] ${s.text}`)
      .join('\n');
  }
  return text;
}

export function exportSrt(segments: Segment[]): string {
  return segments
    .map((s, i) => [
      `${i + 1}`,
      `${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}`,
      s.text,
      '',
    ].join('\n'))
    .join('\n');
}

export function exportVtt(segments: Segment[]): string {
  const lines = ['WEBVTT', ''];
  for (const s of segments) {
    lines.push(`${formatVttTime(s.start)} --> ${formatVttTime(s.end)}`);
    lines.push(s.text);
    lines.push('');
  }
  return lines.join('\n');
}

export function exportMarkdown(segments: Segment[] | null, text: string): string {
  if (segments?.length) {
    return segments
      .map(s => `**[${formatSimpleTime(s.start)}]** ${s.text}`)
      .join('\n\n');
  }
  return text;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
