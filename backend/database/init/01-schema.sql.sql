-- database/init/01-schema.sql

-- Economic data source lookup
CREATE TABLE IF NOT EXISTS economic_data_sources (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('ONS', 'OECD')),
    dataset_id TEXT,
    dataset_code TEXT,
    series_id TEXT,
    location TEXT,
    subject TEXT,
    measure TEXT,
    frequency TEXT,
    unit TEXT,
    time_filter TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_economic_sources_provider ON economic_data_sources(provider);

CREATE TRIGGER update_economic_sources_updated_at
    BEFORE UPDATE ON economic_data_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Economic data: ONS
CREATE TABLE IF NOT EXISTS ons_economic_series (
    id SERIAL PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    series_id TEXT NOT NULL,
    title TEXT,
    period_label TEXT NOT NULL,
    value NUMERIC,
    unit TEXT,
    measure TEXT,
    dimension TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (series_id, period_label)
);

CREATE INDEX IF NOT EXISTS idx_ons_series_period ON ons_economic_series(series_id, period_label);
CREATE INDEX IF NOT EXISTS idx_ons_dataset ON ons_economic_series(dataset_id);

CREATE TRIGGER update_ons_series_updated_at
    BEFORE UPDATE ON ons_economic_series
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Economic data: OECD
CREATE TABLE IF NOT EXISTS oecd_economic_series (
    id SERIAL PRIMARY KEY,
    dataset_code TEXT NOT NULL,
    location TEXT NOT NULL,
    subject TEXT,
    measure TEXT,
    frequency TEXT,
    period_label TEXT NOT NULL,
    value NUMERIC,
    unit TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (dataset_code, location, subject, measure, frequency, period_label)
);

CREATE INDEX IF NOT EXISTS idx_oecd_series_period
    ON oecd_economic_series(dataset_code, location, period_label);

CREATE TRIGGER update_oecd_series_updated_at
    BEFORE UPDATE ON oecd_economic_series
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
