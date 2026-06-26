CREATE OR REPLACE FUNCTION public.cast_intel_vote(_item_id uuid, _voter text, _vote text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _voter IS NULL OR length(trim(_voter)) = 0 THEN
    RAISE EXCEPTION 'voter required';
  END IF;
  IF _vote NOT IN ('useful','not_useful') THEN
    RAISE EXCEPTION 'invalid vote';
  END IF;
  INSERT INTO public.intel_feedback(item_id, voter, vote)
  VALUES (_item_id, _voter::uuid, _vote)
  ON CONFLICT (item_id, voter)
  DO UPDATE SET vote = EXCLUDED.vote, updated_at = now()
  WHERE public.intel_feedback.voter = _voter::uuid;
END $function$;