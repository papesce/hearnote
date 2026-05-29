import { useState, useRef, useEffect } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleSummarize = async () => {
    const text = getTranscriptText();
    if (!text) return;

    setLoading(true);
    setError(null);
    try {
      const result = await summarizeText(text);
      setSummary(result);
    } catch {
      const text = getTranscriptText();
      navigator.clipboard.writeText(buildSummaryPrompt(text));
      setError('AI unavailable — prompt copied to clipboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    const text = getTranscriptText();
    if (!text) return;
    navigator.clipboard.writeText(buildSummaryPrompt(text));
    setCopied(true);
    setMenuOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySummary = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setMenuOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const text = getTranscriptText();
  if (!text) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSummarize}
          disabled={loading}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Summarizing...
            </span>
          ) : 'Summarize'}
        </button>

        {/* Dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 bg-bg-tertiary hover:bg-accent/20 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full mt-1 bg-bg-secondary border border-bg-tertiary rounded-lg shadow-lg py-1 z-10 min-w-[160px] animate-scale-in">
              <button
                onClick={handleCopyPrompt}
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                Copy as prompt
              </button>
              {summary && (
                <button
                  onClick={handleCopySummary}
                  className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  Copy summary
                </button>
              )}
            </div>
          )}
        </div>

        {copied && (
          <span className="text-xs text-success">Copied!</span>
        )}
      </div>

      {error && (
        <p className="text-warning text-sm">{error}</p>
      )}

      {summary && (
        <div
          className="bg-bg-secondary border border-bg-tertiary p-4 rounded-lg text-left text-sm animate-fade-in-up"
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
