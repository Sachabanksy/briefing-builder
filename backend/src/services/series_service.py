from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.database import db
from src.economic_data_service import get_data_source_config


def fetch_ons_series(
    series_id: str,
    *,
    dataset_id: Optional[str],
    start_period: Optional[str],
    end_period: Optional[str],
    limit: int,
) -> List[Dict[str, Any]]:
    query = """
        SELECT dataset_id, series_id, title, period_label, value, unit, measure, dimension, metadata
        FROM ons_economic_series
        WHERE series_id = %s
    """
    params: List[Any] = [series_id]

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
        return cursor.fetchall()


def fetch_oecd_series(
    *,
    dataset_code: str,
    location: str,
    subject: str,
    measure: str,
    frequency: str,
    start_period: Optional[str],
    end_period: Optional[str],
    limit: int,
) -> List[Dict[str, Any]]:
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
    params: List[Any] = [dataset_code, location, subject, measure, frequency]

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
        data_points.append(row)
    return data_points


def resolve_series_by_slug(
    slug: str,
    *,
    limit: int,
    start_period: Optional[str],
    end_period: Optional[str],
) -> Dict[str, Any]:
    config = get_data_source_config(slug)
    if not config:
        raise ValueError(f"No configuration found for slug '{slug}'.")

    provider = config["provider"]

    if provider == "ONS":
        dataset_id = config.get("dataset_id")
        series_id = config.get("series_id")
        if not series_id:
            raise ValueError("ONS configuration missing series_id.")
        data = fetch_ons_series(
            series_id,
            dataset_id=dataset_id,
            start_period=start_period,
            end_period=end_period,
            limit=limit,
        )
        return {
            "slug": slug,
            "provider": provider,
            "dataset_id": dataset_id,
            "series_id": series_id,
            "data": data,
        }

    if provider == "OECD":
        dataset_code = config.get("dataset_code")
        location = config.get("location") or "GBR"
        subject = config.get("subject") or ""
        measure = config.get("measure") or ""
        frequency = config.get("frequency") or ""
        if not dataset_code or not subject or not measure or not frequency:
            raise ValueError("OECD configuration is incomplete.")
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
        return {
            "slug": slug,
            "provider": provider,
            "dataset_code": dataset_code,
            "series_id": subject,
            "data": data,
        }

    raise ValueError(f"Unsupported provider '{provider}'.")
