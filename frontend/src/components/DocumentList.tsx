import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Pencil,
  Check,
  X,
  RotateCcw,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import type { Document } from '../types';
import { documentsApi } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DocumentListProps {
  documents: Document[];
  onDelete?: (id: number) => void;
  onBulkDelete?: (ids: number[]) => Promise<void>;
  onUpdate?: (doc: Document) => void;
  isLoading?: boolean;
}

const statusConfig: Record<string, {
  icon: typeof Clock;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  label: string;
  animate?: boolean;
}> = {
  pending: {
    icon: Clock,
    variant: 'warning',
    label: 'Pending',
  },
  processing: {
    icon: RefreshCw,
    variant: 'info',
    label: 'Processing',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    variant: 'success',
    label: 'Ready',
  },
  failed: {
    icon: AlertCircle,
    variant: 'destructive',
    label: 'Failed',
  },
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

function getDocumentDisplayName(doc: Document): string {
  const parts: string[] = [];
  
  if (doc.company_ticker) {
    parts.push(doc.company_ticker);
  } else {
    parts.push(doc.company_name);
  }
  
  if (doc.reporting_period) {
    parts.push(doc.reporting_period);
  }
  
  const typeAbbrev: Record<string, string> = {
    annual_report: 'Annual',
    half_year: 'H1',
    quarterly: 'Quarterly',
    asx_announcement: 'ASX',
    investor_presentation: 'Presentation',
    other: '',
  };
  const typeLabel = typeAbbrev[doc.document_type];
  if (typeLabel) {
    parts.push(typeLabel);
  }
  
  return parts.join(' ');
}

export default function DocumentList({ documents, onDelete, onBulkDelete, onUpdate, isLoading }: DocumentListProps) {
  const navigate = useNavigate();
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

  const completedSelectedIds = Array.from(selectedIds).filter(id => {
    const doc = documents.find(d => d.id === id);
    return doc && doc.status === 'completed';
  });
  const completedCount = completedSelectedIds.length;

  const handleChatWithSelected = () => {
    if (completedCount === 0) return;
    const idsParam = completedSelectedIds.join(',');
    navigate(`/chat?documents=${idsParam}`);
  };

  const handleAnalyzeSelected = () => {
    if (completedCount === 0) return;
    const idsParam = completedSelectedIds.join(',');
    navigate(`/compare?documents=${idsParam}`);
  };

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

  const retryableCount = Array.from(selectedIds).filter(id => {
    const doc = documents.find(d => d.id === id);
    return doc && (doc.status === 'failed' || doc.status === 'processing' || doc.status === 'pending');
  }).length;

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
          <span className="ml-3 text-muted-foreground">Loading documents...</span>
        </div>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-foreground mb-1">No documents yet</h3>
        <p className="text-sm text-muted-foreground">Upload your first earnings report to get started.</p>
      </Card>
    );
  }

  const allSelected = selectedIds.size === documents.length;
  const someSelected = selectedIds.size > 0;

  return (
    <Card className="overflow-hidden">
      {/* Header with select all and bulk actions */}
      <div className="px-4 py-3 bg-muted/50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
              className={someSelected && !allSelected ? "data-[state=checked]:bg-primary" : ""}
            />
            <h3 className="text-sm font-medium text-muted-foreground">
              {someSelected 
                ? `${selectedIds.size} selected`
                : `${documents.length} Document${documents.length !== 1 ? 's' : ''}`
              }
            </h3>
          </div>

          {/* Bulk actions */}
          {someSelected && (
            <div className="flex items-center space-x-2">
              {completedCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleChatWithSelected}
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Chat ({completedCount})
                </Button>
              )}
              {completedCount > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAnalyzeSelected}
                  className="bg-green-100 text-green-700 hover:bg-green-200"
                >
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Compare ({completedCount})
                </Button>
              )}
              {retryableCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkRetry}
                  disabled={isBulkRetrying}
                  className="bg-amber-100 text-amber-700 hover:bg-amber-200"
                >
                  {isBulkRetrying ? (
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3 mr-1" />
                  )}
                  Retry ({retryableCount})
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3 mr-1" />
                )}
                Delete ({selectedIds.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <ul className="divide-y divide-border">
        {documents.map((doc) => {
          const status = statusConfig[doc.status];
          const StatusIcon = status.icon;
          const isEditing = editingId === doc.id;
          const isSelected = selectedIds.has(doc.id);
          
          return (
            <li 
              key={doc.id} 
              className={cn(
                "transition-colors",
                isSelected ? "bg-accent/50" : "hover:bg-muted/50"
              )}
            >
              <div className="px-4 py-4">
                {isEditing ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Company Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="text"
                          value={editState.company_name}
                          onChange={(e) => setEditState(s => ({ ...s, company_name: e.target.value }))}
                          placeholder="Company name"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Ticker</label>
                        <Input
                          type="text"
                          value={editState.company_ticker}
                          onChange={(e) => setEditState(s => ({ ...s, company_ticker: e.target.value.toUpperCase() }))}
                          placeholder="e.g., CBA"
                          disabled={isSaving}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                        <Select
                          value={editState.document_type}
                          onValueChange={(value) => setEditState(s => ({ ...s, document_type: value }))}
                          disabled={isSaving}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Period</label>
                        <Input
                          type="text"
                          value={editState.reporting_period}
                          onChange={(e) => setEditState(s => ({ ...s, reporting_period: e.target.value }))}
                          placeholder="e.g., FY24"
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEditing}
                        disabled={isSaving || !editState.company_name.trim()}
                      >
                        {isSaving ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center">
                    {/* Checkbox */}
                    <div className="flex-shrink-0 mr-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(doc.id)}
                      />
                    </div>

                    {/* Document icon */}
                    <div className="flex-shrink-0">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        status.variant === 'warning' && "bg-yellow-100",
                        status.variant === 'info' && "bg-blue-100",
                        status.variant === 'success' && "bg-green-100",
                        status.variant === 'destructive' && "bg-red-100"
                      )}>
                        <FileText className={cn(
                          "w-5 h-5",
                          status.variant === 'warning' && "text-yellow-600",
                          status.variant === 'info' && "text-blue-600",
                          status.variant === 'success' && "text-green-600",
                          status.variant === 'destructive' && "text-red-600"
                        )} />
                      </div>
                    </div>
                    
                    {/* Document info */}
                    <div className="ml-4 flex-1 min-w-0">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="text-sm font-medium text-foreground hover:text-primary truncate block"
                      >
                        {getDocumentDisplayName(doc)}
                      </Link>
                      <div className="flex items-center mt-1 space-x-3 text-xs text-muted-foreground">
                        <span className="truncate max-w-[200px]" title={doc.filename}>
                          {doc.filename}
                        </span>
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
                      <Badge variant={status.variant} className="flex items-center gap-1">
                        <StatusIcon
                          className={cn(
                            "w-3 h-3",
                            status.animate && "animate-spin"
                          )}
                        />
                        {status.label}
                      </Badge>
                    </div>
                    
                    {/* Actions */}
                    <div className="ml-4 flex items-center space-x-2">
                      {doc.status === 'completed' && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/documents/${doc.id}/analysis`}>
                              Analysis
                            </Link>
                          </Button>
                          <Button size="sm" asChild>
                            <Link to={`/documents/${doc.id}/chat`}>
                              Chat
                            </Link>
                          </Button>
                        </>
                      )}
                      {(doc.status === 'failed' || doc.status === 'processing' || doc.status === 'pending') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRetry(doc)}
                          disabled={retryingId === doc.id}
                          className="bg-amber-100 text-amber-700 hover:bg-amber-200"
                          title={doc.status === 'pending' ? 'Start processing' : 'Retry processing'}
                        >
                          {retryingId === doc.id ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3 mr-1" />
                          )}
                          {doc.status === 'pending' ? 'Process' : 'Retry'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditing(doc)}
                        title="Edit document"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(doc.id)}
                          title="Delete document"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
