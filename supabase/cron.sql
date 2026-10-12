-- Optional: schedule the reminder job from inside Supabase (pg_cron + pg_net).
-- Replace the URL and secret, then run in the SQL editor.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'diva-reminders',
  '*/30 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-DIVA-DOMAIN/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);
-- To remove: select cron.unschedule('diva-reminders');
