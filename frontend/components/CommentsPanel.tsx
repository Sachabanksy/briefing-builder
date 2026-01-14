"use client";

import { FormEvent, useState } from "react";

export type Comment = {
  id: string;
  anchor: string;
  comment_text: string;
  status: string;
};

export default function CommentsPanel({
  comments,
  onCreate,
}: {
  comments: Comment[];
  onCreate: (anchor: string, text: string) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!anchor || !text) return;
    setPending(true);
    await onCreate(anchor, text);
    setAnchor("");
    setText("");
    setPending(false);
  };

  return (
    <section style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
      <h3>Comments</h3>
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {comments.map((comment) => (
          <li key={comment.id} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
            <span style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--muted)" }}>{comment.anchor}</span>
            <p style={{ margin: "8px 0" }}>{comment.comment_text}</p>
            <span style={{ fontSize: "12px", color: comment.status === "open" ? "#b45309" : "#166534" }}>
              {comment.status}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={anchor} onChange={(event) => setAnchor(event.target.value)} placeholder="section:intro" />
        <textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder="Add note" />
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Add comment"}
        </button>
      </form>
    </section>
  );
}
