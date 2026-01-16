#!/usr/bin/env python
"""
Ensure every configured economic series has data by seeding synthetic time series where needed.
"""

from __future__ import annotations

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.economic_data_service import list_data_source_configs
from src.services.synthetic_data_service import seed_series_by_config


def main() -> None:
    configs = list_data_source_configs()
    total_inserted = 0
    for config in configs:
        try:
            inserted = seed_series_by_config(config, periods=60, force=False)
        except ValueError:
            continue
        total_inserted += inserted

    print(f"Seeded {total_inserted} observations across {len(configs)} configured series.")


if __name__ == "__main__":
    main()
