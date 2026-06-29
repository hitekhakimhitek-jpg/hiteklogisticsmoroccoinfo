
-- Tighten intel_feedback: remove permissive INSERT; require RPC (cast_intel_vote / clear_intel_vote)
DROP POLICY IF EXISTS "feedback_insert_public" ON public.intel_feedback;

-- Force RLS on alert_settings (cannot be bypassed even by table owner)
ALTER TABLE public.alert_settings FORCE ROW LEVEL SECURITY;

-- Revoke EXECUTE from public/anon on SECURITY DEFINER functions that should not be
-- callable by unauthenticated users. Keep voting RPCs and is_hitek_admin available.
REVOKE EXECUTE ON FUNCTION public.recompute_learned_weight(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_predicted_relevance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_all_predicted_relevance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_intel_feedback_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_intel_item_upsert_relevance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.intel_item_attributes(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_entries() FROM PUBLIC, anon, authenticated;
