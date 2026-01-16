# Economic Briefing Builder — Backend

## Prerequisites

- Docker Desktop installed
- Docker Compose installed

## Quick Start

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <project-directory>
```

2. Create a `.env` file in the `backend/` directory (see `.env.example`) and set:
```
OPENAI_API_KEY=sk-***
```
You can also override `LOG_LEVEL` (defaults to `INFO`) or any DB settings here.

3. Start the application from the `backend/` directory:
```bash
docker-compose up
```

The database schema is applied automatically and `scripts/seed_all_series.py` runs at startup to ensure every configured series has synthetic time series data. Uvicorn then serves the FastAPI app on http://localhost:8000.

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

## FastAPI service

Key endpoints (see http://localhost:8000/docs for the full list):

- `GET /health` – readiness check.
- `GET /sources` – enabled economic data configurations.
- `GET /series`, `GET /series/{slug}`, `GET /ons/series/{series_id}`, `GET /oecd/series`, `GET /timeseries` – raw timeseries lookups.
- `POST /series/{slug}/seed` – force synthetic data generation for a specific slug (helpful after editing config metadata).
- `POST /data-packs/preview` – run the same data-pack builder used for LLM prompting without creating a briefing.
- `POST /briefings` – create and store a briefing (LLM-backed).
- `GET /briefings` – list saved briefings (used by the frontend “Browse Briefings” drawer).
- `GET /briefings/{id}` / `/versions/{version_id}` / `/chat` / `/comments` – retrieve stored content for editing/review.
- `POST /briefings/{id}/chat` – iterative editing.
- `POST /briefings/{id}/export/pdf` – PDF export.

If `OPENAI_API_KEY` is unset or the OpenAI client fails, the backend logs a warning and falls back to a deterministic stub so the rest of the workflow remains functional.

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
├── scripts/
│   ├── seed_all_series.py        # ensures every config has timeseries data at startup
│   └── seed_economic_data.py     # optional synthetic CPI/CLI seeding
└── src/
    ├── api.py                    # FastAPI app + routes
    ├── services/                 # briefing/data-pack/LLM/series helpers
    ├── repositories/             # DB access layers
    └── schemas/                  # pydantic models
```

## Environment Variables

Set either in `backend/.env` or via your shell before running docker-compose:

- `OPENAI_API_KEY` *(required)* – OpenAI API key for the briefing generator.
- `LOG_LEVEL` *(optional)* – Python logging level (`INFO`, `DEBUG`, etc.).
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` – override defaults if needed.

> The frontend expects the backend at http://localhost:8000 by default. Update `VITE_API_BASE` in `frontend/.env.local` if you change ports.
