import { useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePDFViewer } from '../context/PDFViewerContext';
import PDFViewer from './PDFViewer';
import { cn } from '@/lib/utils';

export default function PDFViewerPanel() {
  const { isOpen, isFullscreen, documentId, targetPage, highlight, closePDFViewer, toggleFullscreen } = usePDFViewer();

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closePDFViewer();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closePDFViewer]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={closePDFViewer}
      />

      {/* Slide-out panel from right */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-50",
          "transform transition-all duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          isFullscreen ? "w-full" : "w-[600px] max-w-[90vw]"
        )}
      >
        <Card className="h-full rounded-none shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-card">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Source Document
              </h3>
              {targetPage && (
                <span className="text-xs text-muted-foreground">
                  • Page {targetPage}
                </span>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={closePDFViewer}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-hidden">
            {documentId ? (
              <PDFViewer
                documentId={documentId}
                targetPage={targetPage || 1}
                highlight={highlight || undefined}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No document selected
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Esc</kbd> to close
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
