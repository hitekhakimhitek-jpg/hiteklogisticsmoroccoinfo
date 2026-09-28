ALTER TABLE public.source_health
  ADD COLUMN IF NOT EXISTS items_valid_last_run integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_inserted_last_run integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_invalid_last_run integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false;

-- Orphaned health rows from sources that were renamed (now collected through
-- the WMO Alert Hub under their "WMO Alert Hub — …" names) or that have no
-- public machine-readable feed (Copernicus EMS requires an activation code).
DELETE FROM public.source_health WHERE source_name IN (
  'Australian Bureau of Meteorology','Copernicus EMS Rapid Mapping','India Meteorological Department',
  'Meteo-France Vigilance','WMO Severe Weather Information Centre');
UPDATE public.sources SET enabled = false WHERE name IN (
  'Australian Bureau of Meteorology','Copernicus EMS Rapid Mapping','India Meteorological Department',
  'Meteo-France Vigilance','WMO Severe Weather Information Centre');

-- Re-derive status for existing rows: a successful fetch that simply found
-- nothing new is "no_new_items", not broken.
UPDATE public.source_health
SET status = 'no_new_items', consecutive_failures = 0,
    failure_reason = 'Search succeeded — no new publications in the last 7 days'
WHERE last_error = 'No parseable current articles found in this source cohort'
  AND coalesce(http_status, 0) BETWEEN 200 AND 399;