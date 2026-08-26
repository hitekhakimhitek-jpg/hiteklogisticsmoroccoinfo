CREATE OR REPLACE FUNCTION public.is_hitek_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email') = 'info@hitek.ma'
    OR lower(auth.jwt() ->> 'email') LIKE '%@hitek.ma',
    false
  );
$$;