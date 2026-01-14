# main.py
from src.economic_data_service import list_data_source_configs


def main():
    print("=== Economic Data Sources ===\n")
    configs = list_data_source_configs()
    if not configs:
        print("No enabled configurations found in economic_data_sources.")
        return

    for cfg in configs:
        provider = cfg.get("provider")
        slug = cfg.get("slug")
        descriptor = cfg.get("description") or "No description"
        dataset = cfg.get("dataset_id") or cfg.get("dataset_code") or "N/A"
        print(f"- {slug} [{provider}] dataset={dataset}")
        print(f"  {descriptor}")
        if cfg.get("time_filter"):
            print(f"  Time filter: {cfg['time_filter']}")
        print()


if __name__ == "__main__":
    main()
