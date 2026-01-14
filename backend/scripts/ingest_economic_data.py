#!/usr/bin/env python
"""
Simple orchestration helpers for ingesting configured economic data sources.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Iterable, List, Sequence

# Ensure backend modules are importable when script is executed directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.economic_data_service import list_data_source_configs
from database.fetchers.ons_fetcher import fetch_and_store as fetch_ons_series
from database.fetchers.oecd_fetcher import fetch_and_store as fetch_oecd_series


def _filter_configs(configs: Iterable[dict[str, Any]], slugs: Sequence[str] | None) -> list[dict[str, Any]]:
    if not slugs:
        return list(configs)
    wanted = {slug.lower() for slug in slugs}
    return [cfg for cfg in configs if cfg.get("slug", "").lower() in wanted]


def run_ingestion(config: dict[str, Any], *, time_override: str | None = None) -> int:
    provider = (config.get("provider") or "").upper()

    if provider == "ONS":
        dataset_id = (config.get("dataset_id") or config.get("dataset_code") or "").strip()
        series_id = (config.get("series_id") or "").strip()
        if not dataset_id or not series_id:
            raise ValueError(f"Configuration '{config.get('slug')}' missing dataset/series information.")
        time_filter = time_override or config.get("time_filter")
        metadata = config.get("metadata") or {}
        resource_path = metadata.get("resource_path")
        return fetch_ons_series(
            series_id=series_id,
            dataset_id=dataset_id,
            time_filter=time_filter,
            resource_path=resource_path,
        )

    if provider == "OECD":
        dataset = (config.get("dataset_code") or config.get("dataset_id") or "").strip()
        location = (config.get("location") or "GBR").strip()
        subject = (config.get("subject") or "").strip()
        measure = (config.get("measure") or "").strip()
        frequency = (config.get("frequency") or "").strip()
        if not dataset or not subject or not measure or not frequency:
            raise ValueError(f"Configuration '{config.get('slug')}' missing dataset/subject/measure/frequency.")
        time_window = time_override or config.get("time_filter")
        unit = config.get("unit")
        return fetch_oecd_series(
            dataset=dataset,
            location=location,
            subject=subject,
            measure=measure,
            frequency=frequency,
            time_window=time_window,
            unit=unit,
        )

    raise ValueError(f"Unknown provider '{provider}' for configuration '{config.get('slug')}'.")


def ingest_sources(
    *,
    provider: str | None = None,
    slugs: Sequence[str] | None = None,
    time_override: str | None = None,
    dry_run: bool = False,
) -> list[dict[str, Any]]:
    """
    Run ingestion for the configured sources.

    Returns a list of result dictionaries per slug (including success/error messages).
    """
    configs = list_data_source_configs(provider=provider)
    configs = _filter_configs(configs, slugs)

    results: list[dict[str, Any]] = []
    if not configs:
        results.append(
            {
                "status": "skipped",
                "reason": "no_configs",
                "provider": provider,
                "slugs": list(slugs) if slugs else [],
            }
        )
        return results

    for cfg in configs:
        slug = cfg.get("slug")
        provider_name = cfg.get("provider")
        descriptor = cfg.get("description")

        if dry_run:
            results.append(
                {
                    "slug": slug,
                    "provider": provider_name,
                    "status": "dry_run",
                    "description": descriptor,
                }
            )
            continue

        try:
            inserted = run_ingestion(cfg, time_override=time_override)
            results.append(
                {
                    "slug": slug,
                    "provider": provider_name,
                    "status": "success",
                    "inserted": inserted,
                }
            )
        except Exception as exc:  # pragma: no cover - orchestration log path
            results.append(
                {
                    "slug": slug,
                    "provider": provider_name,
                    "status": "error",
                    "error": str(exc),
                }
            )

    return results


def main() -> None:
    """Default behaviour when executed directly: ingest every enabled source."""
    results = ingest_sources()
    for result in results:
        slug = result.get("slug", "<n/a>")
        status = result.get("status")
        provider = result.get("provider")
        if status == "success":
            print(f"Ingested {result.get('inserted', 0)} rows for slug={slug} provider={provider}.")
        elif status == "dry_run":
            print(f"[DRY RUN] Would ingest slug={slug} provider={provider}.")
        else:
            print(f"Skipped slug={slug} provider={provider}: {result.get('reason') or result.get('error')}")


if __name__ == "__main__":
    main()
