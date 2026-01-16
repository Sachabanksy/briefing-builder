"use client";

import { FormEvent, useEffect, useState } from "react";

export type Comment = {
  id: string;
  anchor: string;
  comment_text: string;
  status: string;
  created_at?: string;
  created_by?: string;
};

type CommentsPanelProps = {
  comments: Comment[];
  onCreate: (anchor: string, text: string) => Promise<void>;
  onSelectAnchor?: (anchor: string) => void;
  selectedAnchor?: string | null;
};

export default function CommentsPanel({ comments, onCreate, onSelectAnchor, selectedAnchor }: CommentsPanelProps) {
  const [anchorInput, setAnchorInput] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (selectedAnchor) {
      setAnchorInput(selectedAnchor);
    }
  }, [selectedAnchor]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!anchorInput || !text) return;
    setPending(true);
    await onCreate(anchorInput, text);
    setText("");
    setPending(false);
  };

  const emptyState =
    comments.length === 0 ? <p style={{ color: "var(--muted)" }}>No comments yet. Select content to add one.</p> : null;

  return (
    <section style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
      <h3>Comments</h3>
      {emptyState}
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {comments.map((comment) => (
          <li
            key={comment.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "12px",
              background: selectedAnchor === comment.anchor ? "rgba(15, 98, 254, 0.08)" : "transparent",
              cursor: "pointer",
            }}
            onClick={() => onSelectAnchor?.(comment.anchor)}
          >
            <span style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--muted)" }}>{comment.anchor}</span>
            <p style={{ margin: "8px 0" }}>{comment.comment_text}</p>
            <span style={{ fontSize: "12px", color: comment.status === "open" ? "#b45309" : "#166534" }}>
              {comment.status}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input
          value={anchorInput}
          onChange={(event) => setAnchorInput(event.target.value)}
          placeholder="section:intro"
          aria-label="Anchor identifier"
        />
        <textarea
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add note"
          aria-label="Comment text"
        />
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Add comment"}
        </button>
      </form>
    </section>
  );
}
