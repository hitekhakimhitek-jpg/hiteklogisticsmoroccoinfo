CREATE TABLE public.country_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  country_name text,
  holiday_date date NOT NULL,
  local_name text NOT NULL,
  name_en text NOT NULL,
  global boolean NOT NULL DEFAULT true,
  affects_operations boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, holiday_date, name_en)
);

GRANT SELECT ON public.country_holidays TO anon;
GRANT SELECT ON public.country_holidays TO authenticated;
GRANT ALL ON public.country_holidays TO service_role;

ALTER TABLE public.country_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read holidays" ON public.country_holidays FOR SELECT USING (true);
CREATE POLICY "Admin insert holidays" ON public.country_holidays FOR INSERT TO authenticated WITH CHECK (is_hitek_admin());
CREATE POLICY "Admin update holidays" ON public.country_holidays FOR UPDATE TO authenticated USING (is_hitek_admin()) WITH CHECK (is_hitek_admin());
CREATE POLICY "Admin delete holidays" ON public.country_holidays FOR DELETE TO authenticated USING (is_hitek_admin());

CREATE TRIGGER country_holidays_set_updated_at BEFORE UPDATE ON public.country_holidays FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_country_holidays_lookup ON public.country_holidays (country_code, holiday_date);