import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Sparkles,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { usePDFViewer } from '../context/PDFViewerContext';
import { useReport } from '../hooks/useReport';
import ReportViewer from '../components/ReportViewer';
import PDFViewerPanel from '../components/PDFViewerPanel';
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
import { Link } from 'react-router-dom';
import type { CitationDetail } from '../types';

export default function FullReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDocument, selectDocument } = useDocuments();
  const { openPDFViewer } = usePDFViewer();
  const {
    report,
    isLoading,
    isGenerating,
    error,
    generateReport,
    fetchReport,
    clearError,
  } = useReport();

  const [selectedModel, setSelectedModel] = useState('llama-4');
  
  // Handle citation click - open PDF viewer at cited page
  const handleCitationClick = (citation: CitationDetail) => {
    if (id) {
      openPDFViewer(parseInt(id), citation.page_number);
    }
  };

  useEffect(() => {
    if (id) {
      const documentId = parseInt(id);
      selectDocument(documentId);
      fetchReport(documentId);
    }
  }, [id, selectDocument, fetchReport]);

  const handleGenerateReport = async () => {
    if (id) {
      await generateReport(parseInt(id), selectedModel);
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

        <div className="flex items-center space-x-3">
          <Button variant="outline" asChild>
            <Link to={`/documents/${id}/analysis`}>
              <BarChart3 className="w-4 h-4 mr-2" />
              POI Analysis
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/documents/${id}/chat`}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Link>
          </Button>
        </div>
      </div>

      {/* Document info and controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Full Analysis Report
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedDocument.company_name} • {selectedDocument.reporting_period || 'Financial Results'} • {selectedDocument.page_count} pages
              </p>
            </div>
            
            {/* Generation controls */}
            <div className="flex items-center space-x-3">
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isGenerating}
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
                onClick={handleGenerateReport}
                disabled={isGenerating}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : report ? 'Regenerate' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Generation in progress */}
      {isGenerating && (
        <Card className="p-8 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">
            Generating comprehensive analysis report...
          </p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            This typically takes 2-5 minutes for large documents. The report includes financial metrics,
            segment analysis, cash flow, earnings quality assessment, and more.
          </p>
        </Card>
      )}

      {/* No report yet */}
      {!isLoading && !isGenerating && !report && (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Report Generated Yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
            Generate a comprehensive analysis report that includes financial metrics tables,
            segment analysis, cash flow summary, earnings quality assessment with red flags,
            and exceptional items breakdown.
          </p>
          <Button onClick={handleGenerateReport}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Full Report
          </Button>
        </Card>
      )}

      {/* Report viewer */}
      {!isGenerating && report && report.status === 'completed' && (
        <>
          <ReportViewer report={report} onCitationClick={handleCitationClick} />
          <PDFViewerPanel />
        </>
      )}

      {/* Failed report */}
      {!isGenerating && report && report.status === 'failed' && (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-destructive/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-2">Report Generation Failed</h3>
          <p className="text-sm text-destructive mb-4">
            {report.error_message || 'An error occurred while generating the report.'}
          </p>
          <Button onClick={handleGenerateReport}>
            <Sparkles className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </Card>
      )}

      {/* Loading */}
      {isLoading && !isGenerating && (
        <LoadingSpinner message="Loading report..." />
      )}

      {/* Info panel */}
      <Card className="bg-secondary border-secondary">
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            About Full Analysis Reports
          </h3>
          <p className="text-sm text-muted-foreground">
            The full analysis report provides a comprehensive breakdown of the earnings document including:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
            <li>Financial metrics with year-over-year comparisons</li>
            <li>Segment and geographic analysis</li>
            <li>Cash flow summary and free cash flow analysis</li>
            <li>Earnings quality assessment with EQ tables</li>
            <li>Working capital red flags and DSO trends</li>
            <li>Exceptional items breakdown by half-year</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
