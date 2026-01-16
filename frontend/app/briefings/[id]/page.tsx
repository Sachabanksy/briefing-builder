"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import BriefingRenderer from "@/components/BriefingRenderer";
import ChatPanel from "@/components/ChatPanel";
import CommentsPanel from "@/components/CommentsPanel";
import VersionSidebar from "@/components/VersionSidebar";
import {
  ChatMessage,
  BriefingComment,
  downloadPdf,
  fetchBriefingDetail,
  fetchChatHistory,
  fetchComments,
  fetchVersion,
  postComment,
  sendChat,
} from "@/lib/api";

const detailFetcher = (briefingId: string) => fetchBriefingDetail(briefingId);
const versionFetcher = (args: [string, string]) => fetchVersion(args[0], args[1]);
const chatFetcher = (briefingId: string) => fetchChatHistory(briefingId);
const commentsFetcher = (args: [string, string]) => fetchComments(args[0], args[1]);

export default function BriefingPage({ params }: { params: { id: string } }) {
  const { data: detail, isLoading: detailLoading, mutate: refreshDetail } = useSWR(
    params.id ? ["briefing", params.id] : null,
    () => detailFetcher(params.id)
  );
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const { data: versionData, mutate: refreshVersion } = useSWR(
    params.id && activeVersion ? [params.id, activeVersion] : null,
    (keys) => versionFetcher(keys as [string, string])
  );
  const { data: chatHistory, mutate: refreshChat } = useSWR(
    params.id ? ["chat", params.id] : null,
    () => chatFetcher(params.id)
  );
  const { data: commentsData, mutate: refreshComments } = useSWR(
    params.id && activeVersion ? ["comments", params.id, activeVersion] : null,
    (keys) => commentsFetcher(keys as [string, string])
  );
  const [selectedAnchor, setSelectedAnchor] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!detail || !detail.versions.length || activeVersion) return;
    setActiveVersion(detail.versions[0].id);
  }, [detail, activeVersion]);

  const handleSend = async (text: string) => {
    setIsSending(true);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      message: text,
      created_at: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, userMessage]);
    try {
      const response = await sendChat(params.id, text, activeVersion ?? undefined);
      const assistantMessage: ChatMessage = {
        id: response.new_version_id,
        role: "assistant",
        message: response.change_summary ?? "Updated.",
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, assistantMessage]);
      await refreshDetail();
      setActiveVersion(response.new_version_id);
      await refreshVersion();
      await refreshChat();
    } finally {
      setOptimisticMessages([]);
      setIsSending(false);
    }
  };

  const handleComment = async (anchor: string, text: string) => {
    if (!activeVersion) return;
    const response = await postComment(params.id, { version_id: activeVersion, anchor, comment_text: text });
    setSelectedAnchor(anchor);
    await refreshComments();
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
  const comments: BriefingComment[] = commentsData ?? [];
  const messages: ChatMessage[] = useMemo(
    () => ([...(chatHistory ?? []), ...optimisticMessages]),
    [chatHistory, optimisticMessages]
  );

  if (detailLoading) {
    return <p style={{ padding: "32px" }}>Loading briefing...</p>;
  }

  if (!detail) {
    return <p style={{ padding: "32px" }}>Briefing not found.</p>;
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)" }}>
      <VersionSidebar versions={detail.versions} activeVersionId={activeVersion} onSelect={setActiveVersion} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 32px" }}>
          <button onClick={handleDownload} disabled={!activeVersion}>
            Download PDF
          </button>
          <span style={{ color: "var(--muted)", fontSize: "14px" }}>
            {activeVersion ? `Version ${detail.versions.find((v) => v.id === activeVersion)?.version_number}` : ""}
          </span>
        </div>
        <BriefingRenderer content={renderModel} selectedAnchor={selectedAnchor} onSelectAnchor={setSelectedAnchor} />
        <CommentsPanel
          comments={comments}
          onCreate={handleComment}
          onSelectAnchor={setSelectedAnchor}
          selectedAnchor={selectedAnchor}
        />
      </div>
      <ChatPanel messages={messages} onSend={handleSend} pending={isSending} />
    </div>
  );
}
