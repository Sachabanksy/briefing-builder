const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
  return (await response.json()) as T;
}

export async function fetchBriefingDetail(briefingId: string) {
  return handleResponse<{ briefing: any; versions: any[] }>(
    fetch(`${API_BASE}/briefings/${briefingId}`, { next: { revalidate: 5 } })
  );
}

export async function fetchVersion(briefingId: string, versionId: string) {
  return handleResponse<{ content_json: any; version_number: number }>(
    fetch(`${API_BASE}/briefings/${briefingId}/versions/${versionId}`, { cache: "no-store" })
  );
}

export async function sendChat(briefingId: string, message: string, targetVersionId?: string) {
  return handleResponse<{ new_version_id: string; render_model: any; change_summary: string }>(
    fetch(`${API_BASE}/briefings/${briefingId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, target_version_id: targetVersionId }),
    })
  );
}

export async function postComment(
  briefingId: string,
  payload: { version_id: string; anchor: string; comment_text: string }
) {
  return handleResponse<{ comment_id: string; status: string }>(
    fetch(`${API_BASE}/briefings/${briefingId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function downloadPdf(briefingId: string, versionId: string) {
  const response = await fetch(`${API_BASE}/briefings/${briefingId}/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version_id: versionId }),
  });
  if (!response.ok) {
    throw new Error("Unable to export PDF");
  }
  return response.blob();
}
