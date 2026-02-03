import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  BarChart3,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { useDocuments } from '../context/DocumentContext';
import { usePolling } from '../hooks/usePolling';
import LoadingSpinner from '../components/LoadingSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, {
  icon: typeof Clock;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  label: string;
  description: string;
  animate?: boolean;
}> = {
  pending: {
    icon: Clock,
    variant: 'warning',
    label: 'Pending',
    description: 'Document is queued for processing',
  },
  processing: {
    icon: RefreshCw,
    variant: 'info',
    label: 'Processing',
    description: 'Extracting text and creating embeddings...',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    variant: 'success',
    label: 'Ready',
    description: 'Document is ready for analysis and chat',
  },
  failed: {
    icon: AlertCircle,
    variant: 'destructive',
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

  useEffect(() => {
    if (selectedDocument?.status === 'processing' || selectedDocument?.status === 'pending') {
      setShouldPoll(true);
    } else {
      setShouldPoll(false);
    }
  }, [selectedDocument?.status]);

  usePolling(
    async () => {
      if (!id) return true;
      await refreshDocument(parseInt(id));
      
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
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Documents
      </Button>

      {/* Document header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center",
                status.variant === 'warning' && "bg-yellow-100",
                status.variant === 'info' && "bg-blue-100",
                status.variant === 'success' && "bg-green-100",
                status.variant === 'destructive' && "bg-red-100"
              )}>
                <FileText className={cn(
                  "w-7 h-7",
                  status.variant === 'warning' && "text-yellow-600",
                  status.variant === 'info' && "text-blue-600",
                  status.variant === 'success' && "text-green-600",
                  status.variant === 'destructive' && "text-red-600"
                )} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {selectedDocument.company_name}
                </h1>
                <div className="flex items-center space-x-3 mt-1 text-sm text-muted-foreground">
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
            <Badge variant={status.variant} className="flex items-center gap-1.5">
              <StatusIcon
                className={cn(
                  "w-4 h-4",
                  status.animate && "animate-spin"
                )}
              />
              {status.label}
            </Badge>
          </div>

          {/* Status description */}
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{status.description}</p>
            {selectedDocument.error_message && (
              <p className="mt-2 text-sm text-destructive">{selectedDocument.error_message}</p>
            )}
          </div>

          {/* Document metadata */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Filename</p>
              <p className="mt-1 text-sm font-medium text-foreground truncate">
                {selectedDocument.filename}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Pages</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {selectedDocument.page_count || 'Processing...'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Uploaded</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {new Date(selectedDocument.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Processed</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {selectedDocument.processed_at
                  ? new Date(selectedDocument.processed_at).toLocaleDateString()
                  : 'Not yet'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {selectedDocument.status === 'completed' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to={`/documents/${selectedDocument.id}/analysis`}>
            <Card className="p-6 hover:shadow-md transition-shadow group cursor-pointer h-full">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center group-hover:bg-accent transition-colors">
                  <BarChart3 className="w-6 h-6 text-foreground" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-foreground">Quick Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Extract key Points of Interest
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to={`/documents/${selectedDocument.id}/report`}>
            <Card className="p-6 hover:shadow-md transition-shadow group cursor-pointer h-full border-primary/20">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FileSpreadsheet className="w-6 h-6 text-primary" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-foreground">Full Report</h3>
                  <p className="text-sm text-muted-foreground">
                    Comprehensive analysis with EQ tables
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to={`/documents/${selectedDocument.id}/chat`}>
            <Card className="p-6 hover:shadow-md transition-shadow group cursor-pointer h-full">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center group-hover:bg-accent transition-colors">
                  <MessageSquare className="w-6 h-6 text-foreground" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-foreground">Chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask questions about the document
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {/* Processing indicator */}
      {(selectedDocument.status === 'processing' || selectedDocument.status === 'pending') && (
        <Card className="p-8 text-center">
          <LoadingSpinner size="lg" message="Processing document... This may take a few minutes." />
        </Card>
      )}
    </div>
  );
}
