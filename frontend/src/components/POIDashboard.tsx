import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { POIsByCategory, POI, Citation } from '../types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface POIDashboardProps {
  categories: POIsByCategory[];
  onCitationClick?: (citation: Citation) => void;
}

const categoryIcons: Record<string, string> = {
  financial_metrics: '📊',
  segment_analysis: '📈',
  cash_flow: '💰',
  earnings_quality: '🔍',
  management_commentary: '💬',
};

export default function POIDashboard({ categories, onCitationClick }: POIDashboardProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.category))
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const renderValue = (poi: POI) => {
    const { value, output_type } = poi;

    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">Not found</span>;
    }

    switch (output_type) {
      case 'value':
        return <span className="font-medium text-foreground">{value !== null && value !== undefined ? String(value) : ''}</span>;

      case 'value_delta':
        if (typeof value === 'object' && value !== null) {
          const v = value as Record<string, unknown>;
          return (
            <div className="space-y-1">
              <div className="flex items-baseline space-x-2">
                <span className="font-semibold text-foreground">
                  {v.current !== undefined ? String(v.current) : '-'}
                </span>
                {v.unit ? <span className="text-xs text-muted-foreground">{String(v.unit)}</span> : null}
              </div>
              {v.change_percent !== undefined && (
                <span
                  className={cn(
                    "text-sm",
                    Number(v.change_percent) >= 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {Number(v.change_percent) >= 0 ? '+' : ''}
                  {Number(v.change_percent).toFixed(1)}%
                </span>
              )}
              {v.prior !== undefined && (
                <span className="text-xs text-muted-foreground block">
                  Prior: {String(v.prior)}
                </span>
              )}
            </div>
          );
        }
        return <span className="font-medium text-foreground">{String(value)}</span>;

      case 'multi_value':
      case 'array':
        if (Array.isArray(value)) {
          return (
            <ul className="space-y-1">
              {value.map((item, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">
                  {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (typeof value === 'object') {
          return (
            <dl className="space-y-1">
              {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">{k}:</dt>
                  <dd className="font-medium text-foreground">{String(v)}</dd>
                </div>
              ))}
            </dl>
          );
        }
        return <span className="font-medium text-foreground">{String(value)}</span>;

      case 'commentary':
        return (
          <p className="text-sm text-muted-foreground leading-relaxed">{String(value)}</p>
        );

      default:
        return (
          <span className="font-medium text-foreground">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        );
    }
  };

  const renderCitations = (citations: Citation[] | null) => {
    if (!citations || citations.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {citations.map((citation, idx) => (
          <button
            key={idx}
            onClick={() => onCitationClick?.(citation)}
            className="citation"
            title={citation.text}
          >
            <FileText className="w-3 h-3 mr-1" />
            p.{citation.page_number}
          </button>
        ))}
      </div>
    );
  };

  const renderConfidence = (confidence: number | null) => {
    if (confidence === null) return null;

    const level = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
    const variants: Record<string, 'success' | 'warning' | 'destructive'> = {
      high: 'success',
      medium: 'warning',
      low: 'destructive',
    };

    return (
      <Badge variant={variants[level]} className="text-xs">
        {Math.round(confidence * 100)}%
      </Badge>
    );
  };

  if (categories.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No analysis data available.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const isExpanded = expandedCategories.has(category.category);

        return (
          <Card key={category.category} className="overflow-hidden">
            {/* Category header */}
            <Button
              variant="ghost"
              onClick={() => toggleCategory(category.category)}
              className="w-full px-4 py-3 bg-muted/50 border-b flex items-center justify-between hover:bg-muted rounded-none h-auto"
            >
              <div className="flex items-center">
                <span className="text-lg mr-2">
                  {categoryIcons[category.category] || '📋'}
                </span>
                <h3 className="text-sm font-semibold text-foreground">
                  {category.category_display}
                </h3>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({category.pois.length} items)
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </Button>

            {/* POI list */}
            {isExpanded && (
              <div className="divide-y divide-border">
                {category.pois.map((poi) => (
                  <div key={poi.id} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-foreground">
                            {poi.name}
                          </h4>
                          {renderConfidence(poi.confidence)}
                        </div>
                        {poi.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {poi.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">{renderValue(poi)}</div>
                    {renderCitations(poi.citations)}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
