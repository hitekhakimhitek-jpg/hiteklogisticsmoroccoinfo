DO $$
DECLARE
  existing_command text;
  cron_secret text;
  project_url text;
  cohort integer;
BEGIN
  SELECT command INTO existing_command
  FROM cron.job
  WHERE command ILIKE '%functions/v1/%' AND command ILIKE '%Authorization%' AND command ILIKE '%Bearer%'
  ORDER BY jobid
  LIMIT 1;

  cron_secret := substring(existing_command FROM 'Bearer ([^"[:space:]]+)');
  project_url := substring(existing_command FROM '(https://[^/]+)');

  IF cron_secret IS NULL OR cron_secret = '' OR project_url IS NULL OR project_url = '' THEN
    RAISE EXCEPTION 'No authenticated function schedule is available to seed daily ingestion';
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'hitek-news-daily-batch-%';
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'hitek-hazards-daily';

  PERFORM cron.schedule(
    'hitek-hazards-daily',
    '0 20 * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{"force":true}'::jsonb);$job$,
      project_url || '/functions/v1/collect-hazards',
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || cron_secret)::text
    )
  );

  FOR cohort IN 0..7 LOOP
    PERFORM cron.schedule(
      'hitek-news-daily-batch-' || cohort,
      format('%s 20 * * *', 5 + cohort * 6),
      format(
        $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);$job$,
        project_url || '/functions/v1/fetch-news',
        jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || cron_secret)::text,
        jsonb_build_object('batch', cohort, 'batchCount', 8, 'force', true)::text
      )
    );
  END LOOP;
END $$;