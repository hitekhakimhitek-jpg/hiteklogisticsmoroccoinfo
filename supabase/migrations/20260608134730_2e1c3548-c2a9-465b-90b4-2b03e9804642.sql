
CREATE TABLE public.alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  critical_webhook_url text,
  recipients_operations text,
  recipients_compliance text,
  recipients_finance text,
  recipients_commercial text,
  recipients_it text,
  weekly_digest_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_settings TO anon, authenticated;
GRANT ALL ON public.alert_settings TO service_role;

ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read alert_settings" ON public.alert_settings FOR SELECT USING (true);
CREATE POLICY "Public insert alert_settings" ON public.alert_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update alert_settings" ON public.alert_settings FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER trg_alert_settings_updated
BEFORE UPDATE ON public.alert_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.alert_settings DEFAULT VALUES;

CREATE TABLE public.weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  week_number integer NOT NULL,
  department public.intel_department,
  summary_md text NOT NULL,
  item_count integer NOT NULL DEFAULT 0,
  act_now_count integer NOT NULL DEFAULT 0,
  this_week_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_weekly_digest_dept ON public.weekly_digests(year, week_number, department) WHERE department IS NOT NULL;
CREATE UNIQUE INDEX idx_weekly_digest_all ON public.weekly_digests(year, week_number) WHERE department IS NULL;
CREATE INDEX idx_weekly_digest_recent ON public.weekly_digests(year DESC, week_number DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_digests TO anon, authenticated;
GRANT ALL ON public.weekly_digests TO service_role;

ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read weekly_digests" ON public.weekly_digests FOR SELECT USING (true);
CREATE POLICY "Public write weekly_digests" ON public.weekly_digests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update weekly_digests" ON public.weekly_digests FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete weekly_digests" ON public.weekly_digests FOR DELETE USING (true);

ALTER TABLE public.intelligence_items ADD COLUMN alerted_at timestamptz;
