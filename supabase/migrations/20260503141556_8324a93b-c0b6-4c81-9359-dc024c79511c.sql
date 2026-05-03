-- 1) Extend region enum
ALTER TYPE news_region ADD VALUE IF NOT EXISTS 'north_america';
ALTER TYPE news_region ADD VALUE IF NOT EXISTS 'south_america';
ALTER TYPE news_region ADD VALUE IF NOT EXISTS 'oceania';

-- 2) Add new columns
ALTER TABLE public.news_entries
  ADD COLUMN IF NOT EXISTS display_regions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS affected_countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS impact_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS region_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS classification_notes text;

-- 3) Backfill display_regions from existing region
UPDATE public.news_entries
SET display_regions = CASE
  WHEN region = 'morocco' THEN ARRAY['morocco']
  WHEN region = 'global'  THEN ARRAY['global']
  ELSE ARRAY[region::text, 'global']
END
WHERE display_regions = '{}' OR display_regions IS NULL;

-- 4) Backfill content_type from existing category + priority
UPDATE public.news_entries
SET content_type = CASE
  WHEN category = 'regulation' THEN 'regulatory_change'
  WHEN category = 'compliance' THEN 'compliance'
  WHEN category = 'port'       THEN 'port_disruption'
  WHEN category = 'trade'      THEN 'sanctions_trade_restriction'
  WHEN category = 'weather'    THEN 'port_disruption'
  WHEN category = 'market'     THEN 'freight_market_update'
  ELSE 'general_news'
END
WHERE content_type IS NULL;

-- 5) Backfill impact_score baseline from priority + action_required
UPDATE public.news_entries
SET impact_score = LEAST(100,
  CASE priority
    WHEN 'critical'      THEN 80
    WHEN 'important'     THEN 55
    WHEN 'informational' THEN 25
  END
  + CASE WHEN action_required THEN 10 ELSE 0 END
  + CASE WHEN category IN ('regulation','compliance') THEN 10 ELSE 0 END
)
WHERE impact_score = 0;

-- 6) Helpful index for filtering by display_regions
CREATE INDEX IF NOT EXISTS news_entries_display_regions_idx
  ON public.news_entries USING GIN (display_regions);