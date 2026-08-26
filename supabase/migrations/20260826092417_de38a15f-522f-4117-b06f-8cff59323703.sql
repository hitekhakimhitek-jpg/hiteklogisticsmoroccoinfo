DO $$ BEGIN
  CREATE TYPE public.intel_processing_status AS ENUM (
    'discovered','rejected_irrelevant','rejected_non_article','duplicate',
    'processing','enriched','published','failed','review_required'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.intelligence_items
  ADD COLUMN IF NOT EXISTS relevance_score smallint NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS department_confidence numeric(4,3) NOT NULL DEFAULT 0.700,
  ADD COLUMN IF NOT EXISTS severity_score smallint NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS classification_reason text,
  ADD COLUMN IF NOT EXISTS processing_status public.intel_processing_status NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS source_tier smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS ingested_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.intelligence_items
  DROP CONSTRAINT IF EXISTS intelligence_items_relevance_score_check,
  ADD CONSTRAINT intelligence_items_relevance_score_check CHECK (relevance_score BETWEEN 0 AND 100),
  DROP CONSTRAINT IF EXISTS intelligence_items_department_confidence_check,
  ADD CONSTRAINT intelligence_items_department_confidence_check CHECK (department_confidence BETWEEN 0 AND 1),
  DROP CONSTRAINT IF EXISTS intelligence_items_severity_score_check,
  ADD CONSTRAINT intelligence_items_severity_score_check CHECK (severity_score BETWEEN 0 AND 100),
  DROP CONSTRAINT IF EXISTS intelligence_items_source_tier_check,
  ADD CONSTRAINT intelligence_items_source_tier_check CHECK (source_tier BETWEEN 1 AND 4);

UPDATE public.intelligence_items
SET canonical_url = regexp_replace(split_part(source_url, '#', 1), '[?&](utm_[^=&]+|fbclid|gclid)=[^&]*', '', 'gi')
WHERE canonical_url IS NULL AND source_url IS NOT NULL;

ALTER TABLE public.raw_items
  ADD COLUMN IF NOT EXISTS relevance_score smallint,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS department_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS severity_score smallint,
  ADD COLUMN IF NOT EXISTS classification_reason text,
  ADD COLUMN IF NOT EXISTS processing_status public.intel_processing_status NOT NULL DEFAULT 'discovered',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid;

ALTER TABLE public.raw_items
  DROP CONSTRAINT IF EXISTS raw_items_relevance_score_check,
  ADD CONSTRAINT raw_items_relevance_score_check CHECK (relevance_score IS NULL OR relevance_score BETWEEN 0 AND 100),
  DROP CONSTRAINT IF EXISTS raw_items_department_confidence_check,
  ADD CONSTRAINT raw_items_department_confidence_check CHECK (department_confidence IS NULL OR department_confidence BETWEEN 0 AND 1),
  DROP CONSTRAINT IF EXISTS raw_items_severity_score_check,
  ADD CONSTRAINT raw_items_severity_score_check CHECK (severity_score IS NULL OR severity_score BETWEEN 0 AND 100),
  ADD CONSTRAINT raw_items_duplicate_of_fkey FOREIGN KEY (duplicate_of) REFERENCES public.raw_items(id) ON DELETE SET NULL;

ALTER TABLE public.weekly_digests
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS awareness_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_intelligence_canonical_url ON public.intelligence_items(canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intelligence_canonical_feed ON public.intelligence_items(processing_status, publication_date DESC, department, severity) WHERE status <> 'archived';
CREATE INDEX IF NOT EXISTS idx_raw_processing_quality ON public.raw_items(processing_status, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_canonical_url ON public.raw_items(canonical_url) WHERE canonical_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pipeline_control (
  pipeline text PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused','failed')),
  lease_token uuid,
  lease_expires_at timestamptz,
  paused_reason text,
  consecutive_rate_limits integer NOT NULL DEFAULT 0,
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_stage text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pipeline_control TO service_role;
ALTER TABLE public.pipeline_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hitek admins can inspect pipeline state"
ON public.pipeline_control FOR SELECT TO authenticated
USING (public.is_hitek_admin());

CREATE OR REPLACE FUNCTION public.acquire_pipeline_lease(_pipeline text, _lease_seconds integer DEFAULT 240)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _token uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.pipeline_control(pipeline, status, lease_token, lease_expires_at, last_started_at, updated_at)
  VALUES (_pipeline, 'running', _token, now() + make_interval(secs => greatest(30, least(_lease_seconds, 900))), now(), now())
  ON CONFLICT (pipeline) DO UPDATE
  SET status = 'running', lease_token = _token,
      lease_expires_at = now() + make_interval(secs => greatest(30, least(_lease_seconds, 900))),
      last_started_at = now(), updated_at = now()
  WHERE public.pipeline_control.status <> 'paused'
    AND (public.pipeline_control.lease_expires_at IS NULL OR public.pipeline_control.lease_expires_at < now());
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_pipeline_lease(_pipeline text, _token uuid, _succeeded boolean, _stage text DEFAULT NULL, _error text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.pipeline_control
  SET status = CASE WHEN _succeeded THEN 'idle' ELSE 'failed' END,
      lease_token = NULL, lease_expires_at = NULL,
      last_success_at = CASE WHEN _succeeded THEN now() ELSE last_success_at END,
      last_stage = coalesce(_stage, last_stage),
      paused_reason = CASE WHEN _succeeded THEN NULL ELSE left(_error, 1000) END,
      updated_at = now()
  WHERE pipeline = _pipeline AND lease_token = _token;
$$;

REVOKE ALL ON FUNCTION public.acquire_pipeline_lease(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_pipeline_lease(text, uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_pipeline_lease(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pipeline_lease(text, uuid, boolean, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.casablanca_week_bounds(_anchor timestamptz DEFAULT now())
RETURNS TABLE(period_start date, period_end date, iso_year integer, iso_week integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH local_day AS (
    SELECT (_anchor AT TIME ZONE 'Africa/Casablanca')::date AS d
  ), monday AS (
    SELECT d - (extract(isodow from d)::integer - 1) AS start_day FROM local_day
  )
  SELECT start_day, start_day + 6,
         extract(isoyear from start_day)::integer,
         extract(week from start_day)::integer
  FROM monday;
$$;

CREATE OR REPLACE FUNCTION public.canonical_intelligence(
  _start_date date DEFAULT (current_date - 13),
  _end_date date DEFAULT current_date,
  _department public.intel_department DEFAULT NULL,
  _severity public.intel_severity DEFAULT NULL,
  _limit integer DEFAULT 250
)
RETURNS SETOF public.intelligence_items
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT i.*
  FROM public.intelligence_items i
  WHERE i.status <> 'archived'
    AND i.processing_status = 'published'
    AND i.publication_date BETWEEN _start_date AND _end_date
    AND i.verification_status IN ('verified','partially_verified')
    AND i.relevance_score >= 60
    AND i.department_confidence >= 0.70
    AND nullif(trim(i.headline), '') IS NOT NULL
    AND nullif(trim(i.source_name), '') IS NOT NULL
    AND nullif(trim(i.summary), '') IS NOT NULL
    AND nullif(trim(i.impact), '') IS NOT NULL
    AND nullif(trim(i.action_required), '') IS NOT NULL
    AND i.source_url ~ '^https?://'
    AND (_department IS NULL OR i.department = _department)
    AND (_severity IS NULL OR i.severity = _severity)
  ORDER BY
    CASE i.severity WHEN 'act_now' THEN 0 WHEN 'this_week' THEN 1 ELSE 2 END,
    i.severity_score DESC, i.relevance_score DESC, i.publication_date DESC, i.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 250), 500));
$$;

CREATE OR REPLACE FUNCTION public.canonical_intelligence_counts(
  _start_date date DEFAULT (current_date - 13),
  _end_date date DEFAULT current_date,
  _department public.intel_department DEFAULT NULL,
  _severity public.intel_severity DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT * FROM public.canonical_intelligence(_start_date, _end_date, _department, _severity, 500)
  ), sev AS (
    SELECT severity::text key, count(*)::integer value FROM visible GROUP BY severity
  ), dept AS (
    SELECT department::text key, count(*)::integer value FROM visible GROUP BY department
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM visible),
    'act_now', coalesce((SELECT value FROM sev WHERE key='act_now'), 0),
    'this_week', coalesce((SELECT value FROM sev WHERE key='this_week'), 0),
    'awareness', coalesce((SELECT value FROM sev WHERE key='awareness'), 0),
    'by_dept', coalesce((SELECT jsonb_object_agg(key, value) FROM dept), '{}'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.casablanca_week_bounds(timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_intelligence(date, date, public.intel_department, public.intel_severity, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_intelligence_counts(date, date, public.intel_department, public.intel_severity) TO anon, authenticated, service_role;