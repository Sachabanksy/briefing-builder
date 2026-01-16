from __future__ import annotations

import logging
import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.economic_data_service import list_data_source_configs
from src.repositories import series as series_repo
from src.schemas.briefings import (
    ChatRequest,
    ChatResponse,
    CommentCreateRequest,
    CommentResponse,
    CreateBriefingRequest,
    CreateBriefingResponse,
    BriefingChatMessage,
    BriefingComment,
    PdfExportRequest,
    BriefingSummary,
)
from src.services.briefing_service import BriefingService
from src.services.data_pack_builder import build_data_pack
from src.services.series_service import fetch_oecd_series, fetch_ons_series, resolve_series_by_slug
from src.services.synthetic_data_service import seed_series_by_slug


class EconomicSource(BaseModel):
    slug: str
    provider: str
    dataset_id: Optional[str] = None
    dataset_code: Optional[str] = None
    series_id: Optional[str] = None
    location: Optional[str] = None
    subject: Optional[str] = None
    measure: Optional[str] = None
    frequency: Optional[str] = None
    unit: Optional[str] = None
    time_filter: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict] = None


class DataPoint(BaseModel):
    dataset_id: Optional[str] = None
    dataset_code: Optional[str] = None
    series_id: Optional[str] = None
    title: Optional[str] = None
    period_label: str
    value: Optional[float] = None
    unit: Optional[str] = None
    measure: Optional[str] = None
    subject: Optional[str] = None
    location: Optional[str] = None
    frequency: Optional[str] = None
    dimension: Optional[str] = None
    metadata: Optional[dict] = None


class SeriesResponse(BaseModel):
    slug: Optional[str] = None
    provider: str
    dataset_id: Optional[str] = None
    dataset_code: Optional[str] = None
    series_id: Optional[str] = None
    data: List[DataPoint]


class SeedSeriesRequest(BaseModel):
    periods: int = Field(default=48, ge=12, le=240)
    force: bool = Field(default=False)


log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(title="Economic Data API", version="0.1.0")
briefing_service = BriefingService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _fetch_ons_series(
    series_id: str,
    *,
    dataset_id: Optional[str] = None,
    start_period: Optional[str] = None,
    end_period: Optional[str] = None,
    limit: int = 120,
) -> List[DataPoint]:
    query = """
        SELECT dataset_id, series_id, title, period_label, value, unit, measure, dimension, metadata
        FROM ons_economic_series
        WHERE series_id = %s
    """
    params: List[str | int] = [series_id]

    if dataset_id:
        query += " AND dataset_id = %s"
        params.append(dataset_id)
    if start_period:
        query += " AND period_label >= %s"
        params.append(start_period)
    if end_period:
        query += " AND period_label <= %s"
        params.append(end_period)

    query += " ORDER BY period_label DESC LIMIT %s"
    params.append(limit)

    with db.get_cursor() as cursor:
        cursor.execute(query, params)
        rows = cursor.fetchall()

    return [DataPoint(**row) for row in rows]


def _fetch_oecd_series(
    *,
    dataset_code: str,
    location: str,
    subject: str,
    measure: str,
    frequency: str,
    start_period: Optional[str] = None,
    end_period: Optional[str] = None,
    limit: int = 120,
) -> List[DataPoint]:
    query = """
        SELECT dataset_code, location, subject, measure, frequency,
               period_label, value, unit, metadata
        FROM oecd_economic_series
        WHERE dataset_code = %s
          AND location = %s
          AND COALESCE(subject, '') = COALESCE(%s, '')
          AND COALESCE(measure, '') = COALESCE(%s, '')
          AND COALESCE(frequency, '') = COALESCE(%s, '')
    """
    params: List[str | int] = [dataset_code, location, subject, measure, frequency]

    if start_period:
        query += " AND period_label >= %s"
        params.append(start_period)
    if end_period:
        query += " AND period_label <= %s"
        params.append(end_period)

    query += " ORDER BY period_label DESC LIMIT %s"
    params.append(limit)

    with db.get_cursor() as cursor:
        cursor.execute(query, params)
        rows = cursor.fetchall()

    data_points = []
    for row in rows:
        row["dataset_id"] = row.get("dataset_code")
        row["series_id"] = row.get("subject")
        data_points.append(DataPoint(**row))
    return data_points


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@app.get("/sources", response_model=List[EconomicSource])
def list_sources() -> List[EconomicSource]:
    configs = list_data_source_configs()
    return [EconomicSource(**config) for config in configs]


@app.get("/series", response_model=List[EconomicSource])
def search_series(
    topic: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=200),
) -> List[EconomicSource]:
    records = series_repo.search_series(topic, q, limit)
    return [EconomicSource(**record) for record in records]


