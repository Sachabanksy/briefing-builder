from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.economic_data_service import store_oecd_timeseries


OECD_BASE_URL = "https://stats.oecd.org/SDMX-JSON/data"


def _normalise_value(raw: Any) -> float | None:
    if raw in (None, ""):
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def fetch_series(
    dataset: str,
    series_key: str,
    time_window: str | None = None,
    *,
    detail: str = "code",
    dimension_at_obs: str = "TimeDimension",
) -> Dict[str, Any]:
    """Call the OECD SDMX JSON endpoint."""
    url = f"{OECD_BASE_URL}/{dataset}/{series_key}/all"
    params = {
        "contentType": "application/json",
        "detail": detail,
        "dimensionAtObservation": dimension_at_obs,
    }
    if time_window:
        params["time"] = time_window

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _extract_dimension_values(
    dimensions: Iterable[Dict[str, Any]], key_indexes: Iterable[str]
) -> Dict[str, Dict[str, Any]]:
    resolved: Dict[str, Dict[str, Any]] = {}
    for idx, (dimension, key) in enumerate(zip(dimensions, key_indexes)):
        values = dimension.get("values", [])
        if key is None or int(key) >= len(values):
            continue
        resolved[dimension.get("id", f"dim_{idx}")] = values[int(key)]
    return resolved


def _time_lookup(observation_dimensions: List[Dict[str, Any]]) -> Dict[str, str]:
    for dimension in observation_dimensions:
        if dimension.get("id") == "TIME_PERIOD":
            return {str(idx): value.get("id") for idx, value in enumerate(dimension.get("values", []))}
    return {}


def build_records(
    payload: Dict[str, Any],
    *,
    dataset_code: str,
    default_location: str,
    default_subject: str,
    default_measure: str,
    default_frequency: str,
    default_unit: str | None = None,
) -> List[Dict[str, Any]]:
    structure = payload.get("structure", {})
    series_dimensions = structure.get("dimensions", {}).get("series", [])
    observation_dimensions = structure.get("dimensions", {}).get("observation", [])
    series_data = (payload.get("dataSets") or [{}])[0].get("series", {})
    time_map = _time_lookup(observation_dimensions)

    records: List[Dict[str, Any]] = []
    for series_key, series_content in series_data.items():
        series_indexes = series_key.split(":")
        resolved_dims = _extract_dimension_values(series_dimensions, series_indexes)
        location = resolved_dims.get("LOCATION", {}).get("id", default_location)
        subject = resolved_dims.get("SUBJECT", {}).get("id", default_subject)
        measure = resolved_dims.get("MEASURE", {}).get("id", default_measure)
        frequency = resolved_dims.get("FREQUENCY", {}).get("id", default_frequency)

        observations = series_content.get("observations", {})
        for obs_key, value_list in observations.items():
            period_label = time_map.get(obs_key, obs_key)
            value = _normalise_value(value_list[0] if value_list else None)
            record = {
                "dataset_code": dataset_code,
                "location": location,
                "subject": subject,
                "measure": measure,
                "frequency": frequency,
                "period_label": period_label,
                "value": value,
                "unit": default_unit or measure,
                "metadata": {
                    "source": "OECD",
                    "series_dimensions": resolved_dims,
                    "raw_observation": value_list,
                },
            }
            records.append(record)

    return records


def fetch_and_store(
    *,
    dataset: str,
    location: str,
    subject: str,
    measure: str,
    frequency: str,
    time_window: str | None,
    unit: str | None,
) -> int:
    series_key = ".".join(filter(None, [location, subject, measure, frequency]))
    payload = fetch_series(dataset=dataset, series_key=series_key, time_window=time_window)
    records = build_records(
        payload,
        dataset_code=dataset,
        default_location=location,
        default_subject=subject,
        default_measure=measure,
        default_frequency=frequency,
        default_unit=unit,
    )
    return store_oecd_timeseries(records)
