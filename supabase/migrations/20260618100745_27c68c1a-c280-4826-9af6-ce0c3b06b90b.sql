
-- 1. Add source-date + verification columns to news_entries
ALTER TABLE public.news_entries
  ADD COLUMN IF NOT EXISTS publication_date date,
  ADD COLUMN IF NOT EXISTS updated_date date,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'needs_review';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_entries_verification_status_check') THEN
    ALTER TABLE public.news_entries
      ADD CONSTRAINT news_entries_verification_status_check
      CHECK (verification_status IN (
        'verified','partially_verified','date_not_verified',
        'source_mismatch','outdated','broken_link','duplicate','needs_review'
      ));
  END IF;
END $$;

-- 2. Same on intelligence_items
ALTER TABLE public.intelligence_items
  ADD COLUMN IF NOT EXISTS publication_date date,
  ADD COLUMN IF NOT EXISTS updated_date date,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'needs_review';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intelligence_items_verification_status_check') THEN
    ALTER TABLE public.intelligence_items
      ADD CONSTRAINT intelligence_items_verification_status_check
      CHECK (verification_status IN (
        'verified','partially_verified','date_not_verified',
        'source_mismatch','outdated','broken_link','duplicate','needs_review'
      ));
  END IF;
END $$;

-- 3. Backfill existing rows: no confirmed source date → date_not_verified
UPDATE public.news_entries
  SET verification_status = 'date_not_verified'
  WHERE publication_date IS NULL AND verification_status = 'needs_review';

UPDATE public.intelligence_items
  SET verification_status = 'date_not_verified'
  WHERE publication_date IS NULL AND verification_status = 'needs_review';

-- 4. Rule-based reclassification of intelligence_items.department
--    Uses linked news_entry.content_type when present, otherwise keyword matching on headline+summary.
WITH src AS (
  SELECT
    i.id,
    lower(coalesce(i.headline,'') || ' ' || coalesce(i.summary,'') || ' ' || coalesce(i.impact,'')) AS text,
    n.content_type AS content_type
  FROM public.intelligence_items i
  LEFT JOIN public.news_entries n ON n.id = i.source_entry_id
),
classified AS (
  SELECT id,
    CASE
      -- IT
      WHEN content_type = 'technology_it_news'
        OR text ~ '(cve-|vulnerability|ransomware|patch tuesday|cybersecurity|cyberattack|malware|zero-day|phishing|microsoft|openai|anthropic|cloud security|kubernetes|software release|saas|gen ?ai)'
        THEN 'it'
      -- Finance
      WHEN content_type = 'finance_regulation'
        OR text ~ '(tva|impôt|fiscalit|tax reform|loi de finances|customs duty|droit de douane|exchange rate|forex|dirham|interest rate|taux directeur|bank al-maghrib|inflation|budget )'
        THEN 'finance'
      -- Commercial
      WHEN content_type = 'freight_market_update'
        OR text ~ '(freight rate|spot rate|contract rate|gri |general rate increase|surcharge|baf|caf|earnings|revenue|acquisition|merger|partnership|tender|rfp |market share)'
        THEN 'commercial'
      -- Compliance
      WHEN content_type IN ('regulatory_change','customs_update','compliance','sanctions_trade_restriction')
        OR text ~ '(customs|douane|circulaire|réglementation|regulation|sanction|embargo|hs code|tariff classification|compliance|import licence|export licence|certificate of origin|adii)'
        THEN 'compliance'
      -- Operations (default for freight disruptions)
      WHEN content_type IN ('port_disruption','strike_protest_manifestation','infrastructure','carrier_air_sea_road')
        OR text ~ '(port closure|port closed|booking suspension|suspend.*booking|route change|vessel delay|congestion|service interruption|equipment shortage|strike|grève|manifestation|blocage|sit-in|protest|terminal|berth|drayage|trucking|warehouse|chassis|container shortage|omission|blank sailing)'
        THEN 'operations'
      ELSE 'operations'
    END AS new_dept
  FROM src
)
UPDATE public.intelligence_items i
SET department = c.new_dept::intel_department
FROM classified c
WHERE c.id = i.id
  AND i.department::text <> c.new_dept;
