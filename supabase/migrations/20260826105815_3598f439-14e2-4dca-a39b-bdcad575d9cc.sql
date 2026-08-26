ALTER TYPE public.intel_processing_status ADD VALUE IF NOT EXISTS 'validated';
ALTER TYPE public.intel_processing_status ADD VALUE IF NOT EXISTS 'relevance_checked';
ALTER TYPE public.intel_processing_status ADD VALUE IF NOT EXISTS 'classified';
ALTER TYPE public.intel_processing_status ADD VALUE IF NOT EXISTS 'enrichment_failed';

ALTER TABLE public.intelligence_items
  ADD COLUMN IF NOT EXISTS relevance_status text NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS source_severity text,
  ADD COLUMN IF NOT EXISTS clean_title text,
  ADD COLUMN IF NOT EXISTS clean_summary text,
  ADD COLUMN IF NOT EXISTS decision_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enrichment_version text;

ALTER TABLE public.intelligence_items
  DROP CONSTRAINT IF EXISTS intelligence_items_relevance_status_check,
  ADD CONSTRAINT intelligence_items_relevance_status_check CHECK (relevance_status IN ('accept','review','reject'));

ALTER TABLE public.raw_items
  ADD COLUMN IF NOT EXISTS relevance_status text NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS source_severity text,
  ADD COLUMN IF NOT EXISTS clean_title text,
  ADD COLUMN IF NOT EXISTS clean_summary text,
  ADD COLUMN IF NOT EXISTS decision_reasons text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.raw_items
  DROP CONSTRAINT IF EXISTS raw_items_relevance_status_check,
  ADD CONSTRAINT raw_items_relevance_status_check CHECK (relevance_status IN ('accept','review','reject'));

CREATE TABLE public.hitek_technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  aliases text[] NOT NULL DEFAULT '{}',
  usage_status text NOT NULL DEFAULT 'unknown' CHECK (usage_status IN ('used','not_used','unknown')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hitek_technologies TO authenticated;
GRANT SELECT ON public.hitek_technologies TO anon;
GRANT ALL ON public.hitek_technologies TO service_role;
ALTER TABLE public.hitek_technologies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read technology applicability" ON public.hitek_technologies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Hitek admins can add technologies" ON public.hitek_technologies FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admins can update technologies" ON public.hitek_technologies FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admins can delete technologies" ON public.hitek_technologies FOR DELETE TO authenticated USING (public.is_hitek_admin());
CREATE TRIGGER hitek_technologies_set_updated_at BEFORE UPDATE ON public.hitek_technologies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.intelligence_reprocessing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.intelligence_items(id) ON DELETE CASCADE,
  previous_processing_status text NOT NULL,
  previous_department text NOT NULL,
  previous_severity text NOT NULL,
  previous_relevance_score integer NOT NULL,
  new_processing_status text NOT NULL,
  new_department text NOT NULL,
  new_severity text NOT NULL,
  new_relevance_score integer NOT NULL,
  decision_reasons text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, item_id)
);
GRANT SELECT ON public.intelligence_reprocessing_audit TO authenticated;
GRANT ALL ON public.intelligence_reprocessing_audit TO service_role;
ALTER TABLE public.intelligence_reprocessing_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hitek admins can inspect reprocessing audits" ON public.intelligence_reprocessing_audit FOR SELECT TO authenticated USING (public.is_hitek_admin());

CREATE INDEX IF NOT EXISTS idx_intelligence_relevance_status ON public.intelligence_items(relevance_status, processing_status, publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_hitek_technologies_usage ON public.hitek_technologies(usage_status);
CREATE INDEX IF NOT EXISTS idx_reprocessing_audit_run ON public.intelligence_reprocessing_audit(run_id, created_at DESC);

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
    AND i.relevance_status = 'accept'
    AND i.publication_date BETWEEN _start_date AND _end_date
    AND i.verification_status IN ('verified','partially_verified')
    AND i.relevance_score >= 35
    AND i.department_confidence >= 0.70
    AND nullif(trim(coalesce(i.clean_title, i.headline)), '') IS NOT NULL
    AND nullif(trim(coalesce(i.clean_summary, i.summary)), '') IS NOT NULL
    AND nullif(trim(i.impact), '') IS NOT NULL
    AND nullif(trim(i.action_required), '') IS NOT NULL
    AND lower(i.impact) NOT LIKE '%automatic summary unavailable%'
    AND lower(i.action_required) NOT LIKE '%review affected shipments and notify concerned customers%'
    AND i.source_url ~ '^https?://'
    AND lower(i.headline) !~ '(page not found|white papers?\s*\||special reports?\s*\||magazine\s*\||directories?\s*\||feedback from)'
    AND lower(i.source_url) !~ '/(white-papers?|special-reports?|magazine|director(y|ies)|categor(y|ies)|tags?|topics?|media-kit|newsletters?|release-notes?|search|authors?|feedback-from)(/|$|\?)'
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