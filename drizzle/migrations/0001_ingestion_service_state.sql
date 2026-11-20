CREATE TABLE public.ingestion_service_state (
  service_key text PRIMARY KEY,
  blocked_until timestamptz,
  failure_reason text,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ingestion_service_state TO service_role;
ALTER TABLE public.ingestion_service_state ENABLE ROW LEVEL SECURITY;