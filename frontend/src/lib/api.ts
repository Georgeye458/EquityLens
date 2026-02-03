import axios, { AxiosError } from 'axios';
import type {
  Document,
  DocumentListResponse,
  Analysis,
  POIsByCategory,
  ChatSession,
  ChatResponse,
  ApiError,
  Report,
  ReportSummary,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
const handleError = (error: AxiosError<ApiError>): never => {
  const message = error.response?.data?.detail || error.message || 'An error occurred';
  throw new Error(message);
};

// Document API
export const documentsApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    company_name?: string;
    status?: string;
  }): Promise<DocumentListResponse> => {
    try {
      const response = await api.get('/documents/', { params });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  get: async (id: number): Promise<Document> => {
    try {
      const response = await api.get(`/documents/${id}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  upload: async (
    file: File,
    metadata: {
      company_name: string;
      company_ticker?: string;
      document_type?: string;
      reporting_period?: string;
    }
  ): Promise<Document> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_name', metadata.company_name);
      if (metadata.company_ticker) {
        formData.append('company_ticker', metadata.company_ticker);
      }
      if (metadata.document_type) {
        formData.append('document_type', metadata.document_type);
      }
      if (metadata.reporting_period) {
        formData.append('reporting_period', metadata.reporting_period);
      }

      const response = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`/documents/${id}`);
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  update: async (
    id: number,
    metadata: {
      company_name?: string;
      company_ticker?: string;
      document_type?: string;
      reporting_period?: string;
    }
  ): Promise<Document> => {
    try {
      const formData = new FormData();
      if (metadata.company_name !== undefined) {
        formData.append('company_name', metadata.company_name);
      }
      if (metadata.company_ticker !== undefined) {
        formData.append('company_ticker', metadata.company_ticker);
      }
      if (metadata.document_type !== undefined) {
        formData.append('document_type', metadata.document_type);
      }
      if (metadata.reporting_period !== undefined) {
        formData.append('reporting_period', metadata.reporting_period);
      }

      const response = await api.patch(`/documents/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getStatus: async (id: number): Promise<{
    id: number;
    status: string;
    error_message: string | null;
    page_count: number | null;
    processed_at: string | null;
  }> => {
    try {
      const response = await api.get(`/documents/${id}/status`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  reprocess: async (id: number): Promise<{
    message: string;
    document_id: number;
    queue_position: number;
  }> => {
    try {
      const response = await api.post(`/documents/${id}/reprocess`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getQueueStatus: async (): Promise<{
    queue_length: number;
    is_processing: boolean;
    current_document_id: number | null;
  }> => {
    try {
      const response = await api.get('/documents/queue/status');
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },
};

// Analysis API
export const analysisApi = {
  start: async (documentId: number, model: string = 'llama-4'): Promise<{
    id: number;
    status: string;
  }> => {
    try {
      const response = await api.post(
        `/analysis/${documentId}/analyze`,
        null,
        { params: { model } }
      );
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getLatest: async (documentId: number): Promise<Analysis> => {
    try {
      const response = await api.get(`/analysis/${documentId}/latest`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  get: async (analysisId: number): Promise<Analysis> => {
    try {
      const response = await api.get(`/analysis/detail/${analysisId}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getPoisByCategory: async (documentId: number): Promise<POIsByCategory[]> => {
    try {
      const response = await api.get(`/analysis/${documentId}/pois`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getStatus: async (analysisId: number): Promise<{
    id: number;
    status: string;
    message?: string;
    poi_count: number;
    processing_time_seconds: number | null;
    completed_at: string | null;
  }> => {
    try {
      const response = await api.get(`/analysis/status/${analysisId}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },
};

// Chat API
export const chatApi = {
  createSession: async (
    documentIds: number | number[],
    title?: string
  ): Promise<ChatSession> => {
    try {
      const ids = Array.isArray(documentIds) ? documentIds : [documentIds];
      const response = await api.post('/chat/sessions', {
        document_ids: ids,
        title,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getSession: async (sessionId: number): Promise<ChatSession> => {
    try {
      const response = await api.get(`/chat/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getDocumentSessions: async (documentId: number): Promise<ChatSession[]> => {
    try {
      const response = await api.get(`/chat/documents/${documentId}/sessions`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  sendMessage: async (
    sessionId: number,
    content: string
  ): Promise<ChatResponse> => {
    try {
      const response = await api.post(
        `/chat/sessions/${sessionId}/messages`,
        { content }
      );
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  sendMessageStream: async (
    sessionId: number,
    content: string,
    onChunk: (chunk: string) => void,
    onDone?: () => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    const url = `${api.defaults.baseURL}/chat/sessions/${sessionId}/messages/stream`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content') {
                onChunk(data.data);
              } else if (data.type === 'done') {
                onDone?.();
              } else if (data.type === 'error') {
                onError?.(data.error);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onError?.(message);
      throw error;
    }
  },

  quickChat: async (
    documentId: number,
    content: string,
    model: string = 'llama-4'
  ): Promise<ChatResponse> => {
    try {
      const response = await api.post(
        `/chat/quick/${documentId}`,
        { content },
        { params: { model } }
      );
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  quickChatMulti: async (
    documentIds: number[],
    content: string,
    model: string = 'llama-4'
  ): Promise<ChatResponse> => {
    try {
      const response = await api.post('/chat/quick-multi', {
        document_ids: documentIds,
        content,
        model,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  deleteSession: async (sessionId: number): Promise<void> => {
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  preloadCache: async (documentId: number): Promise<{ status: string }> => {
    try {
      const response = await api.post(`/chat/preload/${documentId}`);
      return response.data;
    } catch (error) {
      // Don't throw - preload is optional optimization
      console.warn('Cache preload failed:', error);
      return { status: 'failed' };
    }
  },
};

// Reports API
export const reportsApi = {
  generate: async (
    documentId: number,
    model: string = 'llama-4'
  ): Promise<ReportSummary> => {
    try {
      const response = await api.post(`/reports/${documentId}/generate`, {
        model,
      });
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getLatest: async (documentId: number): Promise<Report> => {
    try {
      const response = await api.get(`/reports/${documentId}/latest`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  get: async (reportId: number): Promise<Report> => {
    try {
      const response = await api.get(`/reports/detail/${reportId}`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getStatus: async (documentId: number): Promise<{
    id: number;
    status: string;
    processing_time_seconds: number | null;
    error_message: string | null;
  }> => {
    try {
      const response = await api.get(`/reports/${documentId}/status`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },

  getAll: async (documentId: number): Promise<ReportSummary[]> => {
    try {
      const response = await api.get(`/reports/${documentId}/all`);
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },
};
