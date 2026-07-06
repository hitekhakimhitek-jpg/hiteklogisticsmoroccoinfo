REVOKE EXECUTE ON FUNCTION public.cast_intel_vote(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_intel_vote(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cast_intel_vote(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_intel_vote(uuid, text) TO authenticated;