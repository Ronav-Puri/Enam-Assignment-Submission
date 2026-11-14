-- For every company and day: % price change vs the previous day, and today's volume
-- divided by the average of the previous 20 trading days. The app filters this with the
-- investor's own thresholds (e.g. |change| > 4% or volume_ratio > 2).
create or replace view price_signals with (security_invoker = true) as
select
  symbol,
  date,
  close,
  volume,
  round(100.0 * (close / nullif(lag(close) over w, 0) - 1), 2) as pct_change,
  round(volume::numeric / nullif(avg(volume) over (
          partition by symbol order by date rows between 20 preceding and 1 preceding), 0), 2) as volume_ratio
from prices
window w as (partition by symbol order by date);

-- Each investor's own alert rules (private to them)
create table if not exists preferences (
  owner_id          uuid primary key references auth.users(id) on delete cascade,
  price_move_pct    numeric not null default 4,
  volume_multiple   numeric not null default 2,
  alert_categories  text[]  not null default '{results,M&A,management_change,litigation,fund_raise}',
  updated_at        timestamptz default now()
);
alter table preferences enable row level security;
create policy "own preferences" on preferences for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

  -- Saved research reports (public-market analysis, not personal data): any logged-in user can read;
-- only the server (secret key) writes.
create table if not exists research (
  symbol        text primary key,
  name          text,
  generated_at  timestamptz default now(),
  model         text,
  report        jsonb not null
);
alter table research enable row level security;
create policy "logged-in users read research" on research for select to authenticated using (true);