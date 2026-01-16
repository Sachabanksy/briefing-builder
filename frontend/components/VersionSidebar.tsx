"use client";

type Version = {
  id: string;
  version_number: number;
  created_at: string;
  created_by: string;
  change_summary?: string | null;
};

type VersionSidebarProps = {
  versions: Version[];
  activeVersionId: string | null;
  onSelect: (versionId: string) => void;
};

export default function VersionSidebar({ versions, activeVersionId, onSelect }: VersionSidebarProps) {
  return (
    <aside
      style={{
        width: "240px",
        borderRight: "1px solid var(--border)",
        background: "#fff",
        padding: "16px",
        overflowY: "auto",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Versions</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {versions.map((version) => {
          const isActive = version.id === activeVersionId;
          return (
            <li
              key={version.id}
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: isActive ? "1px solid #0f62fe" : "1px solid var(--border)",
                background: isActive ? "rgba(15, 98, 254, 0.08)" : "#fff",
                cursor: "pointer",
              }}
              onClick={() => onSelect(version.id)}
            >
              <div style={{ fontWeight: 600 }}>Version {version.version_number}</div>
              <small>{new Date(version.created_at).toLocaleString()}</small>
              {version.change_summary ? (
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>{version.change_summary}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
