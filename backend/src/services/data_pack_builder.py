from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence, Tuple

from dateutil import parser

from src.repositories import series as series_repo
from src.services import series_service


FREQUENCY_TO_PERIODS = {"M": 12, "Q": 4, "A": 1}


def _parse_period(period_label: str) -> Optional[date]:
    if not period_label:
        return None
    try:
        return date.fromisoformat(period_label)
    except ValueError:
        try:
            return parser.parse(period_label).date()
        except (ValueError, TypeError):
            return None


def _determine_frequency(meta: Dict[str, Any]) -> str:
    return (meta.get("frequency") or meta.get("metadata", {}).get("frequency") or "M").upper()


def _derive_stats(values: Sequence[Tuple[date, Optional[float]]], frequency: str) -> Dict[str, Any]:
    ordered = sorted([(period, value) for period, value in values if value is not None], key=lambda item: item[0])
    result: Dict[str, Any] = {}
    if not ordered:
        return result

    latest_period, latest_value = ordered[-1]
    result["latest_period"] = latest_period.isoformat()
    result["latest_value"] = latest_value

    if len(ordered) >= 2:
        prev_value = ordered[-2][1]
        if prev_value is not None and latest_value is not None:
            result["mom_change"] = round(latest_value - prev_value, 4)

    periods_per_year = FREQUENCY_TO_PERIODS.get(frequency, 12)
    if len(ordered) > periods_per_year:
        comparison = ordered[-(periods_per_year + 1)][1]
        if comparison is not None and latest_value is not None:
            result["yoy_change"] = round(latest_value - comparison, 4)

    if len(ordered) >= 3:
        window = [value for _, value in ordered[-3:] if value is not None]
        if window:
            result["rolling_3m_avg"] = round(mean(window), 4)

    if len(ordered) >= periods_per_year:
        window = [value for _, value in ordered[-periods_per_year:] if value is not None]
        if window:
            result["rolling_12m_avg"] = round(mean(window), 4)

    result["min"] = min(value for _, value in ordered)
    result["max"] = max(value for _, value in ordered)
    return result


def _quality_checks(observations: Sequence[Tuple[date, Optional[float]]], frequency: str) -> Tuple[str, List[Dict[str, Any]], List[str]]:
    checks: List[Dict[str, Any]] = []
    limitations: List[str] = []
    ordered = sorted([item for item in observations if item[0]], key=lambda item: item[0])
    if not ordered:
        return "red", [{"name": "availability", "ok": False, "detail": "No observations available."}], ["No observations available."]

    latest_period = ordered[-1][0]
    today = date.today()
    tolerance_days = 40 if frequency == "M" else 120
    is_fresh = (today - latest_period).days <= tolerance_days
    checks.append(
        {
            "name": "freshness",
            "ok": is_fresh,
            "detail": f"Latest period {latest_period.isoformat()} ({'fresh' if is_fresh else 'stale'})",
        }
    )
    if not is_fresh:
        limitations.append("Latest data is older than expected cadence.")

    total = len(ordered)
    missing_values = [period.isoformat() for period, value in ordered if value is None]
    checks.append(
        {
            "name": "missing_values",
            "ok": len(missing_values) == 0,
            "detail": f"{len(missing_values)} missing points out of {total}",
        }
    )
    if missing_values:
        limitations.append(f"Missing values for {', '.join(missing_values[:5])}")

    status = "green"
    if any(not check["ok"] for check in checks):
        status = "amber"
    if not ordered or len(ordered) < 3:
        status = "red"
        limitations.append("Insufficient lookback window to compute deltas.")

    return status, checks, limitations


def _hash_payload(payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def build_data_pack(
    *,
    topic: str,
    selected_series: List[Dict[str, Any]],
    options: Dict[str, Any],
) -> Dict[str, Any]:
    lookback_periods = options.get("lookback_periods", 24)

    series_payloads = []
    limitations: List[str] = []

    for selection in selected_series:
        config = series_repo.find_by_source(selection["source"], selection["source_series_id"])
        if not config:
            limitations.append(f"Series {selection['source']}:{selection['source_series_id']} not configured.")
            continue

        provider = config["provider"]
        frequency = _determine_frequency(config)
        limit = max(lookback_periods + 4, 12)
        dataset_id = selection.get("dataset_id") or config.get("dataset_id")

        rows: List[Dict[str, Any]]
        if provider == "ONS":
            rows = series_service.fetch_ons_series(
                config["series_id"],
                dataset_id=dataset_id,
                start_period=None,
                end_period=None,
                limit=limit,
            )
        elif provider == "OECD":
            rows = series_service.fetch_oecd_series(
                dataset_code=config["dataset_code"],
                location=config.get("location") or "GBR",
                subject=config.get("subject") or "",
                measure=config.get("measure") or "",
                frequency=config.get("frequency") or "",
                start_period=None,
                end_period=None,
                limit=limit,
            )
        else:
            limitations.append(f"Provider {provider} not supported in data pack.")
            continue

        observations = []
        for row in rows:
            parsed = _parse_period(row["period_label"])
            value = row.get("value")
            if value is not None:
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    value = None
            observations.append((parsed, value))

        derived = _derive_stats(observations, frequency)
        status, checks, series_limits = _quality_checks(observations, frequency)
        limitations.extend(series_limits)

        ingested_at = config.get("updated_at")
        if isinstance(ingested_at, (datetime, date)):
            ingested_at = ingested_at.isoformat()

        series_payloads.append(
            {
                "series_key": selection.get("alias") or config.get("slug"),
                "series_id": str(config.get("series_id") or config.get("slug")),
                "source": provider,
                "source_series_id": selection["source_series_id"],
                "name": config.get("description") or config.get("slug"),
                "unit": config.get("unit"),
                "frequency": frequency,
                "latest_period": derived.get("latest_period"),
                "observations": [
                    {
                        "period_start": obs[0].isoformat() if obs[0] else None,
                        "value": obs[1],
                    }
                    for obs in observations[:lookback_periods]
                    if obs[0]
                ],
                "derived": derived,
                "provenance": {
                    "pulled_at": datetime.utcnow().isoformat() + "Z",
                    "ingested_at": ingested_at,
                },
                "quality_status": status,
                "quality_checks": checks,
            }
        )

    aggregate_status = "green"
    if any(series["quality_status"] == "red" for series in series_payloads):
        aggregate_status = "red"
    elif any(series["quality_status"] == "amber" for series in series_payloads):
        aggregate_status = "amber"

    data_pack = {
        "topic": topic,
        "as_of": options.get("as_of", "latest"),
        "lookback_periods": lookback_periods,
        "series": series_payloads,
        "quality": {
            "status": aggregate_status,
            "checks": [
                {
                    "name": "coverage",
                    "ok": bool(series_payloads),
                    "detail": f"{len(series_payloads)} series included.",
                }
            ],
        },
        "data_limitations": limitations,
        "data_pack_hash": _hash_payload({"topic": topic, "series": series_payloads}),
    }
    return data_pack
