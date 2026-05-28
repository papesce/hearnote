import { Layout } from './components/Layout';
import { LiveRecording } from './components/LiveRecording';
import { FileUpload } from './components/FileUpload';
import { History } from './components/History';

function App() {
  return (
    <Layout>
      {(activeTab) => (
        <>
          {activeTab === 'live' && <LiveRecording />}
          {activeTab === 'upload' && <FileUpload />}
          {activeTab === 'history' && <History />}
        </>
      )}
    </Layout>
  );
}

export default App;
