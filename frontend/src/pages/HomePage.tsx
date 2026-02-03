import { useEffect } from 'react';
import { useDocuments } from '../context/DocumentContext';
import { documentsApi } from '../lib/api';
import FileUpload from '../components/FileUpload';
import DocumentList from '../components/DocumentList';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const {
    documents,
    isLoading,
    error,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    updateDocumentInList,
    clearError,
  } = useDocuments();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (
    file: File,
    metadata: {
      company_name: string;
      company_ticker?: string;
      document_type?: string;
      reporting_period?: string;
    }
  ) => {
    await uploadDocument(file, metadata);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteDocument(id);
    }
  };

  const handleBulkDelete = async (ids: number[]) => {
    try {
      // Delete all documents in parallel without refreshing between each
      await Promise.all(
        ids.map(id => documentsApi.delete(id))
      );
      // Refresh list once at the end
      await fetchDocuments();
    } catch (err) {
      console.error('Bulk delete error:', err);
      // Refresh to show current state even if some failed
      await fetchDocuments();
      throw err;
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Earnings Report Analysis
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload earnings documents and get instant AI-powered analysis with full document chat capabilities.
          Reduce analysis time from 90 minutes to under 10 minutes.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload section */}
        <div className="lg:col-span-1">
          <FileUpload onUpload={handleUpload} isLoading={isLoading} />

          {/* Quick tips */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Quick Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-primary mr-2">1.</span>
                  Upload PDF earnings reports (up to 300 pages)
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">2.</span>
                  Wait for processing to complete
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">3.</span>
                  Run analysis to extract Points of Interest
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">4.</span>
                  Use chat for follow-up questions
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Document list */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Your Documents</h2>
          <DocumentList
            documents={documents}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onUpdate={updateDocumentInList}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Features section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="font-semibold text-foreground mb-2">POI Extraction</h3>
            <p className="text-sm text-muted-foreground">
              Automatically extract financial metrics, segment analysis, cash flow, and management commentary.
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="font-semibold text-foreground mb-2">Full Document Chat</h3>
            <p className="text-sm text-muted-foreground">
              Ask questions about the entire document, not just extracted data. Get cited answers.
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📑</span>
            </div>
            <h3 className="font-semibold text-foreground mb-2">Page Citations</h3>
            <p className="text-sm text-muted-foreground">
              Every insight is linked to its source page for easy verification and traceability.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
