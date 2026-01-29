import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  SparklesIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useDocuments } from '../context/DocumentContext';
import { useAnalysis } from '../hooks/useAnalysis';
import POIDashboard from '../components/POIDashboard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDocument, selectDocument } = useDocuments();
  const {
    analysis,
    categories,
    isLoading,
    isAnalyzing,
    error,
    startAnalysis,
    fetchAnalysis,
    fetchCategories,
  } = useAnalysis();

  const [selectedModel, setSelectedModel] = useState('llama-4');

  useEffect(() => {
    if (id) {
      selectDocument(parseInt(id));
      fetchAnalysis(parseInt(id));
      fetchCategories(parseInt(id));
    }
  }, [id, selectDocument, fetchAnalysis, fetchCategories]);

  const handleStartAnalysis = async () => {
    if (id) {
      await startAnalysis(parseInt(id), selectedModel);
    }
  };

  if (!selectedDocument) {
    return <LoadingSpinner message="Loading document..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/documents/${id}`)}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Document
        </button>

        <Link
          to={`/documents/${id}/chat`}
          className="btn-secondary flex items-center"
        >
          <ChatBubbleLeftRightIcon className="w-4 h-4 mr-2" />
          Chat with Document
        </Link>
      </div>

      {/* Document info */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {selectedDocument.company_name} Analysis
            </h1>
            <p className="text-sm text-gray-500">
              {selectedDocument.reporting_period || 'Earnings Report'} • {selectedDocument.page_count} pages
            </p>
          </div>
          
          {/* Analysis controls */}
          <div className="flex items-center space-x-3">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input text-sm"
              disabled={isAnalyzing}
            >
              <option value="llama-4">Llama 4 (Fast)</option>
              <option value="deepseek-v3.1">DeepSeek V3.1 (Detailed)</option>
              <option value="gpt-oss-120b">GPT OSS 120B</option>
              <option value="magpie">Magpie (AU Sovereign)</option>
            </select>
            
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
              className="btn-primary flex items-center"
            >
              <SparklesIcon className="w-4 h-4 mr-2" />
              {isAnalyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Analysis in progress */}
      {isAnalyzing && (
        <div className="card p-8 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">
            Extracting Points of Interest from {selectedDocument.page_count} pages...
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This typically takes 2-5 minutes for large documents.
          </p>
        </div>
      )}

      {/* No analysis yet */}
      {!isLoading && !isAnalyzing && !analysis && categories.length === 0 && (
        <div className="card p-8 text-center">
          <SparklesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Run AI analysis to extract financial metrics, segment data, and management commentary.
          </p>
          <button onClick={handleStartAnalysis} className="btn-primary">
            <SparklesIcon className="w-4 h-4 mr-2" />
            Start Analysis
          </button>
        </div>
      )}

      {/* Analysis results */}
      {!isAnalyzing && categories.length > 0 && (
        <div className="space-y-6">
          {/* Summary */}
          {analysis?.summary && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h2>
              <div className="prose prose-sm max-w-none text-gray-700">
                {analysis.summary.split('\n').map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
              {analysis.processing_time_seconds && (
                <div className="mt-4 flex items-center text-xs text-gray-500">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  Analyzed in {analysis.processing_time_seconds.toFixed(1)} seconds using {analysis.model_used}
                </div>
              )}
            </div>
          )}

          {/* POI Dashboard */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Points of Interest</h2>
            <POIDashboard categories={categories} />
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && !isAnalyzing && (
        <LoadingSpinner message="Loading analysis..." />
      )}
    </div>
  );
}
