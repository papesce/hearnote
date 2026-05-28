import { useState, type ReactNode } from 'react';

type Tab = 'live' | 'upload' | 'history';

interface Props {
  children: (activeTab: Tab) => ReactNode;
}

export function Layout({ children }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('live');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'live', label: 'Live Recording' },
    { id: 'upload', label: 'Upload File' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6 min-h-screen">
      <header className="flex items-center gap-3 mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <h1 className="text-xl font-semibold text-text-primary">Hearnote</h1>
      </header>

      <nav className="flex border-b border-bg-tertiary mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'text-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {children(activeTab)}
      </main>
    </div>
  );
}
