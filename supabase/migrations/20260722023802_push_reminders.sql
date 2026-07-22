-- Web Push reminders backend.
--
-- push_subscriptions : one row per browser/device push endpoint, owned by
--   the signed-in user. The send-reminders Edge Function reads these with
--   the service role to deliver notifications.
-- reminder_log       : dedupe ledger so each reminder occurrence fires once,
--   even though the cron window overlaps between ticks.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  -- IANA tz (e.g. America/Indiana/Indianapolis); tasks/events store local
  -- wall-clock times, so the scheduler needs this to know when "now" is.
  timezone text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "own subscriptions - select"
  on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "own subscriptions - insert"
  on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "own subscriptions - update"
  on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscriptions - delete"
  on public.push_subscriptions for delete using (auth.uid() = user_id);

revoke all on public.push_subscriptions from anon;

create table if not exists public.reminder_log (
  fire_key text primary key,
  user_id uuid not null,
  sent_at timestamptz not null default now()
);

-- RLS on with no policies: only the service role (the Edge Function) touches it.
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;

-- ---- scheduling: invoke the Edge Function every 5 minutes ----
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: re-running the migration replaces the job of the same name.
select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://cbuqgfoapcxrnzshjdce.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
