import { Layout } from './components/Layout';
import { LiveRecording } from './components/LiveRecording';
import { FileUpload } from './components/FileUpload';
import { TranscriptDetail } from './components/TranscriptDetail';

function App() {
  return (
    <Layout>
      {(activeView, selectedTranscriptId) => (
        <>
          {activeView === 'live' && <LiveRecording />}
          {activeView === 'upload' && <FileUpload />}
          {activeView === 'detail' && selectedTranscriptId && (
            <TranscriptDetail transcriptId={selectedTranscriptId} />
          )}
        </>
      )}
    </Layout>
  );
}

export default App;
