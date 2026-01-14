-- database/init/02-seed.sql

-- Seed economic data sources lookup
INSERT INTO economic_data_sources (
    slug, provider, dataset_id, dataset_code, series_id, location, subject, measure, frequency, unit, time_filter, description, metadata
) VALUES
    (
        'ons_cpi',
        'ONS',
        'mm23',
        NULL,
        'L522',
        NULL,
        NULL,
        NULL,
        NULL,
        'Index 2015=100',
        'latest',
        'ONS Consumer Prices Index (CPI) main annual rate',
        jsonb_build_object(
            'category', 'inflation',
            'notes', 'Headline CPI, NSA',
            'resource_path', '/economy/inflationandpriceindices/timeseries/chaw/mm23'
        )
    ),
    (
        'oecd_cli_uk',
        'OECD',
        NULL,
        'MEI_CLI',
        NULL,
        'GBR',
        'CLOLITOT',
        'STSA',
        'M',
        'Index 2015=100',
        '2018-2024',
        'OECD Composite Leading Indicator for the United Kingdom',
        jsonb_build_object('category', 'leading_indicator', 'notes', 'Smoothed, seasonally adjusted')
    )
ON CONFLICT (slug) DO NOTHING;
