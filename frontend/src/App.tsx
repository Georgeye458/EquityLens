import { Routes, Route } from 'react-router-dom'
import { DocumentProvider } from './context/DocumentContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import DocumentPage from './pages/DocumentPage'
import AnalysisPage from './pages/AnalysisPage'
import ChatPage from './pages/ChatPage'
import MultiDocChatPage from './pages/MultiDocChatPage'

function App() {
  return (
    <DocumentProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route path="/documents/:id/analysis" element={<AnalysisPage />} />
          <Route path="/documents/:id/chat" element={<ChatPage />} />
          <Route path="/chat" element={<MultiDocChatPage />} />
        </Routes>
      </Layout>
    </DocumentProvider>
  )
}

export default App
