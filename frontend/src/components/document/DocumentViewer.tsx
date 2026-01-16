import { format } from "date-fns";
import type { BriefingRenderModel, Citation } from "@/types/briefing";
import { QualityBanner } from "./QualityBanner";
import { SectionRenderer } from "./BlockRenderer";
import { SourcesFooter } from "./Citations";

interface DocumentViewerProps {
  renderModel: BriefingRenderModel;
  pageNumber?: number;
}

export function DocumentViewer({ renderModel, pageNumber = 1 }: DocumentViewerProps) {
  const { briefing_meta, quality_banner, sections } = renderModel;

  // Collect all citations for the sources footer
  const allCitations: Citation[] = sections.flatMap((section) =>
    section.blocks.flatMap((block) => block.citations || [])
  );

  // Track citation indices
  let citationIndex = 1;

  const toneLabels = {
    ministerial: "OFFICIAL — SENSITIVE",
    technical: "OFFICIAL",
    public: "OFFICIAL",
  };

  return (
    <div className="a4-page document-prose animate-fade-in">
      {/* Header */}
      <header className="mb-6 pb-4 border-b-2 border-primary">
        <div className="flex items-start justify-between">
          <div>
            <span className="classification-label">
              {toneLabels[briefing_meta.tone]}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight mt-3 font-sans">
              {briefing_meta.title}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="capitalize">{briefing_meta.topic}</span>
              <span>•</span>
              <span>
                As of:{" "}
                {briefing_meta.as_of === "latest"
                  ? "Latest available"
                  : format(new Date(briefing_meta.as_of), "MMMM yyyy")}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Generated</div>
            <div className="font-mono">{format(new Date(), "dd MMM yyyy HH:mm")}</div>
          </div>
        </div>
      </header>

      {/* Quality Banner */}
      <QualityBanner banner={quality_banner} />

      {/* Sections */}
      <main>
        {sections.map((section) => {
          const sectionStartIndex = citationIndex;
          section.blocks.forEach((block) => {
            if (block.citations && block.citations.length > 0) {
              citationIndex++;
            }
          });
          return (
            <SectionRenderer
              key={section.id}
              section={section}
              citationStartIndex={sectionStartIndex}
            />
          );
        })}
      </main>

      {/* Sources Footer */}
      <SourcesFooter citations={allCitations} />

      {/* Page Footer */}
      <footer className="absolute bottom-[20mm] left-[20mm] right-[20mm] pt-4 border-t flex justify-between text-xs text-muted-foreground">
        <span>Economic Briefing Builder</span>
        <span>Page {pageNumber}</span>
      </footer>
    </div>
  );
}
