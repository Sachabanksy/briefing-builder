import React from "react";
import { render, screen } from "@testing-library/react";
import BriefingRenderer from "@/components/BriefingRenderer";

describe("BriefingRenderer", () => {
  it("renders briefing sections, anchors, and citations", () => {
    const content = {
      briefing_meta: { title: "Demo Briefing", topic: "inflation", as_of: "2024-06-01" },
      quality_banner: {
        status: "green",
        summary: "All good",
        checks: [{ name: "freshness", detail: "Up to date" }],
      },
      sections: [
        {
          id: "exec",
          title: "Executive summary",
          blocks: [
            {
              type: "paragraph",
              content: { text: "Inflation eased." },
              citations: [
                { series_key: "cpi", period_start: "2024-05-01", value: 2.1, note: "ONS CPI" },
              ],
            },
          ],
        },
      ],
      recommended_charts: [],
    };
    render(<BriefingRenderer content={content} selectedAnchor="exec:block:0" onSelectAnchor={() => {}} />);
    expect(screen.getByText("Executive summary")).toBeInTheDocument();
    expect(screen.getByText("Inflation eased.")).toBeInTheDocument();
    expect(screen.getByText("Citations")).toBeInTheDocument();
  });
});
