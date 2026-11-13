DROP POLICY IF EXISTS "weights_read_all" ON public.learned_weights;

DROP POLICY IF EXISTS "Public can read disruptions" ON public.disruptions;
CREATE POLICY "Admins read disruptions" ON public.disruptions FOR SELECT TO authenticated USING (public.is_hitek_admin());

DROP POLICY IF EXISTS "Anyone can read disruptions" ON public.disruption_events;
CREATE POLICY "Admins read disruption_events" ON public.disruption_events FOR SELECT TO authenticated USING (public.is_hitek_admin());

DROP POLICY IF EXISTS "Anyone can read compliance" ON public.compliance_register;
CREATE POLICY "Admins read compliance" ON public.compliance_register FOR SELECT TO authenticated USING (public.is_hitek_admin());

DROP POLICY IF EXISTS "events_public_read" ON public.supply_chain_events;
CREATE POLICY "Admins read supply_chain_events" ON public.supply_chain_events FOR SELECT TO authenticated USING (public.is_hitek_admin());

DROP POLICY IF EXISTS "event_updates_public_read" ON public.event_updates;
CREATE POLICY "Admins read event_updates" ON public.event_updates FOR SELECT TO authenticated USING (public.is_hitek_admin());

DROP POLICY IF EXISTS "Public read intelligence items" ON public.intelligence_items;
CREATE POLICY "Public read published intelligence" ON public.intelligence_items FOR SELECT TO anon, authenticated
  USING (processing_status = 'published' AND status <> 'archived');
CREATE POLICY "Admins read all intelligence" ON public.intelligence_items FOR SELECT TO authenticated USING (public.is_hitek_admin());

DROP POLICY IF EXISTS "Anyone can read monthly summaries" ON public.monthly_summaries;
CREATE POLICY "Public read recent monthly summaries" ON public.monthly_summaries FOR SELECT TO anon, authenticated
  USING (make_date(year, month, 1) >= (current_date - interval '24 months'));
CREATE POLICY "Admins read all monthly summaries" ON public.monthly_summaries FOR SELECT TO authenticated USING (public.is_hitek_admin());