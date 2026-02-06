import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  SendHorizontal,
  FileText,
  UserCircle,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, CitationDetail, Document } from '../types';
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
  documents?: Document[];  // Array of documents for matching citations
  onCitationClick?: (citation: CitationDetail) => void;
}

// Regex to match citation patterns like [Page 15], [Pages 10-12], [WBC - Page 15], [Document Name - p. 5]
// Also matches multi-citations like [Doc1 - Page 1; Doc2 - Page 2]
// Updated to also match citations with embedded IDs like [WBC {ID:42} - Page 15]
const CITATION_REGEX = /\[([^\]]*?(?:page|pages|p\.)\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*;[^\]]*?(?:page|pages|p\.)\s*\d+(?:\s*[-–]\s*\d+)?)*)\]/gi;

// Single citation pattern (used for parsing individual citations)
// Updated to capture optional {ID:X} in document name
const SINGLE_CITATION_PATTERN = /^(.+?)\s*[-–]\s*(?:page|pages|p\.?)\s*(\d+)(?:\s*[-–]\s*(\d+))?$/i;

// Pattern to extract document ID from label like "WBC Full Year {ID:42}"
const DOCUMENT_ID_PATTERN = /\{ID:(\d+)\}/i;
// Fallback pattern for ALL LLM-generated variants: [ID:42], [ID:42-P5], [ID:42, Pg 8], etc.
const DOCUMENT_ID_FALLBACK_PATTERN = /\[ID:(\d+)[^\]]*\]/gi;

// Helper function to strip all ID patterns from display text
function stripIdPatterns(text: string): string {
  return text
    .replace(DOCUMENT_ID_PATTERN, '')
    .replace(DOCUMENT_ID_FALLBACK_PATTERN, '')
    .trim();
}

