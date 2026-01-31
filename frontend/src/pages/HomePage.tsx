import { useEffect } from 'react';
import { useDocuments } from '../context/DocumentContext';
import FileUpload from '../components/FileUpload';
import DocumentList from '../components/DocumentList';

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
    for (const id of ids) {
      await deleteDocument(id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Earnings Report Analysis
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload earnings documents and get instant AI-powered analysis with full document chat capabilities.
          Reduce analysis time from 90 minutes to under 10 minutes.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload section */}
        <div className="lg:col-span-1">
          <FileUpload onUpload={handleUpload} isLoading={isLoading} />

          {/* Quick tips */}
          <div className="mt-6 card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Tips</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">1.</span>
                Upload PDF earnings reports (up to 300 pages)
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">2.</span>
                Wait for processing to complete
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">3.</span>
                Run analysis to extract Points of Interest
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">4.</span>
                Use chat for follow-up questions
              </li>
            </ul>
          </div>
        </div>

        {/* Document list */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Documents</h2>
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
        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">POI Extraction</h3>
          <p className="text-sm text-gray-600">
            Automatically extract financial metrics, segment analysis, cash flow, and management commentary.
          </p>
        </div>

        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💬</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Full Document Chat</h3>
          <p className="text-sm text-gray-600">
            Ask questions about the entire document, not just extracted data. Get cited answers.
          </p>
        </div>

        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📑</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Page Citations</h3>
          <p className="text-sm text-gray-600">
            Every insight is linked to its source page for easy verification and traceability.
          </p>
        </div>
      </div>
    </div>
  );
}
