import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDown,
  ChevronRight,
  Printer,
  Download,
  Clock,
  FileText,
} from 'lucide-react';
import type { Report, CitationDetail } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ReportViewerProps {
  report: Report;
  onCitationClick?: (citation: CitationDetail) => void;
}

// Extract sections from markdown content
function extractSections(content: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = content.split('\n');
  
  let currentTitle = '';
  let currentContent: string[] = [];
  
  for (const line of lines) {
    // Match h2 or h3 headers
    const match = line.match(/^#{2,3}\s+(.+)$/);
    if (match) {
      // Save previous section
      if (currentTitle || currentContent.length > 0) {
        sections.push({
          title: currentTitle || 'Introduction',
          content: currentContent.join('\n').trim(),
        });
      }
      currentTitle = match[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  
  // Don't forget the last section
  if (currentTitle || currentContent.length > 0) {
    sections.push({
      title: currentTitle || 'Introduction',
      content: currentContent.join('\n').trim(),
    });
  }
  
  return sections;
}

// Citation pattern matching
const CITATION_REGEX = /\[([^\]]+?)\s+-\s+Page\s+(\d+)\]/gi;

// Parse citation string to extract details
function parseCitationString(text: string): CitationDetail | null {
  // Format: "DOC - Page X" or "CompanyName - Page X"
  const match = text.match(/^(.+?)\s+-\s+Page\s+(\d+)$/i);
  if (match) {
    return {
      document_name: match[1],
      page_number: parseInt(match[2], 10),
      bbox: undefined,
      document_id: undefined,
    };
  }
  return null;
}

export default function ReportViewer({ report, onCitationClick }: ReportViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(Array.from({ length: 10 }, (_, i) => i)) // All expanded by default
  );
  
  // Preprocess content to convert citations to clickable links
  const preprocessContent = useCallback((content: string): string => {
    if (!onCitationClick) return content;
    
    return content.replace(CITATION_REGEX, (fullMatch, citationText, pageNum) => {
      const encoded = encodeURIComponent(citationText + ' - Page ' + pageNum);
      return `[📄 ${citationText} - Page ${pageNum}](#cite:${encoded})`;
    });
  }, [onCitationClick]);
  
  // Handle citation click from markdown links
  const handleInlineCitationClick = useCallback((citationText: string) => {
    if (!onCitationClick) return;
    
    const parsed = parseCitationString(citationText);
    if (parsed) {
      onCitationClick(parsed);
    }
  }, [onCitationClick]);
  
  // Custom link renderer for citations
  const MarkdownComponents = {
    a: (props: any) => {
      const { href, children } = props;
      
      if (href?.startsWith('#cite:')) {
        const citationText = decodeURIComponent(href.replace('#cite:', ''));
        
        return (
          <button
            onClick={(e) => {
              e.preventDefault();
              handleInlineCitationClick(citationText);
            }}
            className="inline-flex items-center text-primary hover:text-primary/80 hover:underline font-medium text-xs mx-0.5 transition-colors"
          >
            {children}
          </button>
        );
      }
      
      // Regular link
      return (
        <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    const sections = extractSections(report.content || '');
    setExpandedSections(new Set(sections.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!report.content) return;
    
    const blob = new Blob([report.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.company_name || 'report'}_${report.reporting_period || 'analysis'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!report.content) {
    return (
      <Card className="p-8 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Report Content</h3>
        <p className="text-sm text-muted-foreground">
          The report has not been generated yet or failed to generate.
        </p>
      </Card>
    );
  }

  const sections = extractSections(report.content);

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">
                {report.company_name} - Full Analysis Report
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {report.reporting_period || 'Financial Analysis'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {report.processing_time_seconds?.toFixed(1)}s
              </Badge>
              <Badge variant="outline">{report.model_used}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Sections */}
      <div className="space-y-3 print:space-y-4">
        {sections.map((section, index) => {
          const isExpanded = expandedSections.has(index);
          
          return (
            <Card key={index} className="overflow-hidden">
              <Button
                variant="ghost"
                onClick={() => toggleSection(index)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted rounded-none h-auto print:hidden"
              >
                <div className="flex items-center">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground mr-2" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground mr-2" />
                  )}
                  <h3 className="text-sm font-semibold text-foreground text-left">
                    {section.title}
                  </h3>
                </div>
              </Button>
              
              {/* Print header (always visible in print) */}
              <div className="hidden print:block px-4 py-2 border-b">
                <h3 className="text-lg font-semibold">{section.title}</h3>
              </div>

              {(isExpanded || true) && (
                <div className={cn(
                  "px-4 py-4",
                  !isExpanded && "hidden print:block"
                )}>
                  <ScrollArea className="max-h-[1200px] print:max-h-none">
                    <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-table:w-full prose-table:text-xs prose-table:overflow-x-auto prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:border prose-th:border-border prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-border prose-table:border-collapse">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={MarkdownComponents}
                      >
                        {preprocessContent(section.content)}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <Separator />
      <div className="text-center text-xs text-muted-foreground py-4">
        <p>
          Report generated on {new Date(report.completed_at || report.created_at).toLocaleString()}
          {' '}using {report.model_used}
        </p>
        <p className="mt-1">
          Processing time: {report.processing_time_seconds?.toFixed(1)} seconds
        </p>
      </div>
    </div>
  );
}
