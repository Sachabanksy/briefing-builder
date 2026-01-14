"""
Fetch UK economic time-series data from the ONS API and persist into Postgres.

Example:
    python database/fetchers/ons_fetcher.py --series L522 --dataset mm23 --time 2022
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests

# Ensure the backend src directory is importable when the script is executed directly.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.economic_data_service import store_ons_timeseries, get_data_source_config


ONS_BASE_URL = "https://api.ons.gov.uk/timeseries/{series_id}/dataset/{dataset_id}/data"


def fetch_timeseries(series_id: str, dataset_id: str, time_filter: str | None = None) -> Dict[str, Any]:
    """Call the ONS API for a series/dataset combination."""
    url = ONS_BASE_URL.format(series_id=series_id, dataset_id=dataset_id)
    params: Dict[str, str] = {}
    if time_filter:
        params["time"] = time_filter

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _normalise_value(raw_value: Any) -> float | None:
    if raw_value in (None, ""):
        return None
    try:
        return float(raw_value)
    except (TypeError, ValueError):
        return None


def build_records(payload: Dict[str, Any], dataset_id: str, series_id: str) -> List[Dict[str, Any]]:
    """Transform an ONS payload into DB-ready dictionaries."""
    description = payload.get("description", {})
    dataset_label = description.get("datasetId") or dataset_id
    series_label = description.get("seriesId") or series_id
    records: List[Dict[str, Any]] = []

    period_groups = (
        ("months", payload.get("months") or []),
        ("quarters", payload.get("quarters") or []),
        ("years", payload.get("years") or []),
    )

    for dimension, entries in period_groups:
        for entry in entries:
            period_label = entry.get("date") or entry.get("time") or entry.get("period")
            if not period_label:
                continue

            record = {
                "dataset_id": dataset_label,
                "series_id": series_label,
                "title": description.get("title"),
                "period_label": period_label,
                "value": _normalise_value(entry.get("value")),
                "unit": description.get("unit"),
                "measure": description.get("measureOfUnit"),
                "dimension": dimension,
                "metadata": {
                    "source": "ONS",
                    "raw_entry": entry,
                    "series": description,
                },
            }
            records.append(record)

    return records


def fetch_and_store(series_id: str, dataset_id: str, time_filter: str | None = None) -> int:
    """Fetch a series from ONS and persist it."""
    payload = fetch_timeseries(series_id=series_id, dataset_id=dataset_id, time_filter=time_filter)
    records = build_records(payload, dataset_id=dataset_id, series_id=series_id)
    return store_ons_timeseries(records)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch an ONS UK economic time-series and store it in Postgres.")
    parser.add_argument("--config", help="Slug from economic_data_sources lookup (provider must be ONS)")
    parser.add_argument("--series", help="ONS series identifier (e.g. L522)")
    parser.add_argument("--dataset", help="ONS dataset identifier (e.g. mm23)")
    parser.add_argument("--time", dest="time_filter", help="Optional ONS time filter (e.g. 2019, 2019-2023, latest)")
    args = parser.parse_args()

    if not args.config and (not args.series or not args.dataset):
        parser.error("Provide --config or both --series and --dataset.")

    return args


def resolve_parameters(args: argparse.Namespace) -> Tuple[str, str, str | None]:
    if args.config:
        config = get_data_source_config(args.config, provider="ONS")
        if not config:
            raise SystemExit(f"No enabled economic_data_sources entry found for slug '{args.config}' with provider ONS.")

        dataset_id = (config.get("dataset_id") or config.get("dataset_code") or "").strip()
        series_id = (config.get("series_id") or "").strip()
        if not dataset_id or not series_id:
            raise SystemExit(f"Configuration '{args.config}' is missing dataset/series identifiers.")

        time_filter = args.time_filter or config.get("time_filter")
        return dataset_id, series_id, time_filter

    dataset_id = args.dataset.strip()
    series_id = args.series.strip()
    time_filter = args.time_filter
    return dataset_id, series_id, time_filter


def main() -> None:
    args = parse_args()
    dataset_id, series_id, time_filter = resolve_parameters(args)
    inserted = fetch_and_store(series_id=series_id, dataset_id=dataset_id, time_filter=time_filter)
    print(
        f"Ingested {inserted} ONS observations for series {series_id} "
        f"in dataset {dataset_id} using config={args.config or 'manual'}."
    )


if __name__ == "__main__":
    main()