@app.get("/series/{slug}", response_model=SeriesResponse)
def get_series_by_slug(
    slug: str,
    limit: int = Query(120, ge=1, le=500),
    start_period: Optional[str] = Query(None),
    end_period: Optional[str] = Query(None),
) -> SeriesResponse:
    try:
        result = resolve_series_by_slug(
            slug,
            limit=limit,
            start_period=start_period,
            end_period=end_period,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SeriesResponse(**result)


@app.get("/ons/series/{series_id}", response_model=List[DataPoint])
def get_ons_series(
    series_id: str,
    dataset_id: Optional[str] = Query(None),
    start_period: Optional[str] = Query(None),
    end_period: Optional[str] = Query(None),
    limit: int = Query(120, ge=1, le=500),
) -> List[DataPoint]:
    data = fetch_ons_series(
        series_id,
        dataset_id=dataset_id,
        start_period=start_period,
        end_period=end_period,
        limit=limit,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Series not found or no data available.")
    return [DataPoint(**row) for row in data]


@app.get("/oecd/series", response_model=List[DataPoint])
def get_oecd_series(
    dataset_code: str = Query(..., description="Dataset code, e.g. FAKE_MEI"),
    location: str = Query("GBR"),
    subject: str = Query(...),
    measure: str = Query(...),
    frequency: str = Query(...),
    start_period: Optional[str] = Query(None),
    end_period: Optional[str] = Query(None),
    limit: int = Query(120, ge=1, le=500),
) -> List[DataPoint]:
    data = fetch_oecd_series(
        dataset_code=dataset_code,
        location=location,
        subject=subject,
        measure=measure,
        frequency=frequency,
        start_period=start_period,
        end_period=end_period,
        limit=limit,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Series not found or no data available.")
    return [DataPoint(**row) for row in data]


@app.get("/timeseries", response_model=List[DataPoint])
def get_timeseries(
    source: str = Query(..., description="ONS or OECD"),
    series_id: str = Query(..., description="Source-specific series identifier"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    limit: int = Query(240, ge=1, le=500),
) -> List[DataPoint]:
    source_upper = source.upper()
    if source_upper == "ONS":
        data = fetch_ons_series(
            series_id,
            dataset_id=None,
            start_period=start,
            end_period=end,
            limit=limit,
        )
    elif source_upper == "OECD":
        config = series_repo.find_by_source("OECD", series_id)
        if not config:
            raise HTTPException(status_code=404, detail="Series not found.")
        data = fetch_oecd_series(
            dataset_code=config["dataset_code"],
            location=config.get("location") or "GBR",
            subject=config.get("subject") or "",
            measure=config.get("measure") or "",
            frequency=config.get("frequency") or "",
            start_period=start,
            end_period=end,
            limit=limit,
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported source.")

    if not data:
        raise HTTPException(status_code=404, detail="No data available.")
    return [DataPoint(**row) for row in data]


@app.post("/briefings", response_model=CreateBriefingResponse)
def create_briefing(request: CreateBriefingRequest) -> CreateBriefingResponse:
    try:
        result = briefing_service.create_briefing(request=request, user_id="system_user")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CreateBriefingResponse(**result)


@app.get("/briefings", response_model=List[BriefingSummary])
def list_briefings(limit: int = Query(50, ge=1, le=200)) -> List[BriefingSummary]:
    records = briefing_service.list_briefings(limit=limit)
    return [BriefingSummary(**record) for record in records]


@app.get("/briefings/{briefing_id}")
def get_briefing_detail(briefing_id: str) -> dict:
    try:
        return briefing_service.get_briefing_detail(briefing_id=briefing_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/briefings/{briefing_id}/versions/{version_id}")
def get_briefing_version(briefing_id: str, version_id: str) -> dict:
    try:
        version = briefing_service.get_version(briefing_id=briefing_id, version_id=version_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return version.model_dump()


@app.post("/briefings/{briefing_id}/chat", response_model=ChatResponse)
def chat_with_briefing(briefing_id: str, request: ChatRequest) -> ChatResponse:
    try:
        result = briefing_service.handle_chat(briefing_id=briefing_id, request=request, user_id="system_user")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ChatResponse(**result)


@app.post("/briefings/{briefing_id}/comments", response_model=CommentResponse)
def add_comment(briefing_id: str, request: CommentCreateRequest) -> CommentResponse:
    try:
        result = briefing_service.add_comment(briefing_id=briefing_id, comment_request=request, user_id="system_user")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CommentResponse(**result)


@app.get("/briefings/{briefing_id}/comments", response_model=List[BriefingComment])
def list_comments(briefing_id: str, version_id: str = Query(...)) -> List[BriefingComment]:
    try:
        comments = briefing_service.list_comments(briefing_id=briefing_id, version_id=version_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [BriefingComment(**comment) for comment in comments]


@app.post("/briefings/{briefing_id}/export/pdf")
def export_briefing_pdf(briefing_id: str, request: PdfExportRequest) -> Response:
    try:
        pdf_bytes = briefing_service.export_pdf(briefing_id=briefing_id, version_id=request.version_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{briefing_id}.pdf"'},
    )


@app.get("/briefings/{briefing_id}/chat", response_model=List[BriefingChatMessage])
def list_chat_messages(briefing_id: str) -> List[BriefingChatMessage]:
    try:
        messages = briefing_service.list_chat_messages(briefing_id=briefing_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [BriefingChatMessage(**message) for message in messages]


@app.post("/series/{slug}/seed")
def seed_series(slug: str, request: SeedSeriesRequest) -> dict:
    try:
        inserted = seed_series_by_slug(slug, periods=request.periods, force=request.force)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    status = "seeded" if inserted else "skipped"
    return {"slug": slug, "inserted": inserted, "status": status, "force": request.force}


@app.post("/data-packs/preview")
def preview_data_pack(request: CreateBriefingRequest) -> dict:
    if not request.selected_series:
        raise HTTPException(status_code=400, detail="At least one series must be selected.")
    data_pack = build_data_pack(
        topic=request.topic,
        selected_series=[series.dict() for series in request.selected_series],
        options=request.options.dict(),
    )
    return data_pack
