
-- 1) Anonymous voting
ALTER TABLE public.intel_feedback ALTER COLUMN voter DROP DEFAULT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_feedback TO anon;

DROP POLICY IF EXISTS "feedback_read_all" ON public.intel_feedback;
DROP POLICY IF EXISTS "feedback_insert_own" ON public.intel_feedback;
DROP POLICY IF EXISTS "feedback_update_own" ON public.intel_feedback;
DROP POLICY IF EXISTS "feedback_delete_own" ON public.intel_feedback;

CREATE POLICY "feedback_read_public"  ON public.intel_feedback FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "feedback_insert_public" ON public.intel_feedback FOR INSERT TO anon, authenticated WITH CHECK (voter IS NOT NULL);
CREATE POLICY "feedback_update_public" ON public.intel_feedback FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (voter IS NOT NULL);
CREATE POLICY "feedback_delete_public" ON public.intel_feedback FOR DELETE TO anon, authenticated USING (true);

-- 2) OG image column
ALTER TABLE public.intelligence_items ADD COLUMN IF NOT EXISTS og_image_url TEXT;

-- 3) Daily weekly-digest regeneration so the digest follows the live dashboard
SELECT cron.unschedule('weekly-digest-daily-refresh') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='weekly-digest-daily-refresh');
SELECT cron.schedule(
  'weekly-digest-daily-refresh',
  '30 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xegehpabifcfhxuvmmrb.supabase.co/functions/v1/generate-weekly-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer a48b71f6df37ce1238b7b667751bb94ba5074920e563458e2918ec335612a487"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
