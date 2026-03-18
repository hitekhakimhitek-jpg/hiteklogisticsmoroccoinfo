-- Remove duplicate news entries, keeping only the oldest one per source_url
DELETE FROM public.news_entries a
USING public.news_entries b
WHERE a.source_url IS NOT NULL
  AND a.source_url = b.source_url
  AND a.fetched_date > b.fetched_date;

-- Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_entries_source_url ON public.news_entries (source_url) WHERE source_url IS NOT NULL;