import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Plus,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { useChat } from '../hooks/useChat';
import { chatApi } from '../lib/api';
import ChatInterface from '../components/ChatInterface';
import LoadingSpinner from '../components/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

        <div className="flex items-center space-x-3">
          <Button variant="outline" asChild>
            <Link to={`/documents/${id}/analysis`}>
              <BarChart3 className="w-4 h-4 mr-2" />
              View Analysis
            </Link>
          </Button>
        </div>
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
            </div>
            
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
        />
      )}

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
