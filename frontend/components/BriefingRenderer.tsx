"use client";

import { Fragment } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

type Block = {
  type: "paragraph" | "bullets" | "callout" | "table" | "chart_spec";
  content: any;
  citations?: { series_key: string; period_start: string; value: number; note?: string }[];
};

type Section = {
  id: string;
  title: string;
  blocks: Block[];
};

export default function BriefingRenderer({ content }: { content: any }) {
  if (!content) return null;
  const sections: Section[] = content.sections ?? [];
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
          <p style={{ textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
            {content.briefing_meta?.topic}
          </p>
          <h1 style={{ margin: 0 }}>{content.briefing_meta?.title}</h1>
          <p style={{ color: "var(--muted)" }}>As of {content.briefing_meta?.as_of}</p>
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
        </section>
        {sections.map((section) => (
          <section key={section.id} id={section.id} style={{ marginBottom: "32px" }}>
            <h2 style={{ color: "var(--primary)" }}>{section.title}</h2>
            {section.blocks.map((block, idx) => (
              <Fragment key={`${section.id}-${idx}`}>{renderBlock(block)}</Fragment>
            ))}
          </section>
        ))}
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
