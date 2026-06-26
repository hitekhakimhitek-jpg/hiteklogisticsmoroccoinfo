
REVOKE EXECUTE ON FUNCTION public.intel_item_attributes(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_learned_weight(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_predicted_relevance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_all_predicted_relevance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_intel_feedback_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_intel_item_upsert_relevance() FROM PUBLIC, anon, authenticated;
