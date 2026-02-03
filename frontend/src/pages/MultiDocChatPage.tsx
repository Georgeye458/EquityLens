import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  FileText,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { useChat } from '../hooks/useChat';
import { documentsApi } from '../lib/api';
import ChatInterface from '../components/ChatInterface';
import PDFViewer from '../components/PDFViewer';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Document, CitationDetail } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function getDocumentLabel(doc: Document): string {
  const ticker = doc.company_ticker || doc.company_name.slice(0, 3).toUpperCase();
  const parts = [ticker];
  
  if (doc.reporting_period) {
    parts.push(doc.reporting_period);
  }
  
  if (!doc.reporting_period && doc.filename) {
    const fname = doc.filename.toLowerCase();
    if (fname.includes('pillar')) parts.push('Pillar 3');
    else if (fname.includes('update')) parts.push('Update');
    else if (fname.includes('result')) parts.push('Results');
    else if (fname.includes('idp')) parts.push('IDP');
  }
  
  return parts.join(' ');
}

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

  const [isInitialized, setIsInitialized] = useState(false);

  // PDF Viewer state
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [activeCitation, setActiveCitation] = useState<CitationDetail | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);

  // Handle citation click - open PDF viewer at the cited page
  const handleCitationClick = useCallback((citation: CitationDetail) => {
    setActiveCitation(citation);
    setPdfPage(citation.page_number);
    // Use the document_id from the citation if available
    if (citation.document_id) {
      setActiveDocumentId(citation.document_id);
    }
    setShowPdfViewer(true);
  }, []);

  // Close PDF viewer
  const handleClosePdfViewer = useCallback(() => {
    setShowPdfViewer(false);
    setActiveCitation(null);
  }, []);

  const documentIds = useMemo(() => {
    const docsParam = searchParams.get('documents');
    if (!docsParam) return [];
    return docsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  }, [searchParams]);

  const selectedDocs = useMemo(() => {
    return documentIds
      .map(id => documents.find(d => d.id === id))
      .filter((d): d is Document => d !== undefined);
  }, [documentIds, documents]);

  useEffect(() => {
    if (documents.length === 0) {
      fetchDocuments();
    }
  }, [documents.length, fetchDocuments]);

  useEffect(() => {
    if (!isInitialized && documentIds.length > 0 && selectedDocs.length === documentIds.length) {
      setIsInitialized(true);
      createSession(documentIds);
    }
  }, [isInitialized, documentIds, selectedDocs.length, createSession]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleNewSession = async () => {
    if (documentIds.length > 0) {
      await createSession(documentIds);
    }
  };

  const documentNames = selectedDocs
    .map(d => getDocumentLabel(d))
    .join(', ');

  if (documentIds.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-foreground mb-2">No documents selected</h2>
        <p className="text-muted-foreground mb-4">
          Select documents from the home page to start a multi-document chat.
        </p>
        <Button asChild>
          <Link to="/">Go to Documents</Link>
        </Button>
      </div>
    );
  }

  if (selectedDocs.length === 0 && documents.length === 0) {
    return <LoadingSpinner message="Loading documents..." />;
  }

  // Get the active document for PDF viewing
  const activeDocument = activeDocumentId 
    ? selectedDocs.find(d => d.id === activeDocumentId) 
    : selectedDocs[0];
  
  const pdfUrl = activeDocumentId 
    ? documentsApi.getPdfUrl(activeDocumentId)
    : '';

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documents
        </Button>

        <div className="flex items-center space-x-3">
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

      {/* Document info and selected docs */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Multi-Document Chat
              </h1>
              <p className="text-xs text-muted-foreground">
                Click citations to view source documents
              </p>
            </div>
            {activeCitation && showPdfViewer && (
              <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                Viewing: {activeCitation.document_name || 'Document'} - Page {activeCitation.page_number}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedDocs.map(doc => (
              <Badge
                key={doc.id}
                variant={activeDocumentId === doc.id ? "default" : "secondary"}
                className="flex items-center gap-1.5 cursor-pointer"
                title={doc.filename}
                onClick={() => {
                  setActiveDocumentId(doc.id);
                  setPdfPage(1);
                  setShowPdfViewer(true);
                }}
              >
                <FileText className="w-3 h-3" />
                {getDocumentLabel(doc)}
              </Badge>
            ))}
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
            <LoadingSpinner message="Starting chat session..." />
          ) : (
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isSending}
              documentName={documentNames}
              onCitationClick={handleCitationClick}
            />
          )}
        </div>

        {/* PDF Viewer panel */}
        {showPdfViewer && activeDocumentId && (
          <div className="w-1/2 relative">
            <PDFViewer
              url={pdfUrl}
              initialPage={pdfPage}
              onClose={handleClosePdfViewer}
              documentName={activeDocument?.filename}
            />
          </div>
        )}
      </div>
    </div>
  );
}