// Parse a citation string to extract document name and page number, with document ID matching
function parseCitationString(
  citationText: string, 
  documents?: Document[]
): { documentName: string | null; pageNumber: number; pageEnd?: number; documentId?: number } | null {
  // Safety: If citation contains semicolons (multi-citation), parse just the first one
  let cleanCitation = citationText;
  if (citationText.includes(';')) {
    cleanCitation = citationText.split(';')[0].trim();
  }
  
  // Match patterns like "WBC - Page 15", "Page 15", "p. 15", "Pages 10-12"
  const withDocMatch = cleanCitation.match(SINGLE_CITATION_PATTERN);
  if (withDocMatch) {
    const docName = withDocMatch[1].trim();
    const pageNumber = parseInt(withDocMatch[2], 10);
    const pageEnd = withDocMatch[3] ? parseInt(withDocMatch[3], 10) : undefined;
    
    // PRIORITY 1: Check for embedded document ID in the citation text {ID:X}
    // This is the most reliable method - the backend embeds the actual ID
    const idMatch = docName.match(DOCUMENT_ID_PATTERN);
    if (idMatch) {
      const embeddedId = parseInt(idMatch[1], 10);
      // Clean the document name by removing the ID tag for display
      const cleanDocName = stripIdPatterns(docName);
      return {
        documentName: cleanDocName,
        pageNumber,
        pageEnd,
        documentId: embeddedId,
      };
    }
    
    // PRIORITY 2: Check for LLM-generated fallback patterns like [ID:X] or [ID:X-P5]
    const fallbackIdMatch = docName.match(/\[ID:(\d+)/i);
    if (fallbackIdMatch) {
      const embeddedId = parseInt(fallbackIdMatch[1], 10);
      const cleanDocName = stripIdPatterns(docName);
      return {
        documentName: cleanDocName,
        pageNumber,
        pageEnd,
        documentId: embeddedId,
      };
    }
    
    // FALLBACK: Try to match document name to actual document (legacy behavior)
    let documentId: number | undefined;
    if (documents && documents.length > 0) {
      let docNameLower = docName.trim().toLowerCase();
      
      // Check if name is truncated (ends with ...)
      const isTruncated = docNameLower.endsWith('...');
      if (isTruncated) {
        // Remove the ... for matching
        docNameLower = docNameLower.slice(0, -3).trim();
      }
      
      // Try to match by ticker first (most common and specific)
      let matchedDoc = documents.find(doc => {
        const ticker = doc.company_ticker?.trim().toLowerCase();
        return ticker && ticker === docNameLower;
      });
      
      // PRIORITY: Try matching by filename FIRST (more specific than company name)
      // This prevents matching "wbc full year presentation" to wrong document
      // when multiple documents have the same company name
      if (!matchedDoc) {
        matchedDoc = documents.find(doc => {
          if (doc.filename) {
            const cleanFilename = doc.filename
              .replace(/\.pdf$/i, '')
              .replace(/^\d+\.\d+_/, '')
              .replace(/[_-]+/g, ' ')
              .trim()
              .toLowerCase();
            
            if (isTruncated) {
              // For truncated names, check if filename starts with the truncated name
              return cleanFilename.startsWith(docNameLower);
            } else {
              // Check both directions for partial matching
              return cleanFilename.includes(docNameLower) || docNameLower.includes(cleanFilename);
            }
          }
          return false;
        });
      }
      
      // If no filename match, try company name (exact match)
      if (!matchedDoc) {
        matchedDoc = documents.find(doc => {
          const companyName = doc.company_name?.trim().toLowerCase();
          if (!companyName) return false;
          
          if (isTruncated) {
            return companyName.startsWith(docNameLower);
          } else {
            return companyName === docNameLower;
          }
        });
      }
      
      // Last resort: Try partial match on company name
      // (only if we have a single document or this is a very specific query)
      if (!matchedDoc && documents.length === 1) {
        matchedDoc = documents.find(doc => {
          const companyName = doc.company_name?.trim().toLowerCase();
          return companyName && (
            companyName.includes(docNameLower) || 
            docNameLower.includes(companyName)
          );
        });
      }
      
      documentId = matchedDoc?.id;
      
      if (!matchedDoc) {
        console.warn('[Citation] Could not match document name:', docName, 'against available documents');
      }
    }
    
    return {
      documentName: docName,
      pageNumber,
      pageEnd,
      documentId,
    };
  }
  
  // Match patterns like "Page 15", "p. 15", "Pages 10-12" (no document name)
  const pageOnlyMatch = cleanCitation.match(/^(?:page|pages|p\.?)\s*(\d+)(?:\s*[-–]\s*(\d+))?$/i);
  if (pageOnlyMatch) {
    const pageNumber = parseInt(pageOnlyMatch[1], 10);
    const pageEnd = pageOnlyMatch[2] ? parseInt(pageOnlyMatch[2], 10) : undefined;
    
    // If only one document, use it
    const documentId = documents && documents.length === 1 ? documents[0].id : undefined;
    
    return {
      documentName: null,
      pageNumber,
      pageEnd,
      documentId,
    };
  }
  
  return null;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
  documentName,
  documents,
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

  // Handle inline citation click
  const handleInlineCitationClick = useCallback((citationText: string) => {
    if (!onCitationClick) return;
    
    const parsed = parseCitationString(citationText, documents);
    
    if (parsed) {
      onCitationClick({
        page_number: parsed.pageNumber,
        document_name: parsed.documentName || undefined,
        document_id: parsed.documentId,
        text: `Citation: ${citationText}`,
      });
    } else {
      console.warn('[Citation] Failed to parse citation:', citationText);
    }
  }, [onCitationClick, documents]);

  // Pre-process content to convert citations to special markdown links
  const preprocessContent = useCallback((content: string): string => {
    if (!onCitationClick) return content;
    
    // FIRST: Strip ALL standalone [ID:...] patterns that LLM generates outside of citations
    // Matches [ID:X], [ID:X-P8], [ID:X, Pg 8], [ID:X, Page 32], etc.
    // These don't match CITATION_REGEX (which requires "page/pages/p.") so they'd render as plain text
    let processed = content.replace(/\[ID:\d+[^\]]*\]/gi, '');
    
    // Replace [Page X] or [DOC - Page X] with markdown links using a hash-based protocol
    processed = processed.replace(CITATION_REGEX, (_fullMatch, citationText) => {
      // Check if this is a multi-citation (contains semicolons separating multiple citations)
      if (citationText.includes(';')) {
        // Split into individual citations and create separate links
        const citations = citationText.split(';').map((c: string) => c.trim()).filter(Boolean);
        return citations.map((singleCitation: string) => {
          const encoded = encodeURIComponent(singleCitation);
          // Strip ID patterns from display text - it's only for internal routing
          const displayText = stripIdPatterns(singleCitation);
          return `[📄 ${displayText}](#cite:${encoded})`;
        }).join(' ');
      }
      
      // Single citation - encode and create link
      const encoded = encodeURIComponent(citationText);
      // Strip ID patterns from display text - it's only for internal routing
      const displayText = stripIdPatterns(citationText);
      // Use #cite: instead of citation: to avoid sanitization
      return `[📄 ${displayText}](#cite:${encoded})`;
    });
    
    return processed;
  }, [onCitationClick]);

  // Custom link component for ReactMarkdown that handles citation links
  const MarkdownComponents = useMemo(() => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    a: (props: any) => {
      const { href, children } = props;
      
      // Check if this is a citation link (using #cite: protocol)
      if (href?.startsWith('#cite:')) {
        const citationText = decodeURIComponent(href.replace('#cite:', ''));
        const parsed = parseCitationString(citationText, documents);
        // Strip ID patterns from display text - it's only for internal routing
        const displayText = stripIdPatterns(citationText);
        
        return (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleInlineCitationClick(citationText);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleInlineCitationClick(citationText);
              }
            }}
            className="inline-citation-link inline-flex items-center mx-0.5 px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors cursor-pointer no-underline select-none"
            title={`Click to view ${parsed?.documentName ? parsed.documentName + ' - ' : ''}Page ${parsed?.pageNumber || '?'}`}
          >
            <FileText className="w-3 h-3 mr-1 flex-shrink-0" />
            <span>{displayText}</span>
          </span>
        );
      }
      
      // Regular link - open in new tab
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </a>
      );
    },
  }), [handleInlineCitationClick, documents]);

  // Render content with clickable inline citations
  const renderContentWithCitations = useCallback((content: string) => {
    const processedContent = preprocessContent(content);
    
    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={MarkdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    );
  }, [preprocessContent, MarkdownComponents]);

  const renderCitation = (citation: CitationDetail) => (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCitationClick?.(citation);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onCitationClick?.(citation);
        }
      }}
      className={cn(
        "citation inline-flex items-center",
        onCitationClick && "cursor-pointer hover:bg-primary/20 hover:scale-105 transition-all"
      )}
      title={`Click to view: ${citation.text?.slice(0, 100)}...`}
    >
      <FileText className="w-3 h-3 mr-1" />
      {citation.document_name ? `${citation.document_name} - ` : ''}p.{citation.page_number}
    </span>
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
                        {renderContentWithCitations(message.content)}
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
