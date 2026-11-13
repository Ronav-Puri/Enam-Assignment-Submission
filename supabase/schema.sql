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