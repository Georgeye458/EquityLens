import { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoadingSpinner from './LoadingSpinner';
import { documentsApi } from '../lib/api';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker - use HTTPS to avoid CORS issues
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  documentId: number;
  targetPage?: number;
  highlight?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function PDFViewer({ documentId, targetPage, highlight, isFullscreen, onToggleFullscreen }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);

  // Generate PDF URL using the same API configuration as the rest of the app
  const pdfUrl = useMemo(() => {
    return documentsApi.getPdfUrl(documentId);
  }, [documentId]);
  
  // Calculate page width based on fullscreen mode
  const pageWidth = useMemo(() => {
    return isFullscreen ? 1200 : 550;
  }, [isFullscreen]);

  // Jump to target page when prop changes
  useEffect(() => {
    if (targetPage && targetPage > 0 && targetPage <= numPages) {
      setPageNumber(targetPage);
    }
  }, [targetPage, numPages]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
    
    // Jump to target page after load
    if (targetPage && targetPage > 0) {
      setPageNumber(targetPage);
    }
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF load error:', error);
    setIsLoading(false);
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            {numPages > 0 ? `${pageNumber} / ${numPages}` : 'Loading...'}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-4 h-4 mr-2" />
              Exit Fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4 mr-2" />
              Fullscreen
            </>
          )}
        </Button>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        <div className="flex justify-center">
          {isLoading && (
            <div className="py-12">
              <LoadingSpinner message="Loading PDF..." />
            </div>
          )}
          
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
          >
            <div className="relative inline-block">
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                className="shadow-lg"
              />
              
              {/* Highlight overlay (for future bbox support) */}
              {highlight && (
                <div
                  className="absolute border-2 border-yellow-400 bg-yellow-200/30 pointer-events-none rounded"
                  style={{
                    left: `${highlight.x}px`,
                    top: `${highlight.y}px`,
                    width: `${highlight.width}px`,
                    height: `${highlight.height}px`,
                  }}
                />
              )}
            </div>
          </Document>
        </div>
      </div>
    </div>
  );
}
