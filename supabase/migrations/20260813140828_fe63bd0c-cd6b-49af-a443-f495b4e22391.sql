DO $$
DECLARE
  existing_command text;
  cron_secret text;
  project_url text;
BEGIN
  SELECT command INTO existing_command
  FROM cron.job
  WHERE command ILIKE '%functions/v1/%' AND command ILIKE '%Authorization%' AND command ILIKE '%Bearer%'
  ORDER BY jobid
  LIMIT 1;
  cron_secret := substring(existing_command FROM 'Bearer ([^"[:space:]]+)');
  project_url := substring(existing_command FROM '(https://[^/]+)');
  PERFORM net.http_post(
    url := project_url || '/functions/v1/fetch-news',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || cron_secret),
    body := '{"sources":["JOC"],"force":true}'::jsonb
  );
END $$;