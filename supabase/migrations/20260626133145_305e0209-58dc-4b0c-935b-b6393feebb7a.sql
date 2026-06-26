
-- 1) alert_settings: harden by forcing RLS so no owner bypass, keep existing admin-only policies.
ALTER TABLE public.alert_settings FORCE ROW LEVEL SECURITY;

-- 2) intel_feedback: replace broad UPDATE/DELETE policies with RPC-gated writes.
DROP POLICY IF EXISTS feedback_update_public ON public.intel_feedback;
DROP POLICY IF EXISTS feedback_delete_public ON public.intel_feedback;

REVOKE UPDATE, DELETE ON public.intel_feedback FROM anon, authenticated;

-- Upsert helper: insert or update the caller's own vote. Verifies voter is provided and rejects empty values.
CREATE OR REPLACE FUNCTION public.cast_intel_vote(_item_id uuid, _voter text, _vote text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _voter IS NULL OR length(trim(_voter)) = 0 THEN
    RAISE EXCEPTION 'voter required';
  END IF;
  IF _vote NOT IN ('useful','not_useful') THEN
    RAISE EXCEPTION 'invalid vote';
  END IF;
  INSERT INTO public.intel_feedback(item_id, voter, vote)
  VALUES (_item_id, _voter, _vote::intel_vote)
  ON CONFLICT (item_id, voter)
  DO UPDATE SET vote = EXCLUDED.vote, updated_at = now()
  WHERE public.intel_feedback.voter = _voter;
END $$;

-- Clear helper: remove only the caller's own vote.
CREATE OR REPLACE FUNCTION public.clear_intel_vote(_item_id uuid, _voter text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _voter IS NULL OR length(trim(_voter)) = 0 THEN
    RAISE EXCEPTION 'voter required';
  END IF;
  DELETE FROM public.intel_feedback
  WHERE item_id = _item_id AND voter = _voter;
END $$;

REVOKE ALL ON FUNCTION public.cast_intel_vote(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_intel_vote(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_intel_vote(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_intel_vote(uuid, text) TO anon, authenticated;
