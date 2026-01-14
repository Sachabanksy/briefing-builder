# My Project

## Prerequisites

- Docker Desktop installed
- Docker Compose installed

## Quick Start

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <project-directory>
```

2. Start the application:
```bash
docker-compose up
```

That's it! The database will be automatically created and initialized.

## Development

### Starting the application
```bash
# Start in foreground (see logs)
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f
docker-compose logs -f app  # Just app logs
docker-compose logs -f db   # Just database logs
```

### Stopping the application
```bash
# Stop containers (keeps data)
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v
```

### Accessing the database

**From your local machine:**
```bash
psql postgresql://devuser:devpass123@localhost:5432/myproject_dev
```

**From inside the container:**
```bash
docker-compose exec db psql -U devuser -d myproject_dev
```

**Using a GUI tool (like DBeaver, pgAdmin):**
- Host: localhost
- Port: 5432
- Database: myproject_dev
- Username: devuser
- Password: devpass123

### Running commands in the application
```bash
# Execute Python script
docker-compose exec app python scripts/your_script.py

# Open Python shell
docker-compose exec app python

# Run tests
docker-compose exec app pytest
```

### Database migrations (if using Alembic)
```bash
# Create a new migration
docker-compose exec app alembic revision --autogenerate -m "Description"

# Apply migrations
docker-compose exec app alembic upgrade head

# Rollback migration
docker-compose exec app alembic downgrade -1
```

## Troubleshooting

### Port already in use
If port 5432 is already in use, edit `docker-compose.yml` and change:
```yaml
ports:
  - "5433:5432"  # Use 5433 on host instead
```

### Fresh database needed
```bash
docker-compose down -v
docker-compose up
```

### See what's running
```bash
docker-compose ps
```

### View resource usage
```bash
docker stats
```

## Economic Data Fetchers

Economic ingestion is handled via Python modules so they can be orchestrated directly by the app:

- `database/fetchers/ons_fetcher.py` exposes `fetch_and_store(series_id, dataset_id, time_filter=None, resource_path=None)` for ONS time-series data. A `resource_path` (e.g. `/economy/inflationandpriceindices/timeseries/chaw/mm23`) is **required** and should be stored in the lookup metadata so the fetcher calls the same public endpoint you provided.
- `database/fetchers/oecd_fetcher.py` exposes `fetch_and_store(dataset=..., location=..., subject=..., measure=..., frequency=..., time_window=None, unit=None)` for OECD indicators.
- `scripts/ingest_economic_data.py` provides `ingest_sources(...)` which looks up one or more configured slugs from `economic_data_sources`, invokes the relevant fetcher, and records the results.

The lookup table is created/seeded during DB init (see entries like `ons_cpi` and `oecd_cli_uk` in `database/init/02-seed.sql`). To run every enabled configuration inside Docker you can still execute the orchestration module without flags:

```bash
docker-compose exec app python scripts/ingest_economic_data.py
```

For application-level control, import the orchestration helper and call it with your own filters:

```python
from scripts.ingest_economic_data import ingest_sources

# Run just the CPI slug with a custom time override
results = ingest_sources(slugs=["ons_cpi"], time_override="2020-2024")
```

### Development seed data

Run the comprehensive seed script to populate `economic_data_sources`, `ons_economic_series`, and `oecd_economic_series` with synthetic UK indicators:

```bash
docker-compose exec app python scripts/seed_economic_data.py
```

The script upserts lookup entries (`fake_ons_cpi`, `fake_oecd_cli`) and generates time-series values so the rest of the app has realistic data without calling external APIs.

### FastAPI service

The backend exposes a FastAPI app (served via Uvicorn on port 8000). Once `docker-compose up` is running you can hit:

- `GET /health` – readiness check.
- `GET /sources` – all enabled lookup records.
- `GET /ons/series/{series_id}` – pull ONS observations with optional `dataset_id`, `start_period`, `end_period`, and `limit`.
- `GET /oecd/series` – provide `dataset_code`, `location`, `subject`, `measure`, `frequency` to query OECD rows.
- `GET /series/{slug}` – hydrate any configured slug (e.g., `fake_ons_cpi`, `fake_oecd_cli`) and return its data.

Interactive docs live at [http://localhost:8000/docs](http://localhost:8000/docs).

## Project Structure
```
.
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── main.py
├── database/
│   └── init/
│       ├── 01-schema.sql
│       └── 02-seed.sql
└── src/
    ├── database.py
    └── models.py
```

## Environment Variables

The application uses these environment variables (set in docker-compose.yml):

- `DB_HOST`: Database hostname (default: db)
- `DB_NAME`: Database name (default: myproject_dev)
- `DB_USER`: Database user (default: devuser)
- `DB_PASSWORD`: Database password (default: devpass123)
- `DB_PORT`: Database port (default: 5432)
