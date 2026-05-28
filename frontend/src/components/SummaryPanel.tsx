import { useState } from 'react';
import { summarizeText } from '../api/client';

function buildSummaryPrompt(transcript: string): string {
  return `Summarize this meeting transcript. Please extract and format clearly:

## Key Decisions
- List each decision made during the meeting

## Action Items
- List each action item with the owner (if mentioned) and deadline (if mentioned)

## Open Questions
- List any unresolved questions or topics needing follow-up

## Brief Summary
- 2-3 sentence overview of what was discussed

Be concise and professional.

---
TRANSCRIPT:
${transcript}`;
}

interface Props {
  getTranscriptText: () => string;
}

export function SummaryPanel({ getTranscriptText }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSummarize = async () => {
    const text = getTranscriptText();
    if (!text) return;

    setLoading(true);
    setError(null);
    try {
      const result = await summarizeText(text);
      setSummary(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    const text = getTranscriptText();
    if (!text) return;
    navigator.clipboard.writeText(buildSummaryPrompt(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const text = getTranscriptText();
  if (!text) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleSummarize}
          disabled={loading}
          className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Summarizing...' : 'Summarize with AI'}
        </button>
        <button
          onClick={handleCopyPrompt}
          className="px-3 py-1.5 bg-bg-tertiary hover:bg-accent/20 text-text-primary rounded text-sm transition-colors"
        >
          {copied ? 'Copied!' : 'Copy prompt'}
        </button>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="px-3 py-1.5 bg-bg-tertiary hover:bg-accent/20 text-text-primary rounded text-sm transition-colors"
        >
          {showPrompt ? 'Hide prompt' : 'Preview prompt'}
        </button>
      </div>

      {showPrompt && (
        <pre className="bg-bg-tertiary p-3 rounded text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap">
          {buildSummaryPrompt(text)}
        </pre>
      )}

      {error && (
        <p className="text-error text-sm">{error}</p>
      )}

      {summary && (
        <div
          className="bg-bg-secondary p-4 rounded-lg text-left text-sm prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: formatSummary(summary) }}
        />
      )}
    </div>
  );
}

function formatSummary(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h3 class="text-accent text-base font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-0.5">$1</li>')
    .split('\n')
    .map(line => {
      if (line.startsWith('<h3') || line.startsWith('<li')) return line;
      if (line.trim() === '') return '';
      return `<p class="mb-1">${line}</p>`;
    })
    .join('\n');
}
