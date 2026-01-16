from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.database import db


def search_series(topic: Optional[str], query_text: Optional[str], limit: int = 25) -> List[Dict[str, Any]]:
    query = """
        SELECT slug, provider, dataset_id, dataset_code, series_id, location, subject, measure, frequency, unit, time_filter, description, metadata
        FROM economic_data_sources
        WHERE enabled = TRUE
    """
    params: List[Any] = []

    if topic:
        query += """
            AND (
                LOWER(COALESCE(metadata->>'category', metadata->>'topic')) = LOWER(%s)
                OR LOWER(slug) = LOWER(%s)
            )
        """
        params.extend([topic, topic])

    if query_text:
        query += " AND (slug ILIKE %s OR description ILIKE %s)"
        wildcard = f"%{query_text}%"
        params.extend([wildcard, wildcard])

    query += " ORDER BY slug LIMIT %s"
    params.append(limit)

    with db.get_cursor() as cursor:
        cursor.execute(query, params)
        return cursor.fetchall()


def find_by_source(source: str, source_series_id: str) -> Optional[Dict[str, Any]]:
    provider = source.upper()
    query = """
        SELECT *
        FROM economic_data_sources
        WHERE enabled = TRUE
          AND provider = %s
          AND (
            (provider = 'ONS' AND series_id = %s) OR
            (provider = 'OECD' AND subject = %s)
          )
        LIMIT 1
    """
    with db.get_cursor() as cursor:
        cursor.execute(query, (provider, source_series_id, source_series_id))
        return cursor.fetchone()
