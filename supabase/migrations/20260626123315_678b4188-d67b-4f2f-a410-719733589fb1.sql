
ALTER TABLE public.intelligence_items
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS transport_modes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS port_affected text,
  ADD COLUMN IF NOT EXISTS airport_affected text,
  ADD COLUMN IF NOT EXISTS carrier_affected text,
  ADD COLUMN IF NOT EXISTS lane_affected text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS why_it_matters_to_hitek text,
  ADD COLUMN IF NOT EXISTS affected_lanes_or_customers text,
  ADD COLUMN IF NOT EXISTS action_required_bool boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggested_action text,
  ADD COLUMN IF NOT EXISTS week_number int,
  ADD COLUMN IF NOT EXISTS month int;

CREATE OR REPLACE FUNCTION public.intelligence_items_set_time_buckets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE base_date date;
BEGIN
  base_date := COALESCE(NEW.event_date, NEW.publication_date, (NEW.created_at)::date, CURRENT_DATE);
  NEW.week_number := EXTRACT(WEEK FROM base_date)::int;
  NEW.month := EXTRACT(MONTH FROM base_date)::int;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intelligence_items_time_buckets ON public.intelligence_items;
CREATE TRIGGER trg_intelligence_items_time_buckets
  BEFORE INSERT OR UPDATE OF event_date, publication_date
  ON public.intelligence_items
  FOR EACH ROW EXECUTE FUNCTION public.intelligence_items_set_time_buckets();

-- Backfill for existing rows
UPDATE public.intelligence_items
SET week_number = EXTRACT(WEEK FROM COALESCE(event_date, publication_date, created_at::date))::int,
    month = EXTRACT(MONTH FROM COALESCE(event_date, publication_date, created_at::date))::int
WHERE week_number IS NULL OR month IS NULL;

CREATE INDEX IF NOT EXISTS idx_intelligence_items_event_date ON public.intelligence_items(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_items_country ON public.intelligence_items(country);
CREATE INDEX IF NOT EXISTS idx_intelligence_items_category ON public.intelligence_items(category);
CREATE INDEX IF NOT EXISTS idx_intelligence_items_week_month ON public.intelligence_items(month, week_number);
