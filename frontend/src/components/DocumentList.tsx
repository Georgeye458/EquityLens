import { Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Document } from '../types';

interface DocumentListProps {
  documents: Document[];
  onDelete?: (id: number) => void;
  isLoading?: boolean;
}

const statusConfig: Record<string, {
  icon: typeof ClockIcon;
  color: string;
  bg: string;
  label: string;
  animate?: boolean;
}> = {
  pending: {
    icon: ClockIcon,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    label: 'Pending',
  },
  processing: {
    icon: ArrowPathIcon,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    label: 'Processing',
    animate: true,
  },
  completed: {
    icon: CheckCircleIcon,
    color: 'text-green-500',
    bg: 'bg-green-50',
    label: 'Ready',
  },
  failed: {
    icon: ExclamationCircleIcon,
    color: 'text-red-500',
    bg: 'bg-red-50',
    label: 'Failed',
  },
};

const documentTypeLabels: Record<string, string> = {
  annual_report: 'Annual Report',
  half_year: 'Half-Year',
  quarterly: 'Quarterly',
  asx_announcement: 'ASX Announcement',
  investor_presentation: 'Presentation',
  other: 'Other',
};

export default function DocumentList({ documents, onDelete, isLoading }: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="card p-8">
        <div className="flex items-center justify-center">
          <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-500">Loading documents...</span>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="card p-8 text-center">
        <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No documents yet</h3>
        <p className="text-sm text-gray-500">Upload your first earnings report to get started.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700">
          {documents.length} Document{documents.length !== 1 ? 's' : ''}
        </h3>
      </div>
      
      <ul className="divide-y divide-gray-200">
        {documents.map((doc) => {
          const status = statusConfig[doc.status];
          const StatusIcon = status.icon;
          
          return (
            <li key={doc.id} className="hover:bg-gray-50 transition-colors">
              <div className="px-4 py-4 flex items-center">
                {/* Document icon */}
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 ${status.bg} rounded-lg flex items-center justify-center`}>
                    <DocumentTextIcon className={`w-5 h-5 ${status.color}`} />
                  </div>
                </div>
                
                {/* Document info */}
                <div className="ml-4 flex-1 min-w-0">
                  <Link
                    to={`/documents/${doc.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block"
                  >
                    {doc.company_name}
                    {doc.company_ticker && (
                      <span className="ml-2 text-gray-500">({doc.company_ticker})</span>
                    )}
                  </Link>
                  <div className="flex items-center mt-1 space-x-3 text-xs text-gray-500">
                    <span>{documentTypeLabels[doc.document_type] || doc.document_type}</span>
                    {doc.reporting_period && (
                      <>
                        <span>•</span>
                        <span>{doc.reporting_period}</span>
                      </>
                    )}
                    {doc.page_count && (
                      <>
                        <span>•</span>
                        <span>{doc.page_count} pages</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Status */}
                <div className="ml-4 flex items-center">
                  <div className={`flex items-center px-2.5 py-1 rounded-full ${status.bg}`}>
                    <StatusIcon
                      className={`w-4 h-4 ${status.color} ${status.animate ? 'animate-spin' : ''}`}
                    />
                    <span className={`ml-1.5 text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="ml-4 flex items-center space-x-2">
                  {doc.status === 'completed' && (
                    <>
                      <Link
                        to={`/documents/${doc.id}/analysis`}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Analysis
                      </Link>
                      <Link
                        to={`/documents/${doc.id}/chat`}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        Chat
                      </Link>
                    </>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(doc.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete document"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
