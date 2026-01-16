from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class SelectedSeries(BaseModel):
    source: str
    source_series_id: str
    dataset_id: Optional[str] = None
    alias: Optional[str] = None


class BriefingOptions(BaseModel):
    as_of: Optional[str] = Field(default="latest")
    lookback_periods: int = Field(default=24, ge=1, le=240)
    include_oecd: bool = False
    tone: str = Field(default="ministerial")
    length: str = Field(default="one_page")


class CreateBriefingRequest(BaseModel):
    topic: str
    user_request: str
    selected_series: List[SelectedSeries]
    options: BriefingOptions = Field(default_factory=BriefingOptions)


class CreateBriefingResponse(BaseModel):
    briefing_id: str
    version_id: str
    render_model: dict


class BriefingVersionSummary(BaseModel):
    id: str
    briefing_id: str
    version_number: int
    created_at: datetime
    created_by: str
    change_summary: Optional[str] = None
    content_json: dict
    data_pack: dict
    input_spec: dict


class ChatRequest(BaseModel):
    message: str
    target_version_id: Optional[str] = None


class ChatResponse(BaseModel):
    briefing_id: str
    new_version_id: str
    change_summary: Optional[str] = None
    render_model: dict


class CommentCreateRequest(BaseModel):
    version_id: str
    anchor: str
    comment_text: str


class CommentResponse(BaseModel):
    comment_id: str
    status: str


class PdfExportRequest(BaseModel):
    version_id: str


class BriefingComment(BaseModel):
    id: str
    briefing_version_id: str
    created_at: datetime
    created_by: str
    anchor: str
    comment_text: str
    status: str


class BriefingChatMessage(BaseModel):
    id: str
    briefing_id: str
    created_at: datetime
    role: str
    message: str
    version_id: Optional[str] = None


class BriefingSummary(BaseModel):
    id: str
    title: str
    topic: str
    status: str
    created_at: datetime
    updated_at: datetime
    latest_version_id: Optional[str] = None
