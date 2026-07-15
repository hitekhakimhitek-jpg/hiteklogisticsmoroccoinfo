-- Restrict learned_weights read access to Hitek admins only.
-- Previously any authenticated user could read the internal scoring/model tuning data.
DROP POLICY IF EXISTS "learned_weights select" ON public.learned_weights;
DROP POLICY IF EXISTS "learned_weights_select" ON public.learned_weights;
DROP POLICY IF EXISTS "Learned weights are viewable by everyone" ON public.learned_weights;
DROP POLICY IF EXISTS "Authenticated users can view learned weights" ON public.learned_weights;
DROP POLICY IF EXISTS "learned_weights read" ON public.learned_weights;

CREATE POLICY "learned_weights admin read"
ON public.learned_weights
FOR SELECT
TO authenticated
USING (public.is_hitek_admin());