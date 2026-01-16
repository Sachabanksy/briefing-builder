import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import type { Block, Section, Citation } from "@/types/briefing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CitationRef } from "./Citations";
import { useBriefingStore } from "@/stores/briefingStore";
import { createComment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BlockRendererProps {
  block: Block;
  sectionId: string;
  citationStartIndex: number;
}

export function BlockRenderer({ block, sectionId, citationStartIndex }: BlockRendererProps) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { briefingId, currentVersionId, addComment, comments } = useBriefingStore();
  const { toast } = useToast();

  const anchor = `section:${sectionId}:block:${block.id}`;
  const blockComments = comments.filter((c) => c.anchor === anchor);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !briefingId || !currentVersionId) return;

    try {
      const response = await createComment(briefingId, currentVersionId, anchor, commentText);
      addComment({
        id: response.comment_id,
        version_id: currentVersionId,
        anchor,
        comment_text: commentText,
        created_at: new Date().toISOString(),
        status: response.status,
      });
      setCommentText("");
      setShowCommentInput(false);
    } catch (error) {
      toast({
        title: "Unable to add comment",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderContent = () => {
    switch (block.type) {
      case "paragraph":
        return (
          <p className="leading-relaxed mb-3" style={{ fontSize: "11pt" }}>
            {(block.content as { text: string }).text}
            {block.citations && block.citations.length > 0 && (
              <CitationRef citations={block.citations} index={citationStartIndex} />
            )}
          </p>
        );

      case "bullets":
        return (
          <ul className="list-disc pl-5 mb-3 space-y-1.5">
            {(block.content as { items: string[] }).items.map((item, i) => (
              <li key={i} className="leading-relaxed" style={{ fontSize: "11pt" }}>
                {item}
              </li>
            ))}
          </ul>
        );

      case "callout":
        const callout = block.content as { label?: string; text: string; kind?: string };
        const calloutClass = {
          info: "callout-info",
          warning: "callout-warning",
          success: "callout-success",
        }[callout.kind || "info"] || "callout-info";

        return (
          <div className={cn(calloutClass, "mb-4")}>
            {callout.label && (
              <div className="font-semibold text-sm mb-1 font-sans">{callout.label}</div>
            )}
            <p style={{ fontSize: "11pt" }}>{callout.text}</p>
          </div>
        );

      case "table":
        const table = block.content as { columns: string[]; rows: Array<Array<string | number>> };
        return (
          <div className="overflow-x-auto mb-4">
            <table className="data-table">
              <thead>
                <tr>
                  {table.columns.map((col, i) => (
                    <th key={i}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={typeof cell === "number" ? "numeric" : ""}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {block.citations && block.citations.length > 0 && (
              <div className="mt-1 text-right">
                <CitationRef citations={block.citations} index={citationStartIndex} />
              </div>
            )}
          </div>
        );

      case "chart_spec":
        const chart = block.content as {
          chart_type: "line" | "bar";
          title: string;
          unit?: string;
          series: Array<{ key: string; label: string; points: Array<{ date: string; value: number }> }>;
        };

        // Transform data for recharts
        const chartData = chart.series[0]?.points.map((point) => {
          const dataPoint: Record<string, string | number> = { date: point.date };
          chart.series.forEach((s) => {
            const matchingPoint = s.points.find((p) => p.date === point.date);
            if (matchingPoint) {
              dataPoint[s.label] = matchingPoint.value;
            }
          });
          return dataPoint;
        }) || [];

        const colors = ["hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"];

        return (
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-2 font-sans">{chart.title}</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chart.chart_type === "line" ? (
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                      unit={chart.unit ? ` ${chart.unit}` : ""}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    {chart.series.map((s, i) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.label}
                        stroke={colors[i % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                      unit={chart.unit ? ` ${chart.unit}` : ""}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    {chart.series.map((s, i) => (
                      <Bar
                        key={s.key}
                        dataKey={s.label}
                        fill={colors[i % colors.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative group">
      {/* Comment indicator */}
      {blockComments.length > 0 && (
        <div className="comment-anchor">
          {blockComments.length}
        </div>
      )}

      {/* Comment button on hover */}
      <button
        onClick={() => setShowCommentInput(true)}
        className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
        title="Add comment"
      >
        <MessageSquarePlus className="w-4 h-4 text-muted-foreground" />
      </button>

      {renderContent()}

      {/* Comment input */}
      {showCommentInput && (
        <div className="mt-2 p-3 bg-muted/50 rounded-lg border animate-fade-in">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[60px] text-sm resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentInput(false)}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitComment}>
              <Send className="w-4 h-4 mr-1" />
              Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SectionRendererProps {
  section: Section;
  citationStartIndex: number;
}

export function SectionRenderer({ section, citationStartIndex }: SectionRendererProps) {
  let currentIndex = citationStartIndex;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold tracking-tight mb-3 mt-6 font-sans border-b pb-2">
        {section.title}
      </h2>
      {section.blocks.map((block, i) => {
        const blockIndex = currentIndex;
        if (block.citations && block.citations.length > 0) {
          currentIndex++;
        }
        return (
          <BlockRenderer
            key={block.id}
            block={block}
            sectionId={section.id}
            citationStartIndex={blockIndex}
          />
        );
      })}
    </section>
  );
}
