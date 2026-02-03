import { createContext, useContext, useState, ReactNode } from 'react';

interface Citation {
  id: string;
  page: number;
  text: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface PDFViewerContextType {
  isOpen: boolean;
  isFullscreen: boolean;
  documentId: number | null;
  targetPage: number | null;
  highlight: Citation['bbox'] | null;
  openPDFViewer: (documentId: number, page: number, highlight?: Citation['bbox']) => void;
  closePDFViewer: () => void;
  toggleFullscreen: () => void;
}

const PDFViewerContext = createContext<PDFViewerContextType | undefined>(undefined);

export function PDFViewerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<Citation['bbox'] | null>(null);

  const openPDFViewer = (
    docId: number,
    page: number,
    highlightBbox?: Citation['bbox']
  ) => {
    setDocumentId(docId);
    setTargetPage(page);
    setHighlight(highlightBbox || null);
    setIsOpen(true);
  };

  const closePDFViewer = () => {
    setIsOpen(false);
    setIsFullscreen(false);
    // Keep document loaded for smooth reopening
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <PDFViewerContext.Provider
      value={{
        isOpen,
        isFullscreen,
        documentId,
        targetPage,
        highlight,
        openPDFViewer,
        closePDFViewer,
        toggleFullscreen,
      }}
    >
      {children}
    </PDFViewerContext.Provider>
  );
}

export function usePDFViewer() {
  const context = useContext(PDFViewerContext);
  if (!context) {
    throw new Error('usePDFViewer must be used within PDFViewerProvider');
  }
  return context;
}
