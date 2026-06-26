DROP INDEX IF EXISTS public.idx_weekly_digest_all;
CREATE UNIQUE INDEX idx_weekly_digest_all
  ON public.weekly_digests (year, week_number)
  WHERE department IS NULL AND category IS NULL;