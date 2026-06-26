ALTER TABLE public.weekly_digests
  ADD COLUMN IF NOT EXISTS category text;

-- Allow one row per (year, week, category) when category is set.
DROP INDEX IF EXISTS idx_weekly_digest_category;
CREATE UNIQUE INDEX idx_weekly_digest_category
  ON public.weekly_digests (year, week_number, category)
  WHERE category IS NOT NULL;