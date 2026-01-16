// Briefing Render Model Types

export type QualityStatus = "green" | "amber" | "red";
export type Tone = "ministerial" | "technical" | "public";
export type Length = "one_page" | "two_page" | "long";
export type BlockType = "paragraph" | "bullets" | "table" | "chart_spec" | "callout";
export type ChartType = "line" | "bar";
export type CalloutKind = "info" | "warning" | "success";

export interface Citation {
  series_key: string;
  period_start: string;
  value: number;
  note?: string;
}

export interface ParagraphContent {
  text: string;
}

export interface BulletsContent {
  items: string[];
}

export interface CalloutContent {
  label?: string;
  text: string;
  kind?: CalloutKind;
}

export interface TableContent {
  columns: string[];
  rows: Array<Array<string | number>>;
}

export interface ChartPoint {
  date: string;
  value: number;
}

export interface ChartSeries {
  key: string;
  label: string;
  points: ChartPoint[];
}

export interface ChartSpecContent {
  chart_type: ChartType;
  title: string;
  unit?: string;
  series: ChartSeries[];
}

export type BlockContent = ParagraphContent | BulletsContent | CalloutContent | TableContent | ChartSpecContent;

export interface Block {
  id: string;
  type: BlockType;
  content: BlockContent;
  citations?: Citation[];
}

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export interface QualityCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface QualityBanner {
  status: QualityStatus;
  summary: string;
  checks: QualityCheck[];
}

export interface BriefingMeta {
  title: string;
  topic: string;
  as_of: string;
  tone: Tone;
  length: Length;
}

export interface RecommendedChart {
  chart_id: string;
  title: string;
  unit: string;
  series_keys: string[];
  suggested_range: { start: string; end: string };
}

export interface BriefingRenderModel {
  briefing_meta: BriefingMeta;
  quality_banner: QualityBanner;
  sections: Section[];
  recommended_charts?: RecommendedChart[];
  export_markdown?: string;
}

// API Types
export interface Series {
  source: string;
  source_series_id: string;
  topic: string;
  name: string;
  freq?: string;
  unit?: string;
  last_period?: string;
  last_ingested_at?: string;
  dataset_id?: string;
  dataset_code?: string;
  slug?: string;
  location?: string;
  subject?: string;
  measure?: string;
  time_filter?: string;
}

export interface BriefingOptions {
  as_of: "latest" | string;
  lookback_periods: number;
  include_oecd: boolean;
  tone: Tone;
  length: Length;
}

export interface CreateBriefingRequest {
  topic: string;
  user_request: string;
  selected_series: Array<{
    source: string;
    source_series_id: string;
    dataset_id?: string;
    alias?: string;
  }>;
  options: BriefingOptions;
}

export interface BriefingResponse {
  briefing_id: string;
  version_id: string;
  render_model: BriefingRenderModel;
}

export interface ChatRequest {
  message: string;
  target_version_id: string;
}

export interface ChatResponse {
  briefing_id: string;
  new_version_id: string;
  change_summary: string;
  render_model: BriefingRenderModel;
}

export interface Comment {
  id: string;
  version_id: string;
  anchor: string;
  comment_text: string;
  created_at: string;
  status?: string;
}

export interface Version {
  id: string;
  created_at: string;
  created_by?: string;
  version_number?: number;
  change_summary?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  version_id?: string;
}

export interface BriefingRecord {
  id: string;
  title: string;
  topic: string;
  created_at: string;
  created_by: string;
  latest_version_id?: string | null;
}

export interface BriefingDetail {
  briefing: BriefingRecord;
  versions: Version[];
}
