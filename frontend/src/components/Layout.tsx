import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useRouter, type ActiveView } from '../hooks/useRouter';

interface Props {
  children: (activeView: ActiveView, selectedTranscriptId: string | null) => ReactNode;
}

export type { ActiveView };

export function Layout({ children }: Props) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Navigation sidebar"
        className={`
          fixed inset-y-0 left-0 z-30 w-[280px] bg-bg-secondary border-r border-bg-tertiary
          transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0 md:flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar
          selectedId={router.selectedTranscriptId}
          activeView={router.activeView}
          onSelectTranscript={router.selectTranscript}
          onNewRecording={router.goToRecording}
          onNewUpload={router.goToUpload}
          onCloseMobile={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-bg-primary border-b border-bg-tertiary md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-medium text-text-primary">Hearnote</span>
        </div>

        <div className="max-w-[700px] mx-auto px-6 py-6">
          {children(router.activeView, router.selectedTranscriptId)}
        </div>
      </main>
    </div>
  );
}
