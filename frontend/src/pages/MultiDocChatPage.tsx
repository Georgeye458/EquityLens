import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PlusIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useDocuments } from '../context/DocumentContext';
import { useChat } from '../hooks/useChat';
import ChatInterface from '../components/ChatInterface';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Document } from '../types';

export default function MultiDocChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { documents, fetchDocuments } = useDocuments();
  const {
    session,
    messages,
    isLoading,
    isSending,
    error,
    createSession,
    sendMessage,
    clearError,
  } = useChat();

  const [selectedModel, setSelectedModel] = useState('llama-4');
  const [isInitialized, setIsInitialized] = useState(false);

  // Parse document IDs from URL
  const documentIds = useMemo(() => {
    const docsParam = searchParams.get('documents');
    if (!docsParam) return [];
    return docsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  }, [searchParams]);

  // Get document details
  const selectedDocs = useMemo(() => {
    return documentIds
      .map(id => documents.find(d => d.id === id))
      .filter((d): d is Document => d !== undefined);
  }, [documentIds, documents]);

  // Fetch documents if needed
  useEffect(() => {
    if (documents.length === 0) {
      fetchDocuments();
    }
  }, [documents.length, fetchDocuments]);

  // Create session when documents are loaded
  useEffect(() => {
    if (!isInitialized && documentIds.length > 0 && selectedDocs.length === documentIds.length) {
      setIsInitialized(true);
      createSession(documentIds);
    }
  }, [isInitialized, documentIds, selectedDocs.length, createSession]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content, selectedModel);
  };

  const handleNewSession = async () => {
    if (documentIds.length > 0) {
      await createSession(documentIds);
    }
  };

  // Build document names for display
  const documentNames = selectedDocs
    .map(d => d.company_ticker || d.company_name)
    .join(', ');

  if (documentIds.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">No documents selected</h2>
        <p className="text-gray-500 mb-4">
          Select documents from the home page to start a multi-document chat.
        </p>
        <Link to="/" className="btn-primary">
          Go to Documents
        </Link>
      </div>
    );
  }

  if (selectedDocs.length === 0 && documents.length === 0) {
    return <LoadingSpinner message="Loading documents..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Documents
        </button>
      </div>

      {/* Document info and controls */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Multi-Document Chat
            </h1>
            <p className="text-sm text-gray-500">
              Chatting with {selectedDocs.length} documents: {documentNames}
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

      {/* Selected documents */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents in this chat:</h3>
        <div className="flex flex-wrap gap-2">
          {selectedDocs.map(doc => (
            <div
              key={doc.id}
              className="flex items-center px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm"
            >
              <DocumentTextIcon className="w-4 h-4 mr-1.5" />
              {doc.company_ticker || doc.company_name}
              {doc.reporting_period && (
                <span className="ml-1 text-primary-500">({doc.reporting_period})</span>
              )}
            </div>
          ))}
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
        <LoadingSpinner message="Starting chat session..." />
      ) : (
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isSending}
          documentName={documentNames}
        />
      )}

      {/* Info panel */}
      <div className="card p-4 bg-primary-50 border-primary-100">
        <h3 className="text-sm font-semibold text-primary-900 mb-2">
          Cross-Document Analysis
        </h3>
        <p className="text-sm text-primary-700">
          You can compare data across all selected documents. Ask questions like:
          "Compare revenue growth between these companies" or "Which company has the highest profit margin?"
          Responses will cite the specific document and page for each piece of information.
        </p>
      </div>
    </div>
  );
}
