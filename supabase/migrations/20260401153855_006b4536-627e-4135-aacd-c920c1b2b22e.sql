ALTER TABLE public.news_entries 
ADD COLUMN IF NOT EXISTS finance_score smallint DEFAULT 0,
ADD COLUMN IF NOT EXISTS it_score smallint DEFAULT 0,
ADD COLUMN IF NOT EXISTS classification_metadata jsonb DEFAULT NULL;