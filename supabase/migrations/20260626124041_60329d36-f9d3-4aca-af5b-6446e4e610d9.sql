
CREATE TABLE public.intel_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.intelligence_items(id) ON DELETE CASCADE,
  voter UUID NOT NULL DEFAULT auth.uid(),
  vote TEXT NOT NULL CHECK (vote IN ('useful','not_useful')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, voter)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_feedback TO authenticated;
GRANT ALL ON public.intel_feedback TO service_role;
ALTER TABLE public.intel_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_read_all" ON public.intel_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback_insert_own" ON public.intel_feedback FOR INSERT TO authenticated WITH CHECK (voter = auth.uid());
CREATE POLICY "feedback_update_own" ON public.intel_feedback FOR UPDATE TO authenticated USING (voter = auth.uid()) WITH CHECK (voter = auth.uid());
CREATE POLICY "feedback_delete_own" ON public.intel_feedback FOR DELETE TO authenticated USING (voter = auth.uid());
CREATE TRIGGER trg_intel_feedback_updated BEFORE UPDATE ON public.intel_feedback FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.learned_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attribute_type TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  useful_count INT NOT NULL DEFAULT 0,
  not_useful_count INT NOT NULL DEFAULT 0,
  weight NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attribute_type, attribute_value)
);
GRANT SELECT ON public.learned_weights TO authenticated;
GRANT ALL ON public.learned_weights TO service_role;
ALTER TABLE public.learned_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weights_read_all" ON public.learned_weights FOR SELECT TO authenticated USING (true);

ALTER TABLE public.intelligence_items
  ADD COLUMN IF NOT EXISTS predicted_relevance NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.intel_item_attributes(_item_id UUID)
RETURNS TABLE(attribute_type TEXT, attribute_value TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH it AS (SELECT * FROM public.intelligence_items WHERE id = _item_id)
  SELECT 'source'::text, NULLIF(lower(source_name::text), '') FROM it WHERE source_name IS NOT NULL
  UNION ALL
  SELECT 'category'::text, NULLIF(lower(category::text), '') FROM it WHERE category IS NOT NULL
  UNION ALL
  SELECT 'department'::text, NULLIF(lower(department::text), '') FROM it WHERE department IS NOT NULL
  UNION ALL
  SELECT 'country'::text, NULLIF(lower(country::text), '') FROM it WHERE country IS NOT NULL
  UNION ALL
  SELECT 'lane'::text, NULLIF(lower(lane_affected::text), '') FROM it WHERE lane_affected IS NOT NULL
  UNION ALL
  SELECT 'carrier'::text, NULLIF(lower(carrier_affected::text), '') FROM it WHERE carrier_affected IS NOT NULL
  UNION ALL
  SELECT 'port'::text, NULLIF(lower(port_affected::text), '') FROM it WHERE port_affected IS NOT NULL
  UNION ALL
  SELECT 'airport'::text, NULLIF(lower(airport_affected::text), '') FROM it WHERE airport_affected IS NOT NULL
  UNION ALL
  SELECT 'transport_mode'::text, lower(m::text) FROM it, unnest(coalesce(transport_modes, ARRAY[]::text[])) m
  UNION ALL
  SELECT 'tag'::text, lower(t::text) FROM it, unnest(coalesce(affected_tags, ARRAY[]::text[])) t;
$$;

CREATE OR REPLACE FUNCTION public.recompute_learned_weight(_attr_type TEXT, _attr_value TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u INT; n INT; w NUMERIC;
BEGIN
  IF _attr_value IS NULL OR _attr_value = '' THEN RETURN; END IF;
  SELECT
    COUNT(*) FILTER (WHERE f.vote = 'useful'),
    COUNT(*) FILTER (WHERE f.vote = 'not_useful')
  INTO u, n
  FROM public.intel_feedback f
  JOIN LATERAL public.intel_item_attributes(f.item_id) a ON TRUE
  WHERE a.attribute_type = _attr_type AND a.attribute_value = _attr_value;
  w := (COALESCE(u,0) - COALESCE(n,0))::numeric / GREATEST(COALESCE(u,0) + COALESCE(n,0) + 3, 1)::numeric;
  INSERT INTO public.learned_weights(attribute_type, attribute_value, useful_count, not_useful_count, weight)
  VALUES (_attr_type, _attr_value, COALESCE(u,0), COALESCE(n,0), COALESCE(w,0))
  ON CONFLICT (attribute_type, attribute_value)
  DO UPDATE SET useful_count = EXCLUDED.useful_count,
                not_useful_count = EXCLUDED.not_useful_count,
                weight = EXCLUDED.weight,
                updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.recompute_predicted_relevance(_item_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(lw.weight), 0) INTO total
  FROM public.intel_item_attributes(_item_id) a
  JOIN public.learned_weights lw
    ON lw.attribute_type = a.attribute_type AND lw.attribute_value = a.attribute_value;
  UPDATE public.intelligence_items SET predicted_relevance = total WHERE id = _item_id;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_all_predicted_relevance()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.intelligence_items LOOP
    PERFORM public.recompute_predicted_relevance(r.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.on_intel_feedback_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a RECORD; affected_item UUID;
BEGIN
  affected_item := COALESCE(NEW.item_id, OLD.item_id);
  FOR a IN SELECT attribute_type, attribute_value FROM public.intel_item_attributes(affected_item) LOOP
    PERFORM public.recompute_learned_weight(a.attribute_type, a.attribute_value);
  END LOOP;
  PERFORM public.recompute_all_predicted_relevance();
  RETURN NULL;
END $$;
CREATE TRIGGER trg_intel_feedback_change
AFTER INSERT OR UPDATE OR DELETE ON public.intel_feedback
FOR EACH ROW EXECUTE FUNCTION public.on_intel_feedback_change();

CREATE OR REPLACE FUNCTION public.on_intel_item_upsert_relevance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(lw.weight), 0) INTO total
  FROM public.intel_item_attributes(NEW.id) a
  JOIN public.learned_weights lw
    ON lw.attribute_type = a.attribute_type AND lw.attribute_value = a.attribute_value;
  NEW.predicted_relevance := total;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_intel_items_predicted_relevance
BEFORE INSERT OR UPDATE OF source_name, category, department, country, lane_affected,
  carrier_affected, port_affected, airport_affected, transport_modes, affected_tags
ON public.intelligence_items
FOR EACH ROW EXECUTE FUNCTION public.on_intel_item_upsert_relevance();
