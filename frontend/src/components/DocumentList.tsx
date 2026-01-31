import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { Document } from '../types';
import { documentsApi } from '../lib/api';

interface DocumentListProps {
  documents: Document[];
  onDelete?: (id: number) => void;
  onUpdate?: (doc: Document) => void;
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

const documentTypes = [
  { value: 'annual_report', label: 'Annual Report' },
  { value: 'half_year', label: 'Half-Year' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'asx_announcement', label: 'ASX Announcement' },
  { value: 'investor_presentation', label: 'Presentation' },
  { value: 'other', label: 'Other' },
];

interface EditState {
  company_name: string;
  company_ticker: string;
  document_type: string;
  reporting_period: string;
}

export default function DocumentList({ documents, onDelete, onUpdate, isLoading }: DocumentListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({
    company_name: '',
    company_ticker: '',
    document_type: '',
    reporting_period: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (doc: Document) => {
    setEditingId(doc.id);
    setEditState({
      company_name: doc.company_name,
      company_ticker: doc.company_ticker || '',
      document_type: doc.document_type,
      reporting_period: doc.reporting_period || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditState({
      company_name: '',
      company_ticker: '',
      document_type: '',
      reporting_period: '',
    });
  };

  const saveEditing = async () => {
    if (!editingId || !editState.company_name.trim()) return;

    setIsSaving(true);
    try {
      const updatedDoc = await documentsApi.update(editingId, {
        company_name: editState.company_name.trim(),
        company_ticker: editState.company_ticker.trim(),
        document_type: editState.document_type,
        reporting_period: editState.reporting_period.trim(),
      });
      onUpdate?.(updatedDoc);
      cancelEditing();
    } catch (error) {
      console.error('Failed to update document:', error);
    }
    setIsSaving(false);
  };

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
          const isEditing = editingId === doc.id;
          
          return (
            <li key={doc.id} className="hover:bg-gray-50 transition-colors">
              <div className="px-4 py-4">
                {isEditing ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Company Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editState.company_name}
                          onChange={(e) => setEditState(s => ({ ...s, company_name: e.target.value }))}
                          className="input text-sm py-1.5"
                          placeholder="Company name"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Ticker</label>
                        <input
                          type="text"
                          value={editState.company_ticker}
                          onChange={(e) => setEditState(s => ({ ...s, company_ticker: e.target.value.toUpperCase() }))}
                          className="input text-sm py-1.5"
                          placeholder="e.g., CBA"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Type</label>
                        <select
                          value={editState.document_type}
                          onChange={(e) => setEditState(s => ({ ...s, document_type: e.target.value }))}
                          className="input text-sm py-1.5"
                          disabled={isSaving}
                        >
                          {documentTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Period</label>
                        <input
                          type="text"
                          value={editState.reporting_period}
                          onChange={(e) => setEditState(s => ({ ...s, reporting_period: e.target.value }))}
                          className="input text-sm py-1.5"
                          placeholder="e.g., FY24"
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={cancelEditing}
                        disabled={isSaving}
                        className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                      >
                        <XMarkIcon className="w-4 h-4 mr-1" />
                        Cancel
                      </button>
                      <button
                        onClick={saveEditing}
                        disabled={isSaving || !editState.company_name.trim()}
                        className="flex items-center px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <CheckIcon className="w-4 h-4 mr-1" />
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center">
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
                      <button
                        onClick={() => startEditing(doc)}
                        className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors"
                        title="Edit document"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
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
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
