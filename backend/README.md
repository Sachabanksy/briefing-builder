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

Two helper scripts live in `database/fetchers/` for ingesting economic indicators:

- `ons_fetcher.py` pulls UK time-series data directly from the Office for National Statistics (ONS) API.
- `oecd_fetcher.py` ingests SDMX-JSON observations from the OECD Stats API.

Both scripts normalise the remote payloads and store them in the Postgres tables `ons_economic_series` and `oecd_economic_series`. They can either be run with explicit arguments or by referencing a slug in the lookup table `economic_data_sources`, which is created/seeded during DB init (see entries like `ons_cpi` and `oecd_cli_uk` in `database/init/02-seed.sql`).

Run the scripts via Docker (so they can reach the same Postgres instance as the app):

```bash
# Fetch CPI data (series L522 in dataset mm23) using the lookup table slug
docker-compose exec app python database/fetchers/ons_fetcher.py --config ons_cpi --time 2022-2024

# Fetch OECD Composite Leading Indicator for the UK (configured slug)
docker-compose exec app python database/fetchers/oecd_fetcher.py \
  --config oecd_cli_uk --time 2020-2024

# Manual invocation also remains available:
docker-compose exec app python database/fetchers/oecd_fetcher.py \
  --dataset MEI_CLI --location GBR --subject CLOLITOT --measure STSA --frequency M --time 2020-2024
```

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
