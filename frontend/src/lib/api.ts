import axios, { AxiosError } from 'axios';
import type {
  Document,
  DocumentListResponse,
  Analysis,
  POIsByCategory,
  ChatSession,
  ChatResponse,
  ApiError,
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
  createSession: async (documentId: number, title?: string): Promise<ChatSession> => {
    try {
      const response = await api.post('/chat/sessions', {
        document_id: documentId,
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
    content: string,
    model: string = 'llama-4'
  ): Promise<ChatResponse> => {
    try {
      const response = await api.post(
        `/chat/sessions/${sessionId}/messages`,
        { content },
        { params: { model } }
      );
      return response.data;
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
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

  deleteSession: async (sessionId: number): Promise<void> => {
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
    } catch (error) {
      throw handleError(error as AxiosError<ApiError>);
    }
  },
};
