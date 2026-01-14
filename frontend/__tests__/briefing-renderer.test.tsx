import { render, screen } from "@testing-library/react";
import BriefingRenderer from "@/components/BriefingRenderer";

describe("BriefingRenderer", () => {
  it("renders briefing sections and blocks", () => {
    const content = {
      briefing_meta: { title: "Demo Briefing", topic: "inflation", as_of: "2024-06-01" },
      quality_banner: { status: "green", summary: "All good" },
      sections: [
        {
          id: "exec",
          title: "Executive summary",
          blocks: [
            { type: "paragraph", content: { text: "Inflation eased." } },
            { type: "bullets", content: { items: ["CPI fell", "Energy costs down"] } },
          ],
        },
      ],
    };
    render(<BriefingRenderer content={content} />);
    expect(screen.getByText("Executive summary")).toBeInTheDocument();
    expect(screen.getByText("Inflation eased.")).toBeInTheDocument();
    expect(screen.getByText("CPI fell")).toBeInTheDocument();
  });
});
