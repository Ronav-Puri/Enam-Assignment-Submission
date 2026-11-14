"""Load every NSE-listed equity (symbol + name) so the Research box can suggest companies as you type."""
import csv
import io

from common import supabase_admin
from nse import NSE


def main():
    nse = NSE()
    r = nse.session.get("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv", timeout=30)
    r.raise_for_status()
    rows = list(csv.reader(io.StringIO(r.text)))[1:]          # skip the header
    data = [{"symbol": row[0].strip(), "name": row[1].strip()}
            for row in rows if len(row) > 1 and row[0].strip()]
    sb = supabase_admin()
    for i in range(0, len(data), 1000):
        sb.table("symbols").upsert(data[i:i + 1000]).execute()
    print(f"Loaded {len(data)} NSE symbols")


if __name__ == "__main__":
    main()