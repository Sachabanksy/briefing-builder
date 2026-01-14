"use client";

import { FormEvent, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatPanel({
  messages,
  onSend,
}: {
  messages: Message[];
  onSend: (message: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    setPending(true);
    await onSend(input.trim());
    setPending(false);
    setInput("");
  };

  return (
    <aside
      style={{
        width: "360px",
        background: "#fff",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        <strong>Chat with briefing</strong>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              background: message.role === "user" ? "#0f62fe" : "#e2e8f0",
              color: message.role === "user" ? "#fff" : "#0f172a",
              padding: "10px 14px",
              borderRadius: "12px",
              maxWidth: "80%",
            }}
          >
            {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
        <textarea
          rows={3}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask for edits..."
          style={{ width: "100%", resize: "none" }}
        />
        <button type="submit" disabled={pending} style={{ marginTop: "8px" }}>
          {pending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
}
