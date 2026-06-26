DROP POLICY IF EXISTS feedback_update_public ON public.intel_feedback;
DROP POLICY IF EXISTS feedback_delete_public ON public.intel_feedback;

CREATE POLICY feedback_update_public ON public.intel_feedback
  FOR UPDATE
  USING (voter IS NOT NULL)
  WITH CHECK (voter IS NOT NULL);

CREATE POLICY feedback_delete_public ON public.intel_feedback
  FOR DELETE
  USING (voter IS NOT NULL);