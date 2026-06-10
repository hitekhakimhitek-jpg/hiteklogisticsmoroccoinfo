
-- Helper: detect Hitek admin (any @hitek.ma email)
CREATE OR REPLACE FUNCTION public.is_hitek_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email') = 'info@hitek.ma'
    OR lower(auth.jwt() ->> 'email') LIKE '%@hitek.ma',
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_hitek_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hitek_admin() TO authenticated, service_role;

-- alert_settings: drop public policies, restrict to admin only (incl. read)
DROP POLICY IF EXISTS "Public insert alert_settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Public update alert_settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Public read alert_settings" ON public.alert_settings;

CREATE POLICY "Admin read alert_settings" ON public.alert_settings
  FOR SELECT TO authenticated USING (public.is_hitek_admin());
CREATE POLICY "Admin insert alert_settings" ON public.alert_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Admin update alert_settings" ON public.alert_settings
  FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Admin delete alert_settings" ON public.alert_settings
  FOR DELETE TO authenticated USING (public.is_hitek_admin());

-- compliance_register: keep public read, restrict writes
DROP POLICY IF EXISTS "Anyone can insert compliance" ON public.compliance_register;
DROP POLICY IF EXISTS "Anyone can update compliance" ON public.compliance_register;
DROP POLICY IF EXISTS "Anyone can delete compliance" ON public.compliance_register;

CREATE POLICY "Admin insert compliance" ON public.compliance_register
  FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Admin update compliance" ON public.compliance_register
  FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Admin delete compliance" ON public.compliance_register
  FOR DELETE TO authenticated USING (public.is_hitek_admin());

-- disruption_events: keep public read, restrict writes
DROP POLICY IF EXISTS "Anyone can insert disruptions" ON public.disruption_events;
DROP POLICY IF EXISTS "Anyone can update disruptions" ON public.disruption_events;
DROP POLICY IF EXISTS "Anyone can delete disruptions" ON public.disruption_events;

CREATE POLICY "Admin insert disruption_events" ON public.disruption_events
  FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Admin update disruption_events" ON public.disruption_events
  FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Admin delete disruption_events" ON public.disruption_events
  FOR DELETE TO authenticated USING (public.is_hitek_admin());

-- intelligence_items: remove public write policies (admin policies already exist)
DROP POLICY IF EXISTS "Public insert intelligence items" ON public.intelligence_items;
DROP POLICY IF EXISTS "Public update intelligence items" ON public.intelligence_items;
DROP POLICY IF EXISTS "Public delete intelligence items" ON public.intelligence_items;

-- weekly_digests: keep public read, restrict writes
DROP POLICY IF EXISTS "Public write weekly_digests" ON public.weekly_digests;
DROP POLICY IF EXISTS "Public update weekly_digests" ON public.weekly_digests;
DROP POLICY IF EXISTS "Public delete weekly_digests" ON public.weekly_digests;

CREATE POLICY "Admin insert weekly_digests" ON public.weekly_digests
  FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Admin update weekly_digests" ON public.weekly_digests
  FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Admin delete weekly_digests" ON public.weekly_digests
  FOR DELETE TO authenticated USING (public.is_hitek_admin());

-- Revoke public execute on the SECURITY DEFINER cleanup function
REVOKE EXECUTE ON FUNCTION public.cleanup_old_entries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_entries() TO service_role;
