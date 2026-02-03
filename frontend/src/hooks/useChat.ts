import { useState, useCallback } from 'react';
import type { ChatSession, ChatMessage } from '../types';
import { chatApi } from '../lib/api';

interface UseChatReturn {
  session: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  createSession: (documentIds: number | number[], title?: string) => Promise<ChatSession>;
  loadSession: (sessionId: number) => Promise<void>;
  loadDocumentSessions: (documentId: number) => Promise<ChatSession[]>;
  sendMessage: (content: string, model?: string) => Promise<void>;
  clearError: () => void;
}

export function useChat(): UseChatReturn {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async (documentIds: number | number[], title?: string): Promise<ChatSession> => {
    setIsLoading(true);
    setError(null);

    try {
      const newSession = await chatApi.createSession(documentIds, title);
      setSession(newSession);
      setMessages([]);
      return newSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSession = useCallback(async (sessionId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedSession = await chatApi.getSession(sessionId);
      setSession(loadedSession);
      setMessages(loadedSession.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDocumentSessions = useCallback(async (documentId: number): Promise<ChatSession[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const sessions = await chatApi.getDocumentSessions(documentId);
      
      // If there are sessions, load the most recent one
      if (sessions.length > 0) {
        setSession(sessions[0]);
        setMessages(sessions[0].messages);
      }
      
      return sessions;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string, model: string = 'llama-4') => {
    if (!session) {
      setError('No active session');
      return;
    }

    setIsSending(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content,
      citations: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    // Add placeholder for streaming assistant message
    const tempAssistantId = Date.now() + 1;
    const tempAssistantMessage: ChatMessage = {
      id: tempAssistantId,
      role: 'assistant',
      content: '',
      citations: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempAssistantMessage]);

    try {
      // Use streaming API
      await chatApi.sendMessageStream(
        session.id,
        content,
        model,
        // onChunk: append to assistant message
        (chunk: string) => {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, content: lastMsg.content + chunk },
              ];
            }
            return prev;
          });
        },
        // onDone
        () => {
          setIsSending(false);
        },
        // onError: keep user message, only remove empty assistant placeholder
        (errorMsg: string) => {
          setError(errorMsg);
          // Remove only the assistant placeholder, keep user message
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === '') {
              return prev.slice(0, -1);
            }
            return prev;
          });
          setIsSending(false);
        }
      );
    } catch (err) {
      // Remove only the empty assistant placeholder, keep user message
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsSending(false);
    }
  }, [session]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    session,
    messages,
    isLoading,
    isSending,
    error,
    createSession,
    loadSession,
    loadDocumentSessions,
    sendMessage,
    clearError,
  };
}
