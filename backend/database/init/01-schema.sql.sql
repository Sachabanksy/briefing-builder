-- database/init/01-schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Briefing + collaboration tables
CREATE TABLE IF NOT EXISTS briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    latest_version_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_briefings_updated_at
    BEFORE UPDATE ON briefings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS briefing_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    input_spec JSONB NOT NULL,
    data_pack JSONB NOT NULL,
    content_json JSONB NOT NULL,
    change_summary TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (briefing_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_briefing_versions_briefing
    ON briefing_versions(briefing_id, version_number DESC);

CREATE TRIGGER update_briefing_versions_updated_at
    BEFORE UPDATE ON briefing_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'briefings_latest_version_fk'
          AND table_name = 'briefings'
    ) THEN
        ALTER TABLE briefings
            ADD CONSTRAINT briefings_latest_version_fk
            FOREIGN KEY (latest_version_id) REFERENCES briefing_versions(id);
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS briefing_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_version_id UUID NOT NULL REFERENCES briefing_versions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    anchor TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_briefing_comments_version
    ON briefing_comments(briefing_version_id, created_at);

CREATE TRIGGER update_briefing_comments_updated_at
    BEFORE UPDATE ON briefing_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS briefing_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    message TEXT NOT NULL,
    version_id UUID REFERENCES briefing_versions(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_briefing_chat_briefing
    ON briefing_chat(briefing_id, created_at);

CREATE TRIGGER update_briefing_chat_updated_at
    BEFORE UPDATE ON briefing_chat
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
