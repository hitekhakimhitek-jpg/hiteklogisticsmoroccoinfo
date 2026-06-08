
-- Intelligence Items: the new core entity
CREATE TYPE public.intel_department AS ENUM ('operations','compliance','finance','commercial','it');
CREATE TYPE public.intel_severity AS ENUM ('act_now','this_week','awareness');
CREATE TYPE public.intel_status AS ENUM ('new','acknowledged','actioned','archived');
CREATE TYPE public.intel_horizon AS ENUM ('today','this_week','this_month','horizon');

CREATE TABLE public.intelligence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  summary text NOT NULL,
  impact text NOT NULL DEFAULT '',
  action_required text NOT NULL DEFAULT '',
  department public.intel_department NOT NULL DEFAULT 'operations',
  severity public.intel_severity NOT NULL DEFAULT 'awareness',
  time_to_impact public.intel_horizon NOT NULL DEFAULT 'horizon',
  time_to_impact_date date,
  affected_tags text[] NOT NULL DEFAULT '{}',
  source_name text NOT NULL DEFAULT 'Internal',
  source_url text,
  owner text,
  status public.intel_status NOT NULL DEFAULT 'new',
  is_ai_draft boolean NOT NULL DEFAULT false,
  source_entry_id uuid REFERENCES public.news_entries(id) ON DELETE SET NULL,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz
);

CREATE UNIQUE INDEX idx_intel_source_entry ON public.intelligence_items(source_entry_id) WHERE source_entry_id IS NOT NULL;
CREATE INDEX idx_intel_severity ON public.intelligence_items(severity);
CREATE INDEX idx_intel_department ON public.intelligence_items(department);
CREATE INDEX idx_intel_status ON public.intelligence_items(status);
CREATE INDEX idx_intel_created ON public.intelligence_items(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intelligence_items TO anon, authenticated;
GRANT ALL ON public.intelligence_items TO service_role;

ALTER TABLE public.intelligence_items ENABLE ROW LEVEL SECURITY;

-- App has no auth yet; spec says internal-only future. Open access for now.
CREATE POLICY "Public read intelligence items" ON public.intelligence_items FOR SELECT USING (true);
CREATE POLICY "Public insert intelligence items" ON public.intelligence_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update intelligence items" ON public.intelligence_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete intelligence items" ON public.intelligence_items FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_intel_updated
BEFORE UPDATE ON public.intelligence_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
