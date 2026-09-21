DROP POLICY IF EXISTS feedback_read_public ON public.intel_feedback;

CREATE POLICY feedback_read_admin ON public.intel_feedback
FOR SELECT TO authenticated
USING (public.is_hitek_admin());

REVOKE SELECT ON public.intel_feedback FROM anon;

CREATE OR REPLACE FUNCTION public.intel_vote_counts()
RETURNS TABLE(item_id uuid, useful bigint, not_useful bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.item_id,
         count(*) FILTER (WHERE f.vote = 'useful')::bigint,
         count(*) FILTER (WHERE f.vote = 'not_useful')::bigint
  FROM public.intel_feedback f
  GROUP BY f.item_id
$$;

REVOKE ALL ON FUNCTION public.intel_vote_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intel_vote_counts() TO anon, authenticated;