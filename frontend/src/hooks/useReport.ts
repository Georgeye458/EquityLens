import { useState, useCallback } from 'react';
import type { Report, ReportSummary } from '../types';
import { reportsApi } from '../lib/api';
import { usePolling } from './usePolling';

interface UseReportReturn {
  report: Report | null;
  reportSummary: ReportSummary | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  generateReport: (documentId: number, model?: string) => Promise<void>;
  fetchReport: (documentId: number) => Promise<void>;
  clearError: () => void;
}

export function useReport(): UseReportReturn {
  const [report, setReport] = useState<Report | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingDocumentId, setPollingDocumentId] = useState<number | null>(null);

  // Poll for report completion
  usePolling(
    async () => {
      if (!pollingDocumentId) return true;

      try {
        const status = await reportsApi.getStatus(pollingDocumentId);
        
        if (status.status === 'completed') {
          const fullReport = await reportsApi.getLatest(pollingDocumentId);
          setReport(fullReport);
          setIsGenerating(false);
          setPollingDocumentId(null);
          return true;
        }
        
        if (status.status === 'failed') {
          setError(status.error_message || 'Report generation failed');
          setIsGenerating(false);
          setPollingDocumentId(null);
          return true;
        }
        
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Polling failed');
        setIsGenerating(false);
        setPollingDocumentId(null);
        return true;
      }
    },
    { enabled: pollingDocumentId !== null, interval: 5000 } // Longer interval for report generation
  );

  const generateReport = useCallback(async (documentId: number, model: string = 'llama-4') => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await reportsApi.generate(documentId, model);
      setReportSummary(result);
      setPollingDocumentId(documentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start report generation');
      setIsGenerating(false);
    }
  }, []);

  const fetchReport = useCallback(async (documentId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await reportsApi.getLatest(documentId);
      setReport(result);
      
      // Check if report is still processing
      if (result.status === 'processing' || result.status === 'pending') {
        setIsGenerating(true);
        setPollingDocumentId(documentId);
      }
    } catch (err) {
      // No report exists yet is not an error
      if (!(err instanceof Error && err.message.includes('not found'))) {
        setError(err instanceof Error ? err.message : 'Failed to fetch report');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    report,
    reportSummary,
    isLoading,
    isGenerating,
    error,
    generateReport,
    fetchReport,
    clearError,
  };
}
