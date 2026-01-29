import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useDocuments } from '../context/DocumentContext';
import { usePolling } from '../hooks/usePolling';
import LoadingSpinner from '../components/LoadingSpinner';

const statusConfig: Record<string, {
  icon: typeof ClockIcon;
  color: string;
  bg: string;
  label: string;
  description: string;
  animate?: boolean;
}> = {
  pending: {
    icon: ClockIcon,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    label: 'Pending',
    description: 'Document is queued for processing',
  },
  processing: {
    icon: ArrowPathIcon,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    label: 'Processing',
    description: 'Extracting text and creating embeddings...',
    animate: true,
  },
  completed: {
    icon: CheckCircleIcon,
    color: 'text-green-500',
    bg: 'bg-green-50',
    label: 'Ready',
    description: 'Document is ready for analysis and chat',
  },
  failed: {
    icon: ExclamationCircleIcon,
    color: 'text-red-500',
    bg: 'bg-red-50',
    label: 'Failed',
    description: 'Processing failed. Please try uploading again.',
  },
};

const documentTypeLabels: Record<string, string> = {
  annual_report: 'Annual Report',
  half_year: 'Half-Year Results',
  quarterly: 'Quarterly Results',
  asx_announcement: 'ASX Announcement',
  investor_presentation: 'Investor Presentation',
  other: 'Other',
};

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDocument, selectDocument, refreshDocument, isLoading } = useDocuments();
  const [shouldPoll, setShouldPoll] = useState(false);

  useEffect(() => {
    if (id) {
      selectDocument(parseInt(id));
    }
  }, [id, selectDocument]);

  // Set up polling when document is processing
  useEffect(() => {
    if (selectedDocument?.status === 'processing' || selectedDocument?.status === 'pending') {
      setShouldPoll(true);
    } else {
      setShouldPoll(false);
    }
  }, [selectedDocument?.status]);

  // Poll for status updates
  usePolling(
    async () => {
      if (!id) return true;
      await refreshDocument(parseInt(id));
      
      // Stop polling if completed or failed
      if (selectedDocument?.status === 'completed' || selectedDocument?.status === 'failed') {
        return true;
      }
      return false;
    },
    { enabled: shouldPoll, interval: 3000 }
  );

  if (isLoading || !selectedDocument) {
    return <LoadingSpinner message="Loading document..." />;
  }

  const status = statusConfig[selectedDocument.status];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4 mr-2" />
        Back to Documents
      </button>

      {/* Document header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className={`w-14 h-14 ${status.bg} rounded-xl flex items-center justify-center`}>
              <DocumentTextIcon className={`w-7 h-7 ${status.color}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedDocument.company_name}
              </h1>
              <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                {selectedDocument.company_ticker && (
                  <span className="font-medium">{selectedDocument.company_ticker}</span>
                )}
                <span>{documentTypeLabels[selectedDocument.document_type]}</span>
                {selectedDocument.reporting_period && (
                  <>
                    <span>•</span>
                    <span>{selectedDocument.reporting_period}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className={`flex items-center px-3 py-1.5 rounded-full ${status.bg}`}>
            <StatusIcon
              className={`w-5 h-5 ${status.color} ${status.animate ? 'animate-spin' : ''}`}
            />
            <span className={`ml-2 text-sm font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Status description */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">{status.description}</p>
          {selectedDocument.error_message && (
            <p className="mt-2 text-sm text-red-600">{selectedDocument.error_message}</p>
          )}
        </div>

        {/* Document metadata */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Filename</p>
            <p className="mt-1 text-sm font-medium text-gray-900 truncate">
              {selectedDocument.filename}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Pages</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {selectedDocument.page_count || 'Processing...'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Uploaded</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {new Date(selectedDocument.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Processed</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {selectedDocument.processed_at
                ? new Date(selectedDocument.processed_at).toLocaleDateString()
                : 'Not yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {selectedDocument.status === 'completed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to={`/documents/${selectedDocument.id}/analysis`}
            className="card p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <ChartBarIcon className="w-6 h-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">View Analysis</h3>
                <p className="text-sm text-gray-500">
                  Extract and view Points of Interest from this document
                </p>
              </div>
            </div>
          </Link>

          <Link
            to={`/documents/${selectedDocument.id}/chat`}
            className="card p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center">
              <div className="w-12 h-12 bg-accent-100 rounded-lg flex items-center justify-center group-hover:bg-accent-200 transition-colors">
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-accent-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Chat with Document</h3>
                <p className="text-sm text-gray-500">
                  Ask questions about the full document content
                </p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Processing indicator */}
      {(selectedDocument.status === 'processing' || selectedDocument.status === 'pending') && (
        <div className="card p-8 text-center">
          <LoadingSpinner size="lg" message="Processing document... This may take a few minutes." />
        </div>
      )}
    </div>
  );
}
