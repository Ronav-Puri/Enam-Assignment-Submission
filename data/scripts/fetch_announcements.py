"""Fetch corporate announcements from NSE for every company in the database.

Usage:  python data/scripts/fetch_announcements.py                 (last 30 days, all companies)
        python data/scripts/fetch_announcements.py --days 2        (daily top-up)
        python data/scripts/fetch_announcements.py --symbols INFY,TCS
"""
import argparse
import datetime as dt
import hashlib
import time

from common import supabase_admin
from nse import NSE

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))


def parse_time(row):
    for key, fmt in (("sort_date", "%Y-%m-%d %H:%M:%S"), ("an_dt", "%d-%b-%Y %H:%M:%S")):
        value = row.get(key)
        if value:
            try:
                return dt.datetime.strptime(value, fmt).replace(tzinfo=IST)
            except ValueError:
                pass
    return None


def to_row(symbol, r):
    published = parse_time(r)
    if not published:
        return None
    seq = r.get("seq_id") or hashlib.sha1(
        f"{symbol}|{r.get('an_dt')}|{r.get('desc')}".encode()).hexdigest()[:16]
    return {
        "id": f"NSE:{seq}",
        "symbol": symbol,
        "exchange": "NSE",
        "published_at": published.isoformat(),
        "subject": r.get("desc"),
        "body": r.get("attchmntText"),
        "attachment_url": r.get("attchmntFile") or None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--symbols", help="comma-separated; default = all companies in the database")
    args = ap.parse_args()

    sb = supabase_admin()
    symbols = (args.symbols.split(",") if args.symbols
               else [r["symbol"] for r in sb.table("companies").select("symbol").execute().data])

    nse = NSE()
    end = dt.date.today()
    start = end - dt.timedelta(days=args.days)
    total, shown_sample = 0, False

    for sym in symbols:
        try:
            raw = nse.announcements(sym, start, end)
        except Exception as e:
            print(f"  {sym:<11} FAILED: {e}")
            continue
        if raw and not shown_sample:
            print("  (fields NSE sends:", sorted(raw[0].keys()), ")")
            shown_sample = True

        rows = [x for x in (to_row(sym, r) for r in raw) if x]
        rows = list({r["id"]: r for r in rows}.values())           # drop duplicates
        if rows:
            # ignore_duplicates: never overwrite a notice the AI has already labelled
            sb.table("announcements").upsert(rows, on_conflict="id", ignore_duplicates=True).execute()
        print(f"  {sym:<11} {len(rows):>4} notices")
        total += len(rows)
        time.sleep(1)                                               # be polite to NSE

    print(f"Done: {total} notices from {start} to {end}.")


if __name__ == "__main__":
    main()