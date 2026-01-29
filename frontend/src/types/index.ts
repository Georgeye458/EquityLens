// Document types
export interface Document {
  id: number;
  filename: string;
  company_name: string;
  company_ticker: string | null;
  document_type: DocumentType;
  reporting_period: string | null;
  page_count: number | null;
  status: ProcessingStatus;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

export type DocumentType = 
  | 'annual_report'
  | 'half_year'
  | 'quarterly'
  | 'asx_announcement'
  | 'investor_presentation'
  | 'other';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

// Analysis types
export interface Analysis {
  id: number;
  document_id: number;
  status: string;
  summary: string | null;
  model_used: string | null;
  processing_time_seconds: number | null;
  created_at: string;
  completed_at: string | null;
  pois: POI[];
}

export interface POI {
  id: number;
  category: POICategory;
  name: string;
  description: string | null;
  output_type: POIOutputType;
  value: unknown;
  citations: Citation[] | null;
  confidence: number | null;
}

export type POICategory = 
  | 'financial_metrics'
  | 'segment_analysis'
  | 'cash_flow'
  | 'earnings_quality'
  | 'management_commentary';

export type POIOutputType = 
  | 'value'
  | 'multi_value'
  | 'value_delta'
  | 'commentary'
  | 'array';

export interface Citation {
  page_number: number;
  text?: string;
  section?: string;
}

export interface POIsByCategory {
  category: string;
  category_display: string;
  pois: POI[];
}

// Chat types
export interface ChatSession {
  id: number;
  document_id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: CitationDetail[] | null;
  created_at: string;
}

export interface CitationDetail {
  page_number: number;
  text: string;
  relevance_score?: number;
}

export interface ChatResponse {
  message: ChatMessage;
  session_id: number;
}

// API response types
export interface ApiError {
  detail: string;
}
