"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <section style={{ padding: "40px", maxWidth: "960px" }}>
      <h1>Briefing Builder Playground</h1>
      <p>
        Select a saved briefing or start by calling the backend API. This UI focuses on rendering and collaborative editing once a briefing exists.
      </p>
      <Link href="/briefings/demo" style={{ color: "var(--primary)", fontWeight: 600 }}>
        View demo briefing
      </Link>
    </section>
  );
}
