import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ChartBarIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useDocuments } from '../context/DocumentContext';
import { useChat } from '../hooks/useChat';
import ChatInterface from '../components/ChatInterface';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDocument, selectDocument } = useDocuments();
  const {
    session,
    messages,
    isLoading,
    isSending,
    error,
    createSession,
    loadDocumentSessions,
    sendMessage,
    clearError,
  } = useChat();

  const [selectedModel, setSelectedModel] = useState('llama-4');

  useEffect(() => {
    if (id) {
      const documentId = parseInt(id);
      selectDocument(documentId);
      
      // Load existing sessions or create a new one
      loadDocumentSessions(documentId).then((sessions) => {
        if (sessions.length === 0) {
          createSession(documentId);
        }
      });
    }
  }, [id, selectDocument, loadDocumentSessions, createSession]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content, selectedModel);
  };

  const handleNewSession = async () => {
    if (id) {
      await createSession(parseInt(id));
    }
  };

  if (!selectedDocument) {
    return <LoadingSpinner message="Loading document..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/documents/${id}`)}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Document
        </button>

        <div className="flex items-center space-x-3">
          <Link
            to={`/documents/${id}/analysis`}
            className="btn-secondary flex items-center"
          >
            <ChartBarIcon className="w-4 h-4 mr-2" />
            View Analysis
          </Link>
        </div>
      </div>

      {/* Document info and controls */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Chat: {selectedDocument.company_name}
            </h1>
            <p className="text-sm text-gray-500">
              Ask questions about the full document content • {selectedDocument.page_count} pages
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input text-sm"
            >
              <option value="llama-4">Llama 4 (Fast)</option>
              <option value="deepseek-v3.1">DeepSeek V3.1 (Detailed)</option>
              <option value="gpt-oss-120b">GPT OSS 120B</option>
              <option value="magpie">Magpie (AU Sovereign)</option>
            </select>
            
            <button
              onClick={handleNewSession}
              className="btn-secondary flex items-center"
              disabled={isLoading}
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              New Chat
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {/* Chat interface */}
      {isLoading && !session ? (
        <LoadingSpinner message="Loading chat..." />
      ) : (
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isSending}
          documentName={selectedDocument.company_name}
        />
      )}

      {/* Info panel */}
      <div className="card p-4 bg-primary-50 border-primary-100">
        <h3 className="text-sm font-semibold text-primary-900 mb-2">
          Full Document Access
        </h3>
        <p className="text-sm text-primary-700">
          Unlike traditional POI extraction, this chat has access to the entire document content.
          Ask detailed questions about any section, and responses will include page citations for verification.
        </p>
      </div>
    </div>
  );
}
