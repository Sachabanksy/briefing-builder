import type {
  BriefingDetail,
  BriefingResponse,
  ChatMessage,
  ChatResponse,
  Comment,
  CreateBriefingRequest,
  Series,
} from "@/types/briefing";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const DEFAULT_TOPICS = ["inflation", "gdp", "unemployment", "trade"];

type EconomicSource = {
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

type VersionResponse = {
  id: string;
  briefing_id: string;
  version_number: number;
  created_at: string;
  created_by: string;
  change_summary?: string | null;
  content_json: any;
};

type CommentResponse = {
  id: string;
  briefing_version_id: string;
  created_at: string;
  created_by: string;
  anchor: string;
  comment_text: string;
  status: string;
};

type ApiChatMessage = {
  id: string;
  briefing_id: string;
  created_at: string;
  role: "user" | "assistant";
  message: string;
  version_id?: string | null;
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      detail = data.detail ?? JSON.stringify(data);
    } catch {
      try {
        detail = await response.text();
      } catch {
        // ignore
      }
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

function normalizeSeries(source: EconomicSource): Series {
  const metadata = source.metadata ?? {};
  const seriesId =
    source.series_id ||
    source.subject ||
    metadata.series_id ||
    source.slug ||
    `${source.provider}-${source.dataset_id ?? source.dataset_code ?? "series"}`;

  return {
    source: source.provider,
    source_series_id: seriesId,
    topic: metadata.category ?? "general",
    name: source.description ?? metadata.label ?? source.slug,
    freq: source.frequency ?? metadata.frequency ?? metadata.freq,
    unit: source.unit ?? metadata.unit,
    last_period: metadata.last_period,
    last_ingested_at: metadata.last_ingested_at,
    dataset_id: source.dataset_id ?? undefined,
    dataset_code: source.dataset_code ?? undefined,
    slug: source.slug,
  };
}

export async function getTopics(): Promise<string[]> {
  try {
    const response = await handleResponse<EconomicSource[]>(
      fetch(`${API_BASE}/sources`, { cache: "no-store" })
    );
    const topics = Array.from(
      new Set(
        response
          .map((source) => source.metadata?.category)
          .filter((topic): topic is string => Boolean(topic))
      )
    );
    return topics.length ? topics : DEFAULT_TOPICS;
  } catch {
    return DEFAULT_TOPICS;
  }
}

export async function getSeries(topic: string, query?: string): Promise<Series[]> {
  const url = new URL(`${API_BASE}/series`);
  if (topic) {
    url.searchParams.set("topic", topic);
  }
  if (query) {
    url.searchParams.set("q", query);
  }
  const response = await handleResponse<EconomicSource[]>(fetch(url, { cache: "no-store" }));
  return response.map(normalizeSeries);
}

export async function createBriefing(payload: CreateBriefingRequest): Promise<BriefingResponse> {
  return handleResponse<BriefingResponse>(
    fetch(`${API_BASE}/briefings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function getBriefingDetail(briefingId: string): Promise<BriefingDetail> {
  return handleResponse<BriefingDetail>(fetch(`${API_BASE}/briefings/${briefingId}`, { cache: "no-store" }));
}

export async function getBriefingVersion(
  briefingId: string,
  versionId: string
): Promise<VersionResponse> {
  return handleResponse<VersionResponse>(
    fetch(`${API_BASE}/briefings/${briefingId}/versions/${versionId}`, { cache: "no-store" })
  );
}

export async function chatWithBriefing(
  briefingId: string,
  message: string,
  targetVersionId: string
): Promise<ChatResponse> {
  return handleResponse<ChatResponse>(
    fetch(`${API_BASE}/briefings/${briefingId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, target_version_id: targetVersionId }),
    })
  );
}

export async function exportPdf(briefingId: string, versionId: string): Promise<Blob> {
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

export async function createComment(
  briefingId: string,
  versionId: string,
  anchor: string,
  commentText: string
): Promise<{ comment_id: string; status: string }> {
  return handleResponse<{ comment_id: string; status: string }>(
    fetch(`${API_BASE}/briefings/${briefingId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, anchor, comment_text: commentText }),
    })
  );
}

export async function fetchComments(briefingId: string, versionId: string): Promise<Comment[]> {
  const url = new URL(`${API_BASE}/briefings/${briefingId}/comments`);
  url.searchParams.set("version_id", versionId);
  const response = await handleResponse<CommentResponse[]>(fetch(url, { cache: "no-store" }));
  return response.map((comment) => ({
    id: comment.id,
    version_id: comment.briefing_version_id,
    anchor: comment.anchor,
    comment_text: comment.comment_text,
    created_at: comment.created_at,
    status: comment.status,
  }));
}

export async function fetchChatHistory(briefingId: string): Promise<ChatMessage[]> {
  const response = await handleResponse<ApiChatMessage[]>(
    fetch(`${API_BASE}/briefings/${briefingId}/chat`, { cache: "no-store" })
  );
  return response.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.message,
    timestamp: message.created_at,
    version_id: message.version_id ?? undefined,
  }));
}
