
-- Phase 5: Compliance Register
CREATE TYPE public.compliance_status AS ENUM ('monitoring','in_progress','compliant','non_compliant','not_applicable');

CREATE TABLE public.compliance_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  regulation_ref text,
  jurisdiction text,
  department intel_department,
  effective_date date,
  deadline date,
  status compliance_status NOT NULL DEFAULT 'monitoring',
  owner_label text,
  evidence_url text,
  source_url text,
  notes text,
  linked_intel_id uuid REFERENCES public.intelligence_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_register TO anon, authenticated;
GRANT ALL ON public.compliance_register TO service_role;

ALTER TABLE public.compliance_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read compliance" ON public.compliance_register FOR SELECT USING (true);
CREATE POLICY "Anyone can insert compliance" ON public.compliance_register FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update compliance" ON public.compliance_register FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete compliance" ON public.compliance_register FOR DELETE USING (true);

CREATE TRIGGER compliance_register_set_updated_at
  BEFORE UPDATE ON public.compliance_register
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phase 6: Geographic disruptions
CREATE TYPE public.disruption_type AS ENUM ('port','strike','weather','geopolitical','customs','infrastructure','cyber','other');

CREATE TABLE public.disruption_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  disruption_type disruption_type NOT NULL DEFAULT 'other',
  severity intel_severity NOT NULL DEFAULT 'awareness',
  location_name text NOT NULL,
  country_code text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  source_url text,
  linked_intel_id uuid REFERENCES public.intelligence_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disruption_events TO anon, authenticated;
GRANT ALL ON public.disruption_events TO service_role;

ALTER TABLE public.disruption_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read disruptions" ON public.disruption_events FOR SELECT USING (true);
CREATE POLICY "Anyone can insert disruptions" ON public.disruption_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update disruptions" ON public.disruption_events FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete disruptions" ON public.disruption_events FOR DELETE USING (true);

CREATE TRIGGER disruption_events_set_updated_at
  BEFORE UPDATE ON public.disruption_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_disruption_active ON public.disruption_events(is_active);
CREATE INDEX idx_compliance_status ON public.compliance_register(status);
