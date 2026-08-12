-- =============== Phase 1: source registry + health ===============
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  homepage text,
  feed_url text,
  source_type text NOT NULL DEFAULT 'news',
  tier smallint NOT NULL DEFAULT 3,
  fetch_method text NOT NULL DEFAULT 'auto',
  poll_interval_minutes integer NOT NULL DEFAULT 180,
  category text,
  country text,
  language text NOT NULL DEFAULT 'en',
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources_admin_read" ON public.sources FOR SELECT TO authenticated USING (public.is_hitek_admin());
CREATE TRIGGER sources_set_updated_at BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.source_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL UNIQUE,
  source_url text,
  source_type text,
  parser_method text,
  http_status integer,
  parse_status text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'unknown',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_item_detected_at timestamptz,
  latest_source_publication_at timestamptz,
  items_found_last_run integer NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  stale boolean NOT NULL DEFAULT false,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.source_health TO authenticated;
GRANT ALL ON public.source_health TO service_role;
ALTER TABLE public.source_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "source_health_admin_read" ON public.source_health FOR SELECT TO authenticated USING (public.is_hitek_admin());
CREATE TRIGGER source_health_set_updated_at BEFORE UPDATE ON public.source_health FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  source_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  http_status integer,
  fetch_method text,
  pages_requested integer NOT NULL DEFAULT 0,
  items_discovered integer NOT NULL DEFAULT 0,
  items_new integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  items_duplicates integer NOT NULL DEFAULT 0,
  items_rejected integer NOT NULL DEFAULT 0,
  duration_ms integer,
  errors text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX source_runs_source_started_idx ON public.source_runs (source_name, started_at DESC);
GRANT SELECT ON public.source_runs TO authenticated;
GRANT ALL ON public.source_runs TO service_role;
ALTER TABLE public.source_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "source_runs_admin_read" ON public.source_runs FOR SELECT TO authenticated USING (public.is_hitek_admin());

-- =============== Collect-first staging ===============
CREATE TABLE public.raw_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_type text,
  fetch_method text,
  url text,
  url_hash text NOT NULL,
  original_title text NOT NULL,
  original_summary text,
  translated_title text,
  translated_summary text,
  body text,
  source_language text,
  published_at timestamptz,
  updated_at_source timestamptz,
  countries text[] NOT NULL DEFAULT '{}',
  latitude double precision,
  longitude double precision,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  impact_score integer,
  event_id uuid,
  intel_item_id uuid,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_name, url_hash)
);
CREATE INDEX raw_items_status_idx ON public.raw_items (analysis_status, collected_at DESC);
GRANT SELECT ON public.raw_items TO authenticated;
GRANT ALL ON public.raw_items TO service_role;
ALTER TABLE public.raw_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_items_admin_read" ON public.raw_items FOR SELECT TO authenticated USING (public.is_hitek_admin());
CREATE TRIGGER raw_items_set_updated_at BEFORE UPDATE ON public.raw_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== Phase 4: logistics infrastructure ===============
CREATE TABLE public.logistics_infrastructure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL,
  country text,
  country_code text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_km integer NOT NULL DEFAULT 200,
  importance smallint NOT NULL DEFAULT 50,
  hitek_relevance smallint NOT NULL DEFAULT 20,
  aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, kind)
);
GRANT SELECT ON public.logistics_infrastructure TO anon, authenticated;
GRANT ALL ON public.logistics_infrastructure TO service_role;
ALTER TABLE public.logistics_infrastructure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "infrastructure_public_read" ON public.logistics_infrastructure FOR SELECT USING (true);
CREATE TRIGGER infrastructure_set_updated_at BEFORE UPDATE ON public.logistics_infrastructure FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== Phase 6: event clustering ===============
CREATE TABLE public.supply_chain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  logistics_impact text,
  next_watchpoint text,
  event_type text NOT NULL DEFAULT 'other',
  event_status text NOT NULL DEFAULT 'actual_disruption',
  severity text NOT NULL DEFAULT 'awareness',
  departments text[] NOT NULL DEFAULT '{}',
  global_logistics_impact_score integer NOT NULL DEFAULT 0,
  hitek_relevance_score integer NOT NULL DEFAULT 0,
  source_confidence text NOT NULL DEFAULT 'medium',
  confidence_score integer NOT NULL DEFAULT 50,
  countries text[] NOT NULL DEFAULT '{}',
  affected_ports text[] NOT NULL DEFAULT '{}',
  affected_airports text[] NOT NULL DEFAULT '{}',
  affected_shipping_lanes text[] NOT NULL DEFAULT '{}',
  affected_industrial_regions text[] NOT NULL DEFAULT '{}',
  transport_modes text[] NOT NULL DEFAULT '{}',
  latitude double precision,
  longitude double precision,
  forecast_track jsonb,
  forecast_time timestamptz,
  maximum_wind integer,
  hazard_type text,
  event_name text,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_count integer NOT NULL DEFAULT 1,
  primary_source_url text,
  event_started_at timestamptz,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supply_chain_events_active_idx ON public.supply_chain_events (is_active, last_updated_at DESC);
GRANT SELECT ON public.supply_chain_events TO anon, authenticated;
GRANT ALL ON public.supply_chain_events TO service_role;
ALTER TABLE public.supply_chain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_public_read" ON public.supply_chain_events FOR SELECT USING (true);
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.supply_chain_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.supply_chain_events(id) ON DELETE CASCADE,
  source_name text,
  change_summary text NOT NULL,
  severity text,
  event_status text,
  global_logistics_impact_score integer,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_updates_event_idx ON public.event_updates (event_id, created_at DESC);
GRANT SELECT ON public.event_updates TO anon, authenticated;
GRANT ALL ON public.event_updates TO service_role;
ALTER TABLE public.event_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_updates_public_read" ON public.event_updates FOR SELECT USING (true);

ALTER TABLE public.raw_items
  ADD CONSTRAINT raw_items_event_fk FOREIGN KEY (event_id) REFERENCES public.supply_chain_events(id) ON DELETE SET NULL;