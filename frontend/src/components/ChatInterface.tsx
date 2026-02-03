import { useState, useRef, useEffect } from 'react';
import {
  SendHorizontal,
  FileText,
  UserCircle,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, CitationDetail } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<void>;
  isLoading?: boolean;
  documentName?: string;
  onCitationClick?: (citation: CitationDetail) => void;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
  documentName,
  onCitationClick,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-expand textarea as user types
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const renderCitation = (citation: CitationDetail) => (
    <button
      type="button"
      onClick={() => onCitationClick?.(citation)}
      className={cn(
        "citation inline-flex items-center",
        onCitationClick && "cursor-pointer hover:bg-primary/20 hover:scale-105 transition-all"
      )}
      title={`Click to view: ${citation.text?.slice(0, 100)}...`}
    >
      <FileText className="w-3 h-3 mr-1" />
      {citation.document_name ? `${citation.document_name} - ` : ''}p.{citation.page_number}
    </button>
  );

  const suggestedQuestions = [
    "What were the key revenue drivers this period?",
    "How did margins change compared to last year?",
    "What guidance did management provide?",
    "Are there any earnings quality concerns?",
    "Summarize the segment performance",
  ];

  return (
    <Card className="flex flex-col h-[700px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-muted/50 border-b">
        <div className="flex items-center">
          <Sparkles className="w-5 h-5 text-foreground mr-2" />
          <h3 className="text-sm font-medium text-foreground">
            Chat with Document
          </h3>
          {documentName && (
            <span className="ml-2 text-xs text-muted-foreground">• {documentName}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Ask questions about the full document content, not just extracted POIs
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4 overflow-hidden">
        <div className="space-y-4 overflow-hidden">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h4 className="text-sm font-medium text-foreground mb-2">
                Start a conversation
              </h4>
              <p className="text-xs text-muted-foreground mb-4">
                Ask anything about this earnings report. I have access to the full document.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.slice(0, 3).map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(question)}
                    className="text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-full hover:bg-accent transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "chat-message flex w-full",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "flex",
                    message.role === 'user' ? 'max-w-[75%] flex-row-reverse' : 'max-w-[80%] flex-row'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex-shrink-0",
                      message.role === 'user' ? 'ml-2' : 'mr-2'
                    )}
                  >
                    {message.role === 'user' ? (
                      <UserCircle className="w-7 h-7 text-muted-foreground" />
                    ) : (
                      <div className="w-7 h-7 bg-gradient-to-br from-neutral-700 to-neutral-900 rounded-full flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Message content */}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 overflow-hidden",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground shadow-sm border"
                    )}
                    style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                  >
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none overflow-x-auto prose-headings:text-foreground prose-headings:font-semibold prose-h3:text-base prose-h4:text-sm prose-table:text-xs prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:border prose-th:border-border prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-border prose-table:border-collapse [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:block [&_pre]:overflow-x-auto [&_code]:break-all">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Citations */}
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                        <div className="flex flex-wrap gap-1">
                          {message.citations.map((citation, idx) => (
                            <span key={idx}>{renderCitation(citation)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-neutral-700 to-neutral-900 rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-card">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about the document..."
              className="resize-none overflow-hidden"
              style={{ minHeight: '42px', maxHeight: '120px' }}
              rows={1}
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            <SendHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
