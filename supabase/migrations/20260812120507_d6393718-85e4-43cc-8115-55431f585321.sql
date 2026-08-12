GRANT INSERT, UPDATE, DELETE ON public.sources TO authenticated;

CREATE POLICY sources_admin_insert_custom ON public.sources
FOR INSERT TO authenticated
WITH CHECK (public.is_hitek_admin() AND source_type = 'custom');

CREATE POLICY sources_admin_update_custom ON public.sources
FOR UPDATE TO authenticated
USING (public.is_hitek_admin() AND source_type = 'custom')
WITH CHECK (public.is_hitek_admin() AND source_type = 'custom');

CREATE POLICY sources_admin_delete_custom ON public.sources
FOR DELETE TO authenticated
USING (public.is_hitek_admin() AND source_type = 'custom');

-- Point raw CAP/XML/JSON alert links at a human-readable landing page.
UPDATE public.intelligence_items
SET source_url = CASE
  WHEN source_url ILIKE '%severeweather.wmo.int%' THEN 'https://severeweather.wmo.int/'
  ELSE regexp_replace(source_url, '^(https?://[^/]+).*$', '\1/')
END
WHERE source_url ~* '\.(xml|json|cap)(\?.*)?$' OR source_url ILIKE '%cap-alerts%';

UPDATE public.supply_chain_events
SET primary_source_url = CASE
  WHEN primary_source_url ILIKE '%severeweather.wmo.int%' THEN 'https://severeweather.wmo.int/'
  ELSE regexp_replace(primary_source_url, '^(https?://[^/]+).*$', '\1/')
END
WHERE primary_source_url ~* '\.(xml|json|cap)(\?.*)?$' OR primary_source_url ILIKE '%cap-alerts%';