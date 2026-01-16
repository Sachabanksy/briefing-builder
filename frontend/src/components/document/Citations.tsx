import { useState } from "react";
import { Info } from "lucide-react";
import type { Citation } from "@/types/briefing";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CitationRefProps {
  citations: Citation[];
  index: number;
}

export function CitationRef({ citations, index }: CitationRefProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <sup className="citation-ref">[{index}]</sup>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="w-4 h-4 text-accent" />
            Data Source
          </div>
        </div>
        <div className="p-3 space-y-2">
          {citations.map((citation, i) => (
            <div key={i} className="text-sm">
              <div className="font-mono text-xs text-muted-foreground">
                {citation.series_key}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-muted-foreground">
                  Period: {citation.period_start}
                </span>
                <span className="font-semibold font-mono">
                  {citation.value}
                </span>
              </div>
              {citation.note && (
                <div className="text-xs text-muted-foreground mt-1 italic">
                  {citation.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SourcesFooterProps {
  citations: Citation[];
}

export function SourcesFooter({ citations }: SourcesFooterProps) {
  // Get unique series keys
  const uniqueSeries = Array.from(new Set(citations.map((c) => c.series_key)));

  if (uniqueSeries.length === 0) return null;

  return (
    <div className="mt-8 pt-4 border-t border-border/50">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Data Sources
      </h4>
      <div className="flex flex-wrap gap-2">
        {uniqueSeries.map((series) => (
          <span
            key={series}
            className="text-xs font-mono bg-muted px-2 py-1 rounded"
          >
            {series}
          </span>
        ))}
      </div>
    </div>
  );
}
