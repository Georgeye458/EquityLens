import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  FileText,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { useChat } from '../hooks/useChat';
import ChatInterface from '../components/ChatInterface';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Document } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  const [selectedModel, setSelectedModel] = useState('llama-4');
  const [isInitialized, setIsInitialized] = useState(false);

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
    await sendMessage(content, selectedModel);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documents
        </Button>
      </div>

      {/* Document info and controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Multi-Document Chat
              </h1>
              <p className="text-sm text-muted-foreground">
                Chatting with {selectedDocs.length} documents: {documentNames}
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

      {/* Selected documents */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Documents in this chat:</h3>
          <div className="flex flex-wrap gap-2">
            {selectedDocs.map(doc => (
              <Badge
                key={doc.id}
                variant="secondary"
                className="flex items-center gap-1.5"
                title={doc.filename}
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
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex justify-between items-center">
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
        />
      )}

      {/* Info panel */}
      <Card className="bg-secondary border-secondary">
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Cross-Document Analysis
          </h3>
          <p className="text-sm text-muted-foreground">
            You can compare data across all selected documents. Ask questions like:
            "Compare revenue growth between these companies" or "Which company has the highest profit margin?"
            Responses will cite the specific document and page for each piece of information.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
