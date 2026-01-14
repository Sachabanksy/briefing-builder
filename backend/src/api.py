from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.database import db
from src.economic_data_service import get_data_source_config, list_data_source_configs


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
    dimension: Optional[str] = None
    metadata: Optional[dict] = None


class SeriesResponse(BaseModel):
    slug: Optional[str] = None
    provider: str
    dataset_id: Optional[str] = None
    dataset_code: Optional[str] = None
    series_id: Optional[str] = None
    data: List[DataPoint]


app = FastAPI(title="Economic Data API", version="0.1.0")

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


@app.get("/ons/series/{series_id}", response_model=List[DataPoint])
def get_ons_series(
    series_id: str,
    dataset_id: Optional[str] = Query(None),
    start_period: Optional[str] = Query(None),
    end_period: Optional[str] = Query(None),
    limit: int = Query(120, ge=1, le=500),
) -> List[DataPoint]:
    data = _fetch_ons_series(
        series_id,
        dataset_id=dataset_id,
        start_period=start_period,
        end_period=end_period,
        limit=limit,
    )
    if not data:
        raise HTTPException(status_code=404, detail="Series not found or no data available.")
    return data


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
    data = _fetch_oecd_series(
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
    return data


@app.get("/series/{slug}", response_model=SeriesResponse)
def get_series_by_slug(
    slug: str,
    limit: int = Query(120, ge=1, le=500),
    start_period: Optional[str] = Query(None),
    end_period: Optional[str] = Query(None),
) -> SeriesResponse:
    config = get_data_source_config(slug)
    if not config:
        raise HTTPException(status_code=404, detail=f"No configuration found for slug '{slug}'.")

    provider = config["provider"]
    if provider == "ONS":
        dataset_id = config.get("dataset_id")
        series_id = config.get("series_id")
        if not series_id:
            raise HTTPException(status_code=400, detail="ONS configuration missing series_id.")
        metadata = config.get("metadata") or {}
        if not metadata.get("resource_path"):
            metadata["resource_path"] = None
        data = _fetch_ons_series(
            series_id,
            dataset_id=dataset_id,
            start_period=start_period,
            end_period=end_period,
            limit=limit,
        )
        return SeriesResponse(
            slug=slug,
            provider=provider,
            dataset_id=dataset_id,
            series_id=series_id,
            data=data,
        )

    if provider == "OECD":
        dataset_code = config.get("dataset_code")
        location = config.get("location") or "GBR"
        subject = config.get("subject") or ""
        measure = config.get("measure") or ""
        frequency = config.get("frequency") or ""
        if not dataset_code or not subject or not measure or not frequency:
            raise HTTPException(status_code=400, detail="OECD configuration is incomplete.")
        data = _fetch_oecd_series(
            dataset_code=dataset_code,
            location=location,
            subject=subject,
            measure=measure,
            frequency=frequency,
            start_period=start_period,
            end_period=end_period,
            limit=limit,
        )
        return SeriesResponse(
            slug=slug,
            provider=provider,
            dataset_code=dataset_code,
            series_id=subject,
            data=data,
        )

    raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'.")
