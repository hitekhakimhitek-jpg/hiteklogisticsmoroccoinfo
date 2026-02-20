
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create custom types
CREATE TYPE public.news_category AS ENUM ('regulation', 'weather', 'port', 'trade', 'compliance', 'market', 'general');
CREATE TYPE public.news_region AS ENUM ('morocco', 'europe', 'asia', 'americas', 'africa', 'middle_east', 'global');
CREATE TYPE public.news_priority AS ENUM ('critical', 'important', 'informational');

-- News entries table
CREATE TABLE public.news_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_content TEXT,
  source_url TEXT,
  source_name TEXT NOT NULL DEFAULT 'AI Generated',
  category public.news_category NOT NULL DEFAULT 'general',
  region public.news_region NOT NULL DEFAULT 'global',
  priority public.news_priority NOT NULL DEFAULT 'informational',
  impact_assessment TEXT,
  action_required BOOLEAN NOT NULL DEFAULT false,
  suggested_action TEXT,
  published_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fetched_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  week_number INT NOT NULL DEFAULT EXTRACT(WEEK FROM CURRENT_DATE)::INT,
  month INT NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INT,
  year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
);

-- Weekly reports table
CREATE TABLE public.weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INT NOT NULL,
  year INT NOT NULL,
  executive_summary TEXT NOT NULL,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(week_number, year)
);

-- Monthly summaries table
CREATE TABLE public.monthly_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INT NOT NULL,
  year INT NOT NULL,
  executive_summary TEXT NOT NULL,
  top_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  compliance_tracker JSONB NOT NULL DEFAULT '[]'::jsonb,
  morocco_digest TEXT,
  month_comparison JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- Indexes for performance
CREATE INDEX idx_news_entries_published ON public.news_entries(published_date DESC);
CREATE INDEX idx_news_entries_category ON public.news_entries(category);
CREATE INDEX idx_news_entries_region ON public.news_entries(region);
CREATE INDEX idx_news_entries_priority ON public.news_entries(priority);
CREATE INDEX idx_news_entries_week ON public.news_entries(week_number, year);
CREATE INDEX idx_news_entries_search ON public.news_entries USING GIN(to_tsvector('english', headline || ' ' || summary));

-- Enable RLS (public read, write via service role only)
ALTER TABLE public.news_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;

-- Public read policies (this is a public dashboard)
CREATE POLICY "Anyone can read news entries" ON public.news_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can read weekly reports" ON public.weekly_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can read monthly summaries" ON public.monthly_summaries FOR SELECT USING (true);

-- Auto-cleanup function: delete entries older than 90 days
CREATE OR REPLACE FUNCTION public.cleanup_old_entries()
RETURNS void AS $$
BEGIN
  DELETE FROM public.news_entries WHERE published_date < CURRENT_DATE - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
