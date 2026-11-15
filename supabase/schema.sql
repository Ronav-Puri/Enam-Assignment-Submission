-- =========================================================
-- FINN database schema (run once in the Supabase SQL editor)
-- Public market data (companies, prices, announcements) is readable by any
-- logged-in user. Personal data (holdings, persons, stints, preferences) is visible ONLY
-- to the investor who owns it, enforced by the database itself (Row Level Security).
-- =========================================================

create extension if not exists pg_trgm;   -- fuzzy name matching ("R. Kumar" ~ "Rajesh Kumar")

-- ---------- Public market data ----------

-- One row per listed company we track
create table if not exists companies (
  symbol      text primary key,              -- NSE symbol, e.g. INFY
  name        text not null,
  sector      text,
  size        text,                          -- large / mid / small
  bse_code    text,                          -- BSE scrip code, e.g. 500209
  created_at  timestamptz default now()
);

-- End-of-day price and volume, one row per company per trading day
create table if not exists prices (
  symbol  text references companies(symbol) on delete cascade,
  date    date,
  open    numeric, high numeric, low numeric, close numeric,
  volume  bigint,
  primary key (symbol, date)
);

-- Every notice a company files with NSE, plus what the AI made of it
create table if not exists announcements (
  id             text primary key,           -- exchange + exchange's own id
  symbol         text references companies(symbol) on delete cascade,
  exchange       text not null,              -- NSE
  published_at   timestamptz not null,
  subject        text,
  body           text,
  attachment_url text,                       -- link to the PDF
  category       text,                       -- results, management_change, M&A ...
  importance     smallint,                   -- 0 = routine ... 3 = must see
  summary        text,                       -- one-line summary
  extracted      jsonb,                      -- structured data (results numbers, people)
  classified_by  text,                       -- 'rules' or the model name
  created_at     timestamptz default now()
);
create index if not exists announcements_symbol_time on announcements (symbol, published_at desc);
create index if not exists announcements_time on announcements (published_at desc);

-- Saved AI answers so the same question is never paid for twice
create table if not exists llm_cache (
  key         text primary key,              -- hash of (tier + schema + input)
  model       text,
  output      jsonb,
  created_at  timestamptz default now()
);

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

-- Saved research reports (public-market analysis, not personal data): any logged-in user can read;
-- only the server (secret key) writes.
create table if not exists research (
  symbol        text primary key,
  name          text,
  generated_at  timestamptz default now(),
  model         text,
  report        jsonb not null
);

-- Every NSE-listed equity, for type-ahead search
create table if not exists symbols (
  symbol  text primary key,
  name    text not null
);
create index if not exists symbols_name_trgm on symbols using gin (name gin_trgm_ops);

-- ---------- Private, per-investor data ----------

-- Which companies this investor holds or is researching
create table if not exists holdings (
  owner_id  uuid not null references auth.users(id) on delete cascade,
  symbol    text not null references companies(symbol) on delete cascade,
  list      text not null default 'portfolio' check (list in ('portfolio', 'research')),
  primary key (owner_id, symbol)
);

-- People: the investor themself, their contacts, and executives seen in filings
create table if not exists persons (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  full_name       text not null,
  headline        text,
  city            text,
  kind            text not null check (kind in ('self', 'contact', 'public_figure')),
  relationship    text,                      -- how the investor knows them
  closeness       smallint check (closeness between 1 and 5),
  last_contacted  date,
  expertise       text[] default '{}',
  source          text not null default 'synthetic',   -- synthetic / user_upload / public_profile
  created_at      timestamptz default now()
);
create index if not exists persons_name_trgm on persons using gin (full_name gin_trgm_ops);

-- Career and education history: one row per job or degree
create table if not exists stints (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  person_id   uuid not null references persons(id) on delete cascade,
  org_name    text not null,
  symbol      text,                          -- NSE symbol if the org is listed
  kind        text not null check (kind in ('work', 'education')),
  title       text,
  start_year  int,
  end_year    int                            -- null = still there
);
create index if not exists stints_person on stints (person_id);
create index if not exists stints_symbol on stints (symbol);

-- Each investor's own alert rules
create table if not exists preferences (
  owner_id          uuid primary key references auth.users(id) on delete cascade,
  price_move_pct    numeric not null default 4,
  volume_multiple   numeric not null default 2,
  alert_categories  text[]  not null default '{results,M&A,management_change,litigation,fund_raise}',
  updated_at        timestamptz default now()
);

-- ---------- Row Level Security (privacy rules) ----------

alter table companies     enable row level security;
alter table prices        enable row level security;
alter table announcements enable row level security;
alter table llm_cache     enable row level security;   -- no policy = only the backend can touch it
alter table research      enable row level security;
alter table symbols       enable row level security;
alter table holdings      enable row level security;
alter table persons       enable row level security;
alter table stints        enable row level security;
alter table preferences   enable row level security;

create policy "logged-in users read companies"     on companies     for select to authenticated using (true);
create policy "logged-in users read prices"        on prices        for select to authenticated using (true);
create policy "logged-in users read announcements" on announcements for select to authenticated using (true);
create policy "logged-in users read research"      on research      for select to authenticated using (true);
create policy "logged-in users read symbols"       on symbols       for select to authenticated using (true);

create policy "own holdings" on holdings for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own persons" on persons for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own stints" on stints for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own preferences" on preferences for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
