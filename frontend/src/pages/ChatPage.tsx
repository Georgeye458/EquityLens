import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Plus,
  FileText,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { useChat } from '../hooks/useChat';
import { chatApi, documentsApi } from '../lib/api';
import ChatInterface from '../components/ChatInterface';
import PDFViewer from '../components/PDFViewer';
import LoadingSpinner from '../components/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CitationDetail } from '../types';

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

  // PDF Viewer state
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [activeCitation, setActiveCitation] = useState<CitationDetail | null>(null);

  // Handle citation click - open PDF viewer at the cited page
  const handleCitationClick = useCallback((citation: CitationDetail) => {
    setActiveCitation(citation);
    setPdfPage(citation.page_number);
    setShowPdfViewer(true);
  }, []);

  // Close PDF viewer
  const handleClosePdfViewer = useCallback(() => {
    setShowPdfViewer(false);
    setActiveCitation(null);
  }, []);

  useEffect(() => {
    if (id) {
      const documentId = parseInt(id);
      selectDocument(documentId);
      
      // Preload cache in background (makes first message instant!)
      chatApi.preloadCache(documentId);
      
      loadDocumentSessions(documentId).then((sessions) => {
        if (sessions.length === 0) {
          createSession(documentId);
        }
      });
    }
  }, [id, selectDocument, loadDocumentSessions, createSession]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleNewSession = async () => {
    if (id) {
      await createSession(parseInt(id));
    }
  };

  if (!selectedDocument) {
    return <LoadingSpinner message="Loading document..." />;
  }

  const pdfUrl = id ? documentsApi.getPdfUrl(parseInt(id)) : '';

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate(`/documents/${id}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Document
        </Button>

        <div className="flex items-center space-x-3">
          {!showPdfViewer && (
            <Button
              variant="outline"
              onClick={() => setShowPdfViewer(true)}
            >
              <FileText className="w-4 h-4 mr-2" />
              View PDF
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/documents/${id}/analysis`}>
              <BarChart3 className="w-4 h-4 mr-2" />
              View Analysis
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleNewSession}
            disabled={isLoading}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Document info */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Chat: {selectedDocument.company_name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {selectedDocument.page_count} pages • Click citations to view source
              </p>
            </div>
            {activeCitation && showPdfViewer && (
              <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                Viewing: {activeCitation.document_name || 'Document'} - Page {activeCitation.page_number}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex justify-between items-center mb-4">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Main content: Chat + PDF Viewer split pane */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Chat panel */}
        <div className={showPdfViewer ? 'w-1/2' : 'w-full'}>
          {isLoading && !session ? (
            <LoadingSpinner message="Loading chat..." />
          ) : (
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isSending}
              documentName={selectedDocument.company_name}
              onCitationClick={handleCitationClick}
            />
          )}
        </div>

        {/* PDF Viewer panel */}
        {showPdfViewer && (
          <div className="w-1/2 relative">
            <PDFViewer
              url={pdfUrl}
              initialPage={pdfPage}
              onClose={handleClosePdfViewer}
              documentName={selectedDocument.filename}
            />
          </div>
        )}
      </div>
    </div>
  );
}
