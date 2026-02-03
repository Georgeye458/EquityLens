import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { useAnalysis } from '../hooks/useAnalysis';
import POIDashboard from '../components/POIDashboard';
import LoadingSpinner from '../components/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDocument, selectDocument } = useDocuments();
  const {
    analysis,
    categories,
    isLoading,
    isAnalyzing,
    statusMessage,
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
        <Button
          variant="ghost"
          onClick={() => navigate(`/documents/${id}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Document
        </Button>

        <Button variant="outline" asChild>
          <Link to={`/documents/${id}/chat`}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat with Document
          </Link>
        </Button>
      </div>

      {/* Document info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {selectedDocument.company_name} Analysis
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedDocument.reporting_period || 'Earnings Report'} • {selectedDocument.page_count} pages
              </p>
            </div>
            
            {/* Analysis controls */}
            <div className="flex items-center space-x-3">
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isAnalyzing}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama-4">Llama 4 (Fast)</SelectItem>
                  <SelectItem value="deepseek-v3.1">DeepSeek V3.1 (Detailed)</SelectItem>
                  <SelectItem value="gpt-oss-120b">GPT OSS 120B</SelectItem>
                  <SelectItem value="magpie">Magpie (AU Sovereign)</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isAnalyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Run Analysis'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Analysis in progress — incremental UX */}
      {isAnalyzing && (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Step 1 of 1
              </p>
              <p className="text-foreground animate-pulse">
                {statusMessage ?? 'Extracting key points and generating summary…'}
              </p>
            </div>
            <p className="text-sm text-muted-foreground/70 max-w-md">
              One AI pass extracts POIs and writes the executive summary. This may take 1–3 minutes for large documents.
            </p>
          </div>
        </Card>
      )}

      {/* No analysis yet */}
      {!isLoading && !isAnalyzing && !analysis && categories.length === 0 && (
        <Card className="p-8 text-center">
          <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Analysis Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Run AI analysis to extract financial metrics, segment data, and management commentary.
          </p>
          <Button onClick={handleStartAnalysis}>
            <Sparkles className="w-4 h-4 mr-2" />
            Start Analysis
          </Button>
        </Card>
      )}

      {/* Analysis results */}
      {!isAnalyzing && categories.length > 0 && (
        <div className="space-y-6">
          {/* Summary */}
          {analysis?.summary && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold text-foreground mb-3">Executive Summary</h2>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  {analysis.summary.split('\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
                {analysis.processing_time_seconds && (
                  <div className="mt-4 flex items-center text-xs text-muted-foreground">
                    <Clock className="w-4 h-4 mr-1" />
                    Analyzed in {analysis.processing_time_seconds.toFixed(1)} seconds using {analysis.model_used}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* POI Dashboard */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Points of Interest</h2>
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
