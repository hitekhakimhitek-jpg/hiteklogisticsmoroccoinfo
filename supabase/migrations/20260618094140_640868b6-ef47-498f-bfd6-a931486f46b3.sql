
-- Disruptions: use is_hitek_admin() for consistency
DROP POLICY IF EXISTS "Hitek admin can insert disruptions" ON public.disruptions;
DROP POLICY IF EXISTS "Hitek admin can update disruptions" ON public.disruptions;
DROP POLICY IF EXISTS "Hitek admin can delete disruptions" ON public.disruptions;

CREATE POLICY "Hitek admin can insert disruptions" ON public.disruptions
  FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admin can update disruptions" ON public.disruptions
  FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admin can delete disruptions" ON public.disruptions
  FOR DELETE TO authenticated USING (public.is_hitek_admin());

-- Explicit admin write policies for news_entries
CREATE POLICY "Hitek admin can insert news_entries" ON public.news_entries
  FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admin can update news_entries" ON public.news_entries
  FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admin can delete news_entries" ON public.news_entries
  FOR DELETE TO authenticated USING (public.is_hitek_admin());

-- Explicit admin write policies for weekly_reports
CREATE POLICY "Hitek admin can insert weekly_reports" ON public.weekly_reports
  FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admin can update weekly_reports" ON public.weekly_reports
  FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admin can delete weekly_reports" ON public.weekly_reports
  FOR DELETE TO authenticated USING (public.is_hitek_admin());

-- Explicit admin write policies for monthly_summaries
CREATE POLICY "Hitek admin can insert monthly_summaries" ON public.monthly_summaries
  FOR INSERT TO authenticated WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admin can update monthly_summaries" ON public.monthly_summaries
  FOR UPDATE TO authenticated USING (public.is_hitek_admin()) WITH CHECK (public.is_hitek_admin());
CREATE POLICY "Hitek admin can delete monthly_summaries" ON public.monthly_summaries
  FOR DELETE TO authenticated USING (public.is_hitek_admin());
