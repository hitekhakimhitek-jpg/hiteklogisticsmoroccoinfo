
CREATE OR REPLACE FUNCTION public.intelligence_items_set_time_buckets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE base_date date;
BEGIN
  base_date := COALESCE(NEW.event_date, NEW.publication_date, (NEW.created_at)::date, CURRENT_DATE);
  NEW.week_number := EXTRACT(WEEK FROM base_date)::int;
  NEW.month := EXTRACT(MONTH FROM base_date)::int;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.intelligence_items_set_time_buckets() FROM PUBLIC, anon, authenticated;
