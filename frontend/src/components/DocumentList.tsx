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
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import type { Document } from '../types';
import { documentsApi } from '../lib/api';

interface DocumentListProps {
  documents: Document[];
  onDelete?: (id: number) => void;
  onBulkDelete?: (ids: number[]) => Promise<void>;
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

export default function DocumentList({ documents, onDelete, onBulkDelete, onUpdate, isLoading }: DocumentListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({
    company_name: '',
    company_ticker: '',
    document_type: '',
    reporting_period: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkRetrying, setIsBulkRetrying] = useState(false);

  const handleRetry = async (doc: Document) => {
    setRetryingId(doc.id);
    try {
      await documentsApi.reprocess(doc.id);
      onUpdate?.({ ...doc, status: 'pending', error_message: null });
    } catch (error) {
      console.error('Failed to reprocess document:', error);
    }
    setRetryingId(null);
  };

  const handleBulkRetry = async () => {
    setIsBulkRetrying(true);
    const retryableIds = Array.from(selectedIds).filter(id => {
      const doc = documents.find(d => d.id === id);
      return doc && (doc.status === 'failed' || doc.status === 'processing' || doc.status === 'pending');
    });

    for (const id of retryableIds) {
      try {
        await documentsApi.reprocess(id);
        const doc = documents.find(d => d.id === id);
        if (doc) {
          onUpdate?.({ ...doc, status: 'pending', error_message: null });
        }
      } catch (error) {
        console.error(`Failed to reprocess document ${id}:`, error);
      }
    }

    setSelectedIds(new Set());
    setIsBulkRetrying(false);
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete && !onDelete) return;
    
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    const confirmMsg = idsToDelete.length === 1
      ? 'Are you sure you want to delete this document?'
      : `Are you sure you want to delete ${idsToDelete.length} documents?`;
    
    if (!window.confirm(confirmMsg)) return;

    setIsBulkDeleting(true);

    if (onBulkDelete) {
      await onBulkDelete(idsToDelete);
    } else if (onDelete) {
      for (const id of idsToDelete) {
        await onDelete(id);
      }
    }

    setSelectedIds(new Set());
    setIsBulkDeleting(false);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  };

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

  // Count retryable documents in selection (including pending)
  const retryableCount = Array.from(selectedIds).filter(id => {
    const doc = documents.find(d => d.id === id);
    return doc && (doc.status === 'failed' || doc.status === 'processing' || doc.status === 'pending');
  }).length;

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

  const allSelected = selectedIds.size === documents.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="card overflow-hidden">
      {/* Header with select all and bulk actions */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={toggleSelectAll}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <h3 className="text-sm font-medium text-gray-700">
              {someSelected 
                ? `${selectedIds.size} selected`
                : `${documents.length} Document${documents.length !== 1 ? 's' : ''}`
              }
            </h3>
          </div>

          {/* Bulk actions */}
          {someSelected && (
            <div className="flex items-center space-x-2">
              {retryableCount > 0 && (
                <button
                  onClick={handleBulkRetry}
                  disabled={isBulkRetrying}
                  className="flex items-center text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                >
                  {isBulkRetrying ? (
                    <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <ArrowUturnLeftIcon className="w-3 h-3 mr-1" />
                  )}
                  Retry ({retryableCount})
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <TrashIcon className="w-3 h-3 mr-1" />
                )}
                Delete ({selectedIds.size})
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 px-2"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
      
      <ul className="divide-y divide-gray-200">
        {documents.map((doc) => {
          const status = statusConfig[doc.status];
          const StatusIcon = status.icon;
          const isEditing = editingId === doc.id;
          const isSelected = selectedIds.has(doc.id);
          
          return (
            <li 
              key={doc.id} 
              className={`transition-colors ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
            >
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
                    {/* Checkbox */}
                    <div className="flex-shrink-0 mr-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(doc.id)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                    </div>

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
                      {(doc.status === 'failed' || doc.status === 'processing' || doc.status === 'pending') && (
                        <button
                          onClick={() => handleRetry(doc)}
                          disabled={retryingId === doc.id}
                          className="flex items-center text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                          title={doc.status === 'pending' ? 'Start processing' : 'Retry processing'}
                        >
                          {retryingId === doc.id ? (
                            <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <ArrowUturnLeftIcon className="w-3 h-3 mr-1" />
                          )}
                          {doc.status === 'pending' ? 'Process' : 'Retry'}
                        </button>
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
