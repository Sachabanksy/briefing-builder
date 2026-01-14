from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List

import requests

# Ensure the backend src directory is importable when the script is executed directly.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.economic_data_service import store_ons_timeseries


ONS_SITE_BASE_URL = "https://www.ons.gov.uk"


def _build_site_url(resource_path: str) -> str:
    path = resource_path.strip()
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{ONS_SITE_BASE_URL}{path}/data"


def fetch_timeseries(
    series_id: str,
    dataset_id: str,
    time_filter: str | None = None,
    resource_path: str | None = None,
) -> Dict[str, Any]:
    """Call the ONS site endpoint for a series/dataset combination."""
    params: Dict[str, str] = {}
    if time_filter:
        params["time"] = time_filter

    if not resource_path:
        raise ValueError(
            "ONS fetch requires a resource_path pointing to the public data endpoint "
            "(e.g. /economy/.../timeseries/chaw/mm23)."
        )

    url = _build_site_url(resource_path)

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


def fetch_and_store(
    series_id: str,
    dataset_id: str,
    time_filter: str | None = None,
    resource_path: str | None = None,
) -> int:
    """Fetch a series from ONS and persist it."""
    if not resource_path:
        raise ValueError(
            "ONS fetch_and_store requires resource_path; store this in economic_data_sources.metadata."
        )

    payload = fetch_timeseries(
        series_id=series_id,
        dataset_id=dataset_id,
        time_filter=time_filter,
        resource_path=resource_path,
    )
    records = build_records(payload, dataset_id=dataset_id, series_id=series_id)
    return store_ons_timeseries(records)
