import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Document, DocumentListResponse } from '../types';
import { documentsApi } from '../lib/api';

interface DocumentContextType {
  documents: Document[];
  totalDocuments: number;
  selectedDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  fetchDocuments: (params?: { skip?: number; limit?: number; company_name?: string }) => Promise<void>;
  selectDocument: (id: number) => Promise<void>;
  uploadDocument: (file: File, metadata: {
    company_name: string;
    company_ticker?: string;
    document_type?: string;
    reporting_period?: string;
  }) => Promise<Document>;
  deleteDocument: (id: number) => Promise<void>;
  refreshDocument: (id: number) => Promise<void>;
  clearError: () => void;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (params?: {
    skip?: number;
    limit?: number;
    company_name?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response: DocumentListResponse = await documentsApi.list(params);
      setDocuments(response.documents);
      setTotalDocuments(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectDocument = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const document = await documentsApi.get(id);
      setSelectedDocument(document);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch document');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadDocument = useCallback(async (
    file: File,
    metadata: {
      company_name: string;
      company_ticker?: string;
      document_type?: string;
      reporting_period?: string;
    }
  ): Promise<Document> => {
    setIsLoading(true);
    setError(null);
    try {
      const document = await documentsApi.upload(file, metadata);
      // Refresh document list
      await fetchDocuments();
      return document;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload document';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchDocuments]);

  const deleteDocument = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      await documentsApi.delete(id);
      // Refresh document list
      await fetchDocuments();
      if (selectedDocument?.id === id) {
        setSelectedDocument(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchDocuments, selectedDocument]);

  const refreshDocument = useCallback(async (id: number) => {
    try {
      const document = await documentsApi.get(id);
      setSelectedDocument(document);
      // Also update in the list
      setDocuments(prev => prev.map(d => d.id === id ? document : d));
    } catch (err) {
      // Silent refresh failure
      console.error('Failed to refresh document:', err);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <DocumentContext.Provider
      value={{
        documents,
        totalDocuments,
        selectedDocument,
        isLoading,
        error,
        fetchDocuments,
        selectDocument,
        uploadDocument,
        deleteDocument,
        refreshDocument,
        clearError,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
}
