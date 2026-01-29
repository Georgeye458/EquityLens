import { useState, useRef, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  DocumentTextIcon,
  UserCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage, CitationDetail } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<void>;
  isLoading?: boolean;
  documentName?: string;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
  documentName,
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
    <span className="citation" title={citation.text}>
      <DocumentTextIcon className="w-3 h-3 mr-1" />
      p.{citation.page_number}
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
    <div className="flex flex-col h-[600px] card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center">
          <SparklesIcon className="w-5 h-5 text-primary-500 mr-2" />
          <h3 className="text-sm font-medium text-gray-900">
            Chat with Document
          </h3>
          {documentName && (
            <span className="ml-2 text-xs text-gray-500">• {documentName}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Ask questions about the full document content, not just extracted POIs
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <SparklesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Start a conversation
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              Ask anything about this earnings report. I have access to the full document.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedQuestions.slice(0, 3).map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(question)}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
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
              className={`chat-message flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 ${
                    message.role === 'user' ? 'ml-3' : 'mr-3'
                  }`}
                >
                  {message.role === 'user' ? (
                    <UserCircleIcon className="w-8 h-8 text-gray-400" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
                      <SparklesIcon className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* Message content */}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  )}

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Sources:</p>
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
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about the document..."
              className="input resize-none"
              rows={1}
              disabled={isLoading}
              style={{
                minHeight: '42px',
                maxHeight: '120px',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-primary px-4 py-2.5"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
