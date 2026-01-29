import { useState, useCallback } from 'react';
import type { ChatSession, ChatMessage } from '../types';
import { chatApi } from '../lib/api';

interface UseChatReturn {
  session: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  createSession: (documentId: number, title?: string) => Promise<ChatSession>;
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

  const createSession = useCallback(async (documentId: number, title?: string): Promise<ChatSession> => {
    setIsLoading(true);
    setError(null);

    try {
      const newSession = await chatApi.createSession(documentId, title);
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

    try {
      const response = await chatApi.sendMessage(session.id, content, model);
      
      // Replace temp message with real response and add assistant message
      setMessages((prev) => [
        ...prev.slice(0, -1), // Remove temp message
        { ...tempUserMessage, id: response.message.id - 1 }, // Add real user message
        response.message, // Add assistant response
      ]);
    } catch (err) {
      // Remove optimistic message on error
      setMessages((prev) => prev.slice(0, -1));
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
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
