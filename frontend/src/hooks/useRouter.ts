import { useState, useEffect, useCallback } from 'react';

export type ActiveView = 'live' | 'upload' | 'detail';

interface RouterState {
  activeView: ActiveView;
  selectedTranscriptId: string | null;
}

function parseLocation(): RouterState {
  const path = window.location.pathname;
  if (path === '/upload') return { activeView: 'upload', selectedTranscriptId: null };
  if (path.startsWith('/transcript/')) {
    const id = path.slice('/transcript/'.length);
    if (id) return { activeView: 'detail', selectedTranscriptId: id };
  }
  return { activeView: 'live', selectedTranscriptId: null };
}

function toPath(state: RouterState): string {
  if (state.activeView === 'upload') return '/upload';
  if (state.activeView === 'detail' && state.selectedTranscriptId) {
    return `/transcript/${state.selectedTranscriptId}`;
  }
  return '/record';
}

export function useRouter() {
  const [state, setState] = useState<RouterState>(parseLocation);

  useEffect(() => {
    const handlePop = () => setState(parseLocation());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((newState: RouterState) => {
    const path = toPath(newState);
    if (path !== window.location.pathname) {
      window.history.pushState(null, '', path);
    }
    setState(newState);
  }, []);

  const selectTranscript = useCallback((id: string) => {
    navigate({ activeView: 'detail', selectedTranscriptId: id });
  }, [navigate]);

  const goToRecording = useCallback(() => {
    navigate({ activeView: 'live', selectedTranscriptId: null });
  }, [navigate]);

  const goToUpload = useCallback(() => {
    navigate({ activeView: 'upload', selectedTranscriptId: null });
  }, [navigate]);

  return {
    activeView: state.activeView,
    selectedTranscriptId: state.selectedTranscriptId,
    selectTranscript,
    goToRecording,
    goToUpload,
  };
}
