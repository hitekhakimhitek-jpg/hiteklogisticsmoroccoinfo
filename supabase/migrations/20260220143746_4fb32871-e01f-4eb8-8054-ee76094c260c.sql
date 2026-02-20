
-- Add richer fields to weekly_reports for Phase 6
ALTER TABLE public.weekly_reports
  ADD COLUMN IF NOT EXISTS risk_score integer,
  ADD COLUMN IF NOT EXISTS outlook text,
  ADD COLUMN IF NOT EXISTS key_takeaways jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommendations jsonb DEFAULT '[]'::jsonb;

-- Add richer fields to monthly_summaries for Phase 6
ALTER TABLE public.monthly_summaries
  ADD COLUMN IF NOT EXISTS trend_analysis jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS forward_outlook text,
  ADD COLUMN IF NOT EXISTS risk_score integer;
