"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import BriefingRenderer from "@/components/BriefingRenderer";
import ChatPanel from "@/components/ChatPanel";
import CommentsPanel, { Comment } from "@/components/CommentsPanel";
import { downloadPdf, fetchBriefingDetail, fetchVersion, postComment, sendChat } from "@/lib/api";

const detailFetcher = (briefingId: string) => fetchBriefingDetail(briefingId);
const versionFetcher = (args: [string, string]) => fetchVersion(args[0], args[1]);

export default function BriefingPage({ params }: { params: { id: string } }) {
  const { data: detail, isLoading: detailLoading, mutate: refreshDetail } = useSWR(
    params.id ? ["briefing", params.id] : null,
    () => detailFetcher(params.id)
  );
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const { data: versionData } = useSWR(
    params.id && activeVersion ? [params.id, activeVersion] : null,
    (keys) => versionFetcher(keys as [string, string])
  );
  const [messages, setMessages] = useState<{ id: string; role: "user" | "assistant"; content: string }[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (!detail || !detail.versions.length || activeVersion) return;
    setActiveVersion(detail.versions[0].id);
  }, [detail, activeVersion]);

  const handleSend = async (text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
    const response = await sendChat(params.id, text, activeVersion ?? undefined);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: response.change_summary ?? "Updated." },
    ]);
    await refreshDetail();
    setActiveVersion(response.new_version_id);
  };

  const handleComment = async (anchor: string, text: string) => {
    if (!activeVersion) return;
    const response = await postComment(params.id, { version_id: activeVersion, anchor, comment_text: text });
    setComments((prev) => [
      ...prev,
      { id: response.comment_id, anchor, comment_text: text, status: response.status },
    ]);
  };

  const handleDownload = async () => {
    if (!activeVersion) return;
    const blob = await downloadPdf(params.id, activeVersion);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${params.id}-${activeVersion}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderModel = useMemo(() => versionData?.content_json ?? null, [versionData]);

  if (detailLoading) {
    return <p style={{ padding: "32px" }}>Loading briefing...</p>;
  }

  if (!detail) {
    return <p style={{ padding: "32px" }}>Briefing not found.</p>;
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 32px" }}>
          <select
            value={activeVersion ?? ""}
            onChange={(event) => setActiveVersion(event.target.value)}
            style={{ padding: "8px 12px" }}
          >
            {detail.versions.map((version) => (
              <option key={version.id} value={version.id}>
                Version {version.version_number}
              </option>
            ))}
          </select>
          <button onClick={handleDownload} disabled={!activeVersion}>
            Download PDF
          </button>
        </div>
        <BriefingRenderer content={renderModel} />
        <CommentsPanel comments={comments} onCreate={handleComment} />
      </div>
      <ChatPanel messages={messages} onSend={handleSend} />
    </div>
  );
}
