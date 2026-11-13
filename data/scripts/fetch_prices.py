"""Download end-of-day prices for every company in the database and save them.

Usage:  python data/scripts/fetch_prices.py            (last 1 year)
        python data/scripts/fetch_prices.py --period 5d (daily top-up)
"""
import argparse

import pandas as pd
import yfinance as yf

from common import supabase_admin


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", default="1y", help="how far back: 5d, 1mo, 1y ...")
    args = ap.parse_args()

    sb = supabase_admin()
    symbols = [r["symbol"] for r in sb.table("companies").select("symbol").execute().data]

    df = yf.download([f"{s}.NS" for s in symbols], period=args.period, group_by="ticker",
                     auto_adjust=False, progress=False, threads=True)
    tickers_found = set(df.columns.get_level_values(0))

    rows = []
    for s in symbols:
        t = f"{s}.NS"
        if t not in tickers_found:
            print(f"  no data for {s}")
            continue
        for date, r in df[t].dropna(subset=["Close"]).iterrows():
            rows.append({
                "symbol": s,
                "date": date.date().isoformat(),
                "open": float(r["Open"]), "high": float(r["High"]),
                "low": float(r["Low"]), "close": float(r["Close"]),
                "volume": None if pd.isna(r["Volume"]) else int(r["Volume"]),
            })

    for i in range(0, len(rows), 1000):                 # send in batches of 1000
        sb.table("prices").upsert(rows[i:i + 1000]).execute()
    print(f"Saved {len(rows)} price rows for {len(symbols)} companies.")


if __name__ == "__main__":
    main()