CREATE TABLE public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  queries_total integer NOT NULL DEFAULT 0,
  queries_failed integer NOT NULL DEFAULT 0,
  candidates_found integer NOT NULL DEFAULT 0,
  candidates_accepted integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  enriched_count integer NOT NULL DEFAULT 0,
  archived_count integer NOT NULL DEFAULT 0,
  rejection_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ingestion_runs TO authenticated;
GRANT ALL ON public.ingestion_runs TO service_role;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hitek admins can read ingestion health"
ON public.ingestion_runs FOR SELECT TO authenticated
USING (public.is_hitek_admin());
CREATE INDEX ingestion_runs_pipeline_started_idx ON public.ingestion_runs (pipeline, started_at DESC);

ALTER TABLE public.intelligence_items
  ADD COLUMN IF NOT EXISTS verification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_verification_attempt_at timestamptz;
CREATE INDEX IF NOT EXISTS intelligence_items_publication_active_idx
  ON public.intelligence_items (publication_date DESC)
  WHERE status <> 'archived';