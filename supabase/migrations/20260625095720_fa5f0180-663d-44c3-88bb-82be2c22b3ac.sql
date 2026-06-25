DROP POLICY IF EXISTS "Hitek admin can insert intel" ON public.intelligence_items;
DROP POLICY IF EXISTS "Hitek admin can update intel" ON public.intelligence_items;
DROP POLICY IF EXISTS "Hitek admin can delete intel" ON public.intelligence_items;

CREATE POLICY "Hitek admin can insert intel"
ON public.intelligence_items
FOR INSERT
TO authenticated
WITH CHECK (public.is_hitek_admin());

CREATE POLICY "Hitek admin can update intel"
ON public.intelligence_items
FOR UPDATE
TO authenticated
USING (public.is_hitek_admin())
WITH CHECK (public.is_hitek_admin());

CREATE POLICY "Hitek admin can delete intel"
ON public.intelligence_items
FOR DELETE
TO authenticated
USING (public.is_hitek_admin());