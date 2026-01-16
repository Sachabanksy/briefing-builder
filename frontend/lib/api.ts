const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type BriefingSummary = {
  briefing: any;
  versions: Array<{
    id: string;
    version_number: number;
    created_at: string;
    created_by: string;
    change_summary?: string | null;
  }>;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
  version_id?: string | null;
};

export type BriefingComment = {
  id: string;
  anchor: string;
  comment_text: string;
  status: string;
  created_at: string;
  created_by: string;
  briefing_version_id: string;
};

export type EconomicSource = {
  slug: string;
  provider: string;
  dataset_id?: string | null;
  dataset_code?: string | null;
  series_id?: string | null;
  location?: string | null;
  subject?: string | null;
  measure?: string | null;
  frequency?: string | null;
  unit?: string | null;
  description?: string | null;
  metadata?: Record<string, any> | null;
};

export type CreateBriefingPayload = {
  topic: string;
  user_request: string;
  selected_series: Array<{
    source: string;
    source_series_id: string;
    dataset_id?: string;
    alias?: string;
  }>;
  options: {
    as_of?: string;
    lookback_periods?: number;
    include_oecd?: boolean;
    tone?: string;
    length?: string;
  };
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
  return (await response.json()) as T;
}

export async function fetchBriefingDetail(briefingId: string): Promise<BriefingSummary> {
  return handleResponse<BriefingSummary>(
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

export async function fetchChatHistory(briefingId: string): Promise<ChatMessage[]> {
  return handleResponse<ChatMessage[]>(fetch(`${API_BASE}/briefings/${briefingId}/chat`, { cache: "no-store" }));
}

export async function fetchComments(briefingId: string, versionId: string): Promise<BriefingComment[]> {
  const url = new URL(`${API_BASE}/briefings/${briefingId}/comments`);
  url.searchParams.set("version_id", versionId);
  return handleResponse<BriefingComment[]>(fetch(url, { cache: "no-store" }));
}

export async function searchSeries(topic?: string, query?: string): Promise<EconomicSource[]> {
  const url = new URL(`${API_BASE}/series`);
  if (topic) url.searchParams.set("topic", topic);
  if (query) url.searchParams.set("q", query);
  return handleResponse<EconomicSource[]>(fetch(url.toString(), { cache: "no-store" }));
}

export async function createBriefing(payload: CreateBriefingPayload) {
  return handleResponse<{ briefing_id: string; version_id: string }>(
    fetch(`${API_BASE}/briefings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}
