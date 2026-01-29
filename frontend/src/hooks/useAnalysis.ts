import { useState, useCallback } from 'react';
import type { Analysis, POIsByCategory } from '../types';
import { analysisApi } from '../lib/api';
import { usePolling } from './usePolling';

interface UseAnalysisReturn {
  analysis: Analysis | null;
  categories: POIsByCategory[];
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  startAnalysis: (documentId: number, model?: string) => Promise<void>;
  fetchAnalysis: (documentId: number) => Promise<void>;
  fetchCategories: (documentId: number) => Promise<void>;
}

export function useAnalysis(): UseAnalysisReturn {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [categories, setCategories] = useState<POIsByCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingAnalysisId, setPollingAnalysisId] = useState<number | null>(null);

  // Poll for analysis completion
  usePolling(
    async () => {
      if (!pollingAnalysisId) return true;

      try {
        const status = await analysisApi.getStatus(pollingAnalysisId);
        
        if (status.status === 'completed') {
          const fullAnalysis = await analysisApi.get(pollingAnalysisId);
          setAnalysis(fullAnalysis);
          setIsAnalyzing(false);
          setPollingAnalysisId(null);
          return true;
        }
        
        if (status.status === 'failed') {
          setError('Analysis failed');
          setIsAnalyzing(false);
          setPollingAnalysisId(null);
          return true;
        }
        
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Polling failed');
        setIsAnalyzing(false);
        setPollingAnalysisId(null);
        return true;
      }
    },
    { enabled: pollingAnalysisId !== null, interval: 3000 }
  );

  const startAnalysis = useCallback(async (documentId: number, model: string = 'llama-4') => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analysisApi.start(documentId, model);
      setPollingAnalysisId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
      setIsAnalyzing(false);
    }
  }, []);

  const fetchAnalysis = useCallback(async (documentId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await analysisApi.getLatest(documentId);
      setAnalysis(result);
    } catch (err) {
      // No analysis exists yet is not an error
      if (!(err instanceof Error && err.message.includes('not found'))) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analysis');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async (documentId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await analysisApi.getPoisByCategory(documentId);
      setCategories(result);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('not found'))) {
        setError(err instanceof Error ? err.message : 'Failed to fetch categories');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    analysis,
    categories,
    isLoading,
    isAnalyzing,
    error,
    startAnalysis,
    fetchAnalysis,
    fetchCategories,
  };
}
