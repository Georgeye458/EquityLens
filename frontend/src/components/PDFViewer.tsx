import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
  initialPage?: number;
  onClose?: () => void;
  documentName?: string;
}

export default function PDFViewer({
  url,
  initialPage = 1,
  onClose,
  documentName,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Navigate to page when initialPage changes (from citation click)
  useEffect(() => {
    if (initialPage && initialPage !== pageNumber) {
      setPageNumber(initialPage);
    }
  }, [initialPage]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err);
    setIsLoading(false);
    setError('Failed to load PDF. The file may not be available.');
  }, []);

  const goToPreviousPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(2.0, prev + 0.25));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.25));
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= numPages) {
      setPageNumber(value);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
            {documentName || 'PDF Viewer'}
          </span>
          {numPages > 0 && (
            <span className="text-xs text-gray-500">
              ({numPages} pages)
            </span>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        {/* Page navigation */}
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={pageNumber <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-1">
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={handlePageInput}
              className="w-12 h-8 text-center text-sm border border-gray-300 rounded"
            />
            <span className="text-sm text-gray-500">/ {numPages}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Zoom controls */}
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 2.0}
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            <span className="text-sm text-gray-500 mt-2">Loading PDF...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
            <p className="text-sm text-gray-600">{error}</p>
            <p className="text-xs text-gray-400 mt-2">
              PDFs may not be available after server restarts on Heroku's free tier.
            </p>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          error={null}
          className="pdf-document"
        >
          {!isLoading && !error && (
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-lg"
              loading={
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              }
            />
          )}
        </Document>
      </div>

      {/* Page highlight indicator */}
      {initialPage && initialPage === pageNumber && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-primary-600 text-white px-3 py-1 rounded-full text-xs shadow-lg animate-pulse">
          Page {pageNumber} from citation
        </div>
      )}
    </div>
  );
}
