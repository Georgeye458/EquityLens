import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  FileText,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { usePDFViewer } from '../context/PDFViewerContext';
import { useChat } from '../hooks/useChat';
import ChatInterface from '../components/ChatInterface';
import PDFViewerPanel from '../components/PDFViewerPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Document, CitationDetail } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function getDocumentLabel(doc: Document): string {
  // Use filename as primary source for distinctive labels
  if (doc.filename) {
    let name = doc.filename
      .replace(/\.pdf$/i, '')
      .replace(/^\d+\.\d+_/, '') // Remove timestamp prefix
      .replace(/[_-]+/g, ' ')
      .trim();
    
    // Limit length for badges
    if (name.length > 25) {
      name = name.substring(0, 22) + '...';
    }
    return name;
  }
  
  // Fallback to ticker/company + period
  const ticker = doc.company_ticker || doc.company_name.slice(0, 3).toUpperCase();
  const parts = [ticker];
  
  if (doc.reporting_period) {
    parts.push(doc.reporting_period);
  }
  
  return parts.join(' ') || 'Document';
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

  const { openPDFViewer } = usePDFViewer();
  const [isInitialized, setIsInitialized] = useState(false);

  // Handle citation click - open PDF viewer overlay at the cited page
  const handleCitationClick = (citation: CitationDetail) => {
    if (citation.document_id) {
      openPDFViewer(citation.document_id, citation.page_number);
    }
  };

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
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Multi-Document Chat
            </h1>
            <p className="text-xs text-muted-foreground">
              Click citations to view source documents
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedDocs.map(doc => (
                <Badge
                  key={doc.id}
                  variant="secondary"
                  className="flex items-center gap-1.5"
                  title={doc.filename}
                >
                  {getDocumentLabel(doc)}
                </Badge>
              ))}
            </div>
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

      {/* Chat interface */}
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

      {/* PDF Viewer Panel - slides out from right when citation clicked */}
      <PDFViewerPanel />
    </div>
  );
}
