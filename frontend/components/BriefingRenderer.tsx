"use client";

import React, { Fragment, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

type Block = {
  type: "paragraph" | "bullets" | "callout" | "table" | "chart_spec";
  content: any;
  citations?: Citation[];
};

type Citation = {
  series_key: string;
  period_start: string;
  value: number;
  note?: string;
};

type Section = {
  id: string;
  title: string;
  blocks: Block[];
};

type BriefingRendererProps = {
  content: any;
  selectedAnchor?: string | null;
  onSelectAnchor?: (anchor: string) => void;
};

type Footnote = { index: number; citation: Citation };

export default function BriefingRenderer({ content, selectedAnchor, onSelectAnchor }: BriefingRendererProps) {
  if (!content) return null;
  const sections: Section[] = content.sections ?? [];

  const [footnotes, registerCitation] = useMemo(() => {
    const notes: Footnote[] = [];
    const cache = new Map<string, number>();
    const register = (citation: Citation) => {
      const key = JSON.stringify(citation);
      if (!cache.has(key)) {
        const nextIndex = notes.length + 1;
        cache.set(key, nextIndex);
        notes.push({ index: nextIndex, citation });
      }
      return cache.get(key)!;
    };
    return [notes, register] as const;
  }, [content]);

  return (
    <div
      style={{
        display: "flex",
        gap: "24px",
        padding: "32px",
      }}
    >
      <article
        style={{
          width: "var(--page-width)",
          background: "var(--page-bg)",
          boxShadow: `0 12px 24px ${"var(--page-shadow)"}`,
          padding: "48px 56px",
          borderRadius: "8px",
        }}
      >
        <header>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                {content.briefing_meta?.topic}
              </p>
              <h1 style={{ margin: 0 }}>{content.briefing_meta?.title}</h1>
            </div>
            <div style={{ textAlign: "right", color: "var(--muted)" }}>
              <div>Ministerial Briefing</div>
              <small>{content.briefing_meta?.as_of}</small>
            </div>
          </div>
        </header>
        <section
          style={{
            margin: "24px 0",
            padding: "16px",
            border: "1px solid var(--border)",
            background: "#fdfcf7",
            borderRadius: "8px",
          }}
        >
          <strong>Quality status: {content.quality_banner?.status?.toUpperCase()}</strong>
          <p>{content.quality_banner?.summary}</p>
          <ul style={{ margin: "8px 0", paddingLeft: "18px" }}>
            {(content.quality_banner?.checks ?? []).map((check: any) => (
              <li key={check.name}>
                <strong>{check.name}:</strong> {check.detail}
              </li>
            ))}
          </ul>
        </section>
        {sections.map((section) => (
          <section key={section.id} id={section.id} style={{ marginBottom: "32px" }}>
            <h2 style={{ color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
              {section.title}
            </h2>
            {section.blocks.map((block, idx) => {
              const anchor = `${section.id}:block:${idx}`;
              const isSelected = selectedAnchor === anchor;
              return (
                <Fragment key={`${section.id}-${idx}`}>
                  <div
                    data-anchor={anchor}
                    style={{
                      border: isSelected ? "1px solid #0f62fe" : "1px solid transparent",
                      borderRadius: "6px",
                      padding: "8px",
                      marginBottom: "8px",
                    }}
                    onClick={() => onSelectAnchor?.(anchor)}
                  >
                    {renderBlock(block)}
                    {block.citations?.length ? (
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {block.citations.map((citation, citationIdx) => {
                          const index = registerCitation(citation);
                          return (
                            <sup key={`${anchor}-citation-${citationIdx}`} style={{ marginRight: "6px" }}>
                              [{index}]
                            </sup>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </Fragment>
              );
            })}
          </section>
        ))}

        {content.recommended_charts?.length ? (
          <section style={{ marginTop: "32px" }}>
            <h2 style={{ color: "var(--primary)" }}>Recommended charts</h2>
            <ul>
              {content.recommended_charts.map((chart: any) => (
                <li key={chart.chart_id}>
                  {chart.title} ({chart.unit}) — {chart.series_keys.join(", ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {footnotes.length ? (
          <section style={{ marginTop: "40px", fontSize: "12px" }}>
            <h3>Citations</h3>
            <ol style={{ paddingLeft: "18px" }}>
              {footnotes.map((footnote) => (
                <li key={footnote.index}>
                  <strong>{footnote.citation.series_key}</strong> {footnote.citation.note} — {footnote.citation.value} (
                  {footnote.citation.period_start})
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>
    </div>
  );
}

function renderBlock(block: Block) {
  switch (block.type) {
    case "paragraph":
      return <p style={{ lineHeight: 1.5 }}>{block.content?.text}</p>;
    case "bullets":
      return (
        <ul>
          {(block.content?.items ?? []).map((item: string) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <div
          style={{
            borderLeft: `4px solid var(--primary)`,
            background: "#f0f6ff",
            padding: "12px 16px",
            margin: "16px 0",
          }}
        >
          <strong>{block.content?.title}</strong>
          <p>{block.content?.text}</p>
        </div>
      );
    case "table":
      return (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "16px",
          }}
        >
          <thead>
            <tr>
              {(block.content?.headers ?? []).map((header: string) => (
                <th key={header} style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "8px" }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(block.content?.rows ?? []).map((row: any[], idx: number) => (
              <tr key={idx}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "chart_spec":
      return <Chart block={block} />;
    default:
      return null;
  }
}

function Chart({ block }: { block: Block }) {
  const seriesKeys: string[] = block.content?.series_keys ?? [];
  const rows = (block.content?.data ?? []).map((entry: any) => ({
    period_start: entry.period_start,
    ...entry.values,
  }));
  if (!rows.length) return null;
  return (
    <div style={{ width: "100%", height: 320, marginBottom: "16px" }}>
      <ResponsiveContainer>
        <LineChart data={rows}>
          <XAxis dataKey="period_start" />
          <YAxis />
          <Tooltip />
          <Legend />
          {seriesKeys.map((key, idx) => (
            <Line key={key} type="monotone" dataKey={key} stroke={LINE_COLORS[idx % LINE_COLORS.length]} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const LINE_COLORS = ["#0f62fe", "#fa4d56", "#40c057", "#f1c40f"];
