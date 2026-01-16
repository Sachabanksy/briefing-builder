from __future__ import annotations

import random
from datetime import date
from typing import Any, Dict, List, Tuple

from psycopg2.extras import Json, execute_values

from src.database import db
from src.economic_data_service import get_data_source_config


def _generate_month_series(periods: int, *, base: float = 100.0, volatility: float = 0.8) -> List[Tuple[str, float]]:
    today = date.today().replace(day=1)
    labels: List[str] = []
    current = today
    for _ in range(periods):
        labels.append(current.strftime("%Y-%m-01"))
        prev_month = current.month - 1 or 12
        prev_year = current.year - 1 if prev_month == 12 else current.year
        current = current.replace(year=prev_year, month=prev_month)
    labels.reverse()

    values: List[float] = []
    current_value = base
    for _ in range(periods):
        drift = random.uniform(-volatility, volatility)
        current_value = max(0.0, current_value + drift)
        values.append(round(current_value, 3))

    return list(zip(labels, values))


def _count_rows(table: str, where: str, params: Tuple[Any, ...]) -> int:
    query = f"SELECT COUNT(*) AS count FROM {table} WHERE {where}"
    with db.get_cursor() as cursor:
        cursor.execute(query, params)
        row = cursor.fetchone()
        return int(row["count"]) if row else 0


def _seed_ons_series(config: Dict[str, Any], *, periods: int, force: bool) -> int:
    series_id = config.get("series_id") or config.get("slug")
    dataset_id = config.get("dataset_id") or config.get("dataset_code") or "FAKE_DATASET"
    if not series_id:
        return 0

    existing = _count_rows("ons_economic_series", "series_id = %s", (series_id,))
    if existing and not force:
        return 0

    if force and existing:
        with db.get_cursor() as cursor:
            cursor.execute("DELETE FROM ons_economic_series WHERE series_id = %s", (series_id,))

    rows = [
        (
            dataset_id,
            series_id,
            config.get("description") or series_id,
            period,
            value,
            config.get("unit") or "Index",
            config.get("measure") or "Index",
            "months",
            Json({"seeded": True}),
        )
        for period, value in _generate_month_series(periods)
    ]

    with db.get_cursor() as cursor:
        execute_values(
            cursor,
            """
            INSERT INTO ons_economic_series
            (dataset_id, series_id, title, period_label, value, unit, measure, dimension, metadata)
            VALUES %s
            """,
            rows,
        )
    return len(rows)


def _seed_oecd_series(config: Dict[str, Any], *, periods: int, force: bool) -> int:
    dataset_code = config.get("dataset_code") or config.get("dataset_id") or "FAKE_MEI"
    location = config.get("location") or "GBR"
    subject = config.get("subject") or (config.get("series_id") or config.get("slug"))
    measure = config.get("measure") or "STSA"
    frequency = config.get("frequency") or "M"

    existing = _count_rows(
        "oecd_economic_series",
        "dataset_code = %s AND location = %s AND COALESCE(subject,'') = COALESCE(%s,'') AND "
        "COALESCE(measure,'') = COALESCE(%s,'') AND COALESCE(frequency,'') = COALESCE(%s,'')",
        (dataset_code, location, subject, measure, frequency),
    )
    if existing and not force:
        return 0

    if force and existing:
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM oecd_economic_series
                WHERE dataset_code = %s AND location = %s
                  AND COALESCE(subject,'') = COALESCE(%s,'')
                  AND COALESCE(measure,'') = COALESCE(%s,'')
                  AND COALESCE(frequency,'') = COALESCE(%s,'')
                """,
                (dataset_code, location, subject, measure, frequency),
            )

    rows = [
        (
            dataset_code,
            location,
            subject,
            measure,
            frequency,
            period,
            value,
            config.get("unit") or "Index",
            Json({"seeded": True}),
        )
        for period, value in _generate_month_series(periods)
    ]

    with db.get_cursor() as cursor:
        execute_values(
            cursor,
            """
            INSERT INTO oecd_economic_series
            (dataset_code, location, subject, measure, frequency, period_label, value, unit, metadata)
            VALUES %s
            """,
            rows,
        )
    return len(rows)


def seed_series_by_config(config: Dict[str, Any], *, periods: int = 48, force: bool = False) -> int:
    provider = (config.get("provider") or "").upper()
    if provider == "ONS":
        return _seed_ons_series(config, periods=periods, force=force)
    if provider == "OECD":
        return _seed_oecd_series(config, periods=periods, force=force)
    raise ValueError(f"Provider '{provider}' is not supported for synthetic seeding.")


def seed_series_by_slug(slug: str, *, periods: int = 48, force: bool = False) -> int:
    config = get_data_source_config(slug)
    if not config:
        raise ValueError(f"No configuration found for slug '{slug}'.")
    return seed_series_by_config(config, periods=periods, force=force)
