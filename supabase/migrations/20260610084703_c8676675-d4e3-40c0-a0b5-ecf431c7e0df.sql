
-- Disruptions: unified table for scraped & manual map events
CREATE TABLE public.disruptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_name text,
  category text NOT NULL DEFAULT 'other',
  severity text NOT NULL DEFAULT 'medium',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  origin text NOT NULL DEFAULT 'scraped',
  event_date timestamptz NOT NULL DEFAULT now(),
  source_entry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.disruptions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.disruptions TO authenticated;
GRANT ALL ON public.disruptions TO service_role;

ALTER TABLE public.disruptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read disruptions"
  ON public.disruptions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Hitek admin can insert disruptions"
  ON public.disruptions FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@hitek.ma');

CREATE POLICY "Hitek admin can update disruptions"
  ON public.disruptions FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@hitek.ma')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@hitek.ma');

CREATE POLICY "Hitek admin can delete disruptions"
  ON public.disruptions FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@hitek.ma');

CREATE UNIQUE INDEX disruptions_source_entry_unique
  ON public.disruptions(source_entry_id)
  WHERE source_entry_id IS NOT NULL;

CREATE INDEX disruptions_event_date_idx ON public.disruptions(event_date DESC);

CREATE TRIGGER disruptions_set_updated_at
  BEFORE UPDATE ON public.disruptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.disruptions;
ALTER TABLE public.disruptions REPLICA IDENTITY FULL;

-- Also restrict intelligence_items writes to the admin user (manual Add Item).
-- Existing public read stays; tighten insert/update/delete.
DROP POLICY IF EXISTS "Anyone can insert intelligence items" ON public.intelligence_items;
DROP POLICY IF EXISTS "Anyone can update intelligence items" ON public.intelligence_items;
DROP POLICY IF EXISTS "Anyone can delete intelligence items" ON public.intelligence_items;

CREATE POLICY "Hitek admin can insert intel"
  ON public.intelligence_items FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@hitek.ma');

CREATE POLICY "Hitek admin can update intel"
  ON public.intelligence_items FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@hitek.ma')
  WITH CHECK ((auth.jwt() ->> 'email') = 'info@hitek.ma');

CREATE POLICY "Hitek admin can delete intel"
  ON public.intelligence_items FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'info@hitek.ma');
