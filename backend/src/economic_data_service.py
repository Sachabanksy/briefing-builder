import logging
from typing import Iterable, Mapping, Any, Optional, List

from psycopg2.extras import Json, execute_values

from src.database import db


logger = logging.getLogger(__name__)


def _prepare_json(value: Mapping[str, Any] | None) -> Json:
    """Wrap mapping for JSONB storage."""
    return Json(value or {})


def store_ons_timeseries(records: Iterable[Mapping[str, Any]]) -> int:
    """
    Persist ONS time-series observations. Records must contain:
    dataset_id, series_id, period_label; optional title, value, unit, measure, dimension, metadata.
    """
    rows = [
        (
            record["dataset_id"],
            record["series_id"],
            record.get("title"),
            record["period_label"],
            record.get("value"),
            record.get("unit"),
            record.get("measure"),
            record.get("dimension"),
            _prepare_json(record.get("metadata")),
        )
        for record in records
    ]

    if not rows:
        return 0

    query = """
        INSERT INTO ons_economic_series
        (dataset_id, series_id, title, period_label, value, unit, measure, dimension, metadata)
        VALUES %s
        ON CONFLICT (series_id, period_label)
        DO UPDATE SET
            dataset_id = EXCLUDED.dataset_id,
            title = EXCLUDED.title,
            value = EXCLUDED.value,
            unit = EXCLUDED.unit,
            measure = EXCLUDED.measure,
            dimension = EXCLUDED.dimension,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
    """

    with db.get_cursor() as cursor:
        execute_values(cursor, query, rows)

    logger.info("Stored %s ONS observations", len(rows))
    return len(rows)


def store_oecd_timeseries(records: Iterable[Mapping[str, Any]]) -> int:
    """
    Persist OECD time-series observations. Records must contain:
    dataset_code, location, period_label, measure, frequency; optional subject, value, unit, metadata.
    """
    rows = [
        (
            record["dataset_code"],
            record["location"],
            record.get("subject"),
            record.get("measure"),
            record.get("frequency"),
            record["period_label"],
            record.get("value"),
            record.get("unit"),
            _prepare_json(record.get("metadata")),
        )
        for record in records
    ]

    if not rows:
        return 0

    query = """
        INSERT INTO oecd_economic_series
        (dataset_code, location, subject, measure, frequency, period_label, value, unit, metadata)
        VALUES %s
        ON CONFLICT (dataset_code, location, subject, measure, frequency, period_label)
        DO UPDATE SET
            value = EXCLUDED.value,
            unit = EXCLUDED.unit,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
    """

    with db.get_cursor() as cursor:
        execute_values(cursor, query, rows)

    logger.info("Stored %s OECD observations", len(rows))
    return len(rows)


def get_data_source_config(slug: str, provider: Optional[str] = None) -> Optional[Mapping[str, Any]]:
    """Fetch a single economic data source configuration."""
    query = """
        SELECT *
        FROM economic_data_sources
        WHERE slug = %s
          AND enabled = TRUE
    """
    params: List[Any] = [slug]

    if provider:
        query += " AND provider = %s"
        params.append(provider.upper())

    with db.get_cursor() as cursor:
        cursor.execute(query, params)
        return cursor.fetchone()


def list_data_source_configs(provider: Optional[str] = None) -> list[Mapping[str, Any]]:
    """List all enabled configurations; optionally filter by provider."""
    query = """
        SELECT *
        FROM economic_data_sources
        WHERE enabled = TRUE
    """
    params: List[Any] = []

    if provider:
        query += " AND provider = %s"
        params.append(provider.upper())

    query += " ORDER BY slug"

    with db.get_cursor() as cursor:
        cursor.execute(query, params)
        return cursor.fetchall()
