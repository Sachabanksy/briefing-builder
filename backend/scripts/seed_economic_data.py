#!/usr/bin/env python
"""
Seed the database with synthetic lookup entries and economic time series for development.
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, List

# Ensure backend modules are importable.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from psycopg2.extras import Json, execute_values

from src.database import db


LOOKUP_ROWS = [
    {
        "slug": "fake_ons_cpi",
        "provider": "ONS",
        "dataset_id": "fake_mm23",
        "dataset_code": None,
        "series_id": "FAKE_CPI",
        "location": None,
        "subject": None,
        "measure": "Index",
        "frequency": "M",
        "unit": "Index 2015=100",
        "time_filter": "latest",
        "description": "Synthetic CPI index for development testing",
        "metadata": {"resource_path": "/economy/inflationandpriceindices/timeseries/chaw/mm23", "source": "FAKE"},
    },
    {
        "slug": "fake_oecd_cli",
        "provider": "OECD",
        "dataset_id": None,
        "dataset_code": "FAKE_MEI",
        "series_id": None,
        "location": "GBR",
        "subject": "CLI",
        "measure": "STSA",
        "frequency": "M",
        "unit": "Index 2015=100",
        "time_filter": "2018-2024",
        "description": "Synthetic OECD-style composite indicator",
        "metadata": {"source": "FAKE"},
    },
]


def _generate_month_labels(count: int) -> List[str]:
    today = datetime.utcnow().replace(day=1)
    labels = []
    current = today
    for _ in range(count):
        labels.append(current.strftime("%Y-%m"))
        prev_month = current.month - 1 or 12
        prev_year = current.year - 1 if prev_month == 12 else current.year
        current = current.replace(year=prev_year, month=prev_month)
    return list(reversed(labels))


def _generate_random_series(base: float, volatility: float, count: int) -> List[float]:
    values = []
    current = base
    for _ in range(count):
        drift = random.uniform(-volatility, volatility)
        current = max(0.0, current + drift)
        values.append(round(current, 2))
    return values


def seed_lookup_table() -> None:
    query = """
        INSERT INTO economic_data_sources (
            slug, provider, dataset_id, dataset_code, series_id,
            location, subject, measure, frequency, unit, time_filter,
            description, metadata, enabled
        )
        VALUES %s
        ON CONFLICT (slug) DO UPDATE SET
            provider = EXCLUDED.provider,
            dataset_id = EXCLUDED.dataset_id,
            dataset_code = EXCLUDED.dataset_code,
            series_id = EXCLUDED.series_id,
            location = EXCLUDED.location,
            subject = EXCLUDED.subject,
            measure = EXCLUDED.measure,
            frequency = EXCLUDED.frequency,
            unit = EXCLUDED.unit,
            time_filter = EXCLUDED.time_filter,
            description = EXCLUDED.description,
            metadata = EXCLUDED.metadata,
            enabled = TRUE,
            updated_at = CURRENT_TIMESTAMP
    """
    rows = [
        (
            entry["slug"],
            entry["provider"],
            entry["dataset_id"],
            entry["dataset_code"],
            entry["series_id"],
            entry["location"],
            entry["subject"],
            entry["measure"],
            entry["frequency"],
            entry["unit"],
            entry["time_filter"],
            entry["description"],
            Json(entry.get("metadata") or {}),
            True,
        )
        for entry in LOOKUP_ROWS
    ]

    with db.get_cursor() as cursor:
        execute_values(cursor, query, rows)


def seed_fake_ons_data(records: int = 48) -> int:
    labels = _generate_month_labels(records)
    values = _generate_random_series(base=100, volatility=0.6, count=len(labels))
    query = """
        INSERT INTO ons_economic_series
            (dataset_id, series_id, title, period_label, value, unit, measure, dimension, metadata)
        VALUES %s
        ON CONFLICT (series_id, period_label)
        DO UPDATE SET
            value = EXCLUDED.value,
            unit = EXCLUDED.unit,
            measure = EXCLUDED.measure,
            metadata = EXCLUDED.metadata,
            title = EXCLUDED.title,
            updated_at = CURRENT_TIMESTAMP
    """
    rows = [
        (
            "fake_mm23",
            "FAKE_CPI",
            "Synthetic CPI Index",
            label,
            value,
            "Index 2015=100",
            "Index",
            "months",
            Json({"source": "FAKE_SEED", "dimension": "months"}),
        )
        for label, value in zip(labels, values)
    ]

    with db.get_cursor() as cursor:
        execute_values(cursor, query, rows)

    return len(rows)


def seed_fake_oecd_data(records: int = 48) -> int:
    labels = _generate_month_labels(records)
    values = _generate_random_series(base=100, volatility=0.8, count=len(labels))
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
    rows = [
        (
            "FAKE_MEI",
            "GBR",
            "CLI",
            "STSA",
            "M",
            label,
            value,
            "Index 2015=100",
            Json({"source": "FAKE_SEED"}),
        )
        for label, value in zip(labels, values)
    ]

    with db.get_cursor() as cursor:
        execute_values(cursor, query, rows)

    return len(rows)


def main() -> None:
    seed_lookup_table()
    ons_rows = seed_fake_ons_data()
    oecd_rows = seed_fake_oecd_data()
    print(f"Seeded lookup entries plus {ons_rows} ONS rows and {oecd_rows} OECD rows.")


if __name__ == "__main__":
    main()
