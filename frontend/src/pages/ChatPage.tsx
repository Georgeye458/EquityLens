import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Plus,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { useChat } from '../hooks/useChat';
import { usePDFViewer } from '../context/PDFViewerContext';
import { chatApi } from '../lib/api';
import ChatInterface from '../components/ChatInterface';
import PDFViewerPanel from '../components/PDFViewerPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CitationDetail } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDocument, selectDocument } = useDocuments();
  const { openPDFViewer } = usePDFViewer();
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

  // Handle citation click - open PDF viewer overlay at the cited page
  const handleCitationClick = (citation: CitationDetail) => {
    if (id) {
      openPDFViewer(parseInt(id), citation.page_number);
    }
  };

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
        <Button
          variant="ghost"
          onClick={() => navigate(`/documents/${id}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Document
        </Button>

        <Button variant="outline" asChild>
          <Link to={`/documents/${id}/analysis`}>
            <BarChart3 className="w-4 h-4 mr-2" />
            View Analysis
          </Link>
        </Button>
      </div>

      {/* Document info and controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Chat: {selectedDocument.company_name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Ask questions about the full document content • {selectedDocument.page_count} pages
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                💡 Click any citation to view the source page
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama-4">Llama 4 (Fast)</SelectItem>
                  <SelectItem value="deepseek-v3.1">DeepSeek V3.1 (Detailed)</SelectItem>
                  <SelectItem value="gpt-oss-120b">GPT OSS 120B</SelectItem>
                  <SelectItem value="magpie">Magpie (AU Sovereign)</SelectItem>
                </SelectContent>
              </Select>
              
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
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
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
          onCitationClick={handleCitationClick}
        />
      )}

      {/* PDF Viewer Panel - slides out from right when citation clicked */}
      <PDFViewerPanel />

      {/* Info panel */}
      <Card className="bg-secondary border-secondary">
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Full Document Access
          </h3>
          <p className="text-sm text-muted-foreground">
            Unlike traditional POI extraction, this chat has access to the entire document content.
            Ask detailed questions about any section, and responses will include page citations for verification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
