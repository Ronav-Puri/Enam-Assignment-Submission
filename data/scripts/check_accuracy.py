"""Accuracy check: compare Revenue and PAT our AI extracted from results PDFs
with screener.in's reported figures for the same quarter."""
import requests
from bs4 import BeautifulSoup

from common import supabase_admin
from nse import BROWSER


def screener_latest(symbol):
    """Latest quarter's (label, revenue, net profit) from screener, consolidated if available."""
    for path in (f"/company/{symbol}/consolidated/", f"/company/{symbol}/"):
        r = requests.get("https://www.screener.in" + path, headers=BROWSER, timeout=20)
        if r.status_code != 200:
            continue
        table = BeautifulSoup(r.text, "html.parser").select_one("#quarters table.data-table")
        if not table:
            continue
        heads = [th.get_text(strip=True) for th in table.select("thead th")][1:]
        rows = {}
        for tr in table.select("tbody tr"):
            tds = tr.find_all("td")
            if tds:
                label = tds[0].get_text(" ", strip=True).replace("+", "").strip()
                rows[label] = [td.get_text(strip=True).replace(",", "") for td in tds[1:]]

        def last(*names):
            for n in names:
                for k, v in rows.items():
                    if k.lower().startswith(n.lower()) and v and v[-1] not in ("", "-"):
                        return float(v[-1].replace("%", ""))
            return None

        if heads:
            return heads[-1], last("Sales", "Revenue"), last("Net Profit")
    return None


def diff(a, b):
    return None if a is None or not b else abs(a - b) / abs(b) * 100


def main():
    sb = supabase_admin()
    rows = (sb.table("announcements").select("symbol, published_at, extracted")
            .eq("category", "results").not_.is_("extracted", "null")
            .order("published_at", desc=True).execute().data)
    latest = {}
    for r in rows:                                   # newest results extraction per company
        if r["extracted"].get("type") == "results" and r["symbol"] not in latest:
            latest[r["symbol"]] = r["extracted"]

    print(f"{'symbol':<11} {'quarter':<10} {'rev ours':>10} {'screener':>10} {'Δ%':>6} {'pat ours':>9} {'screener':>9} {'Δ%':>6}")
    checked = within1 = within5 = 0
    for sym, ex in sorted(latest.items()):
        ref = screener_latest(sym)
        if not ref:
            continue
        q, s_rev, s_pat = ref
        rev, pat = ex["current"]["revenue"], ex["current"]["pat"]
        d_rev, d_pat = diff(rev, s_rev), diff(pat, s_pat)
        print(f"{sym:<11} {q:<10} {rev or 0:>10,.0f} {s_rev or 0:>10,.0f} {d_rev or 0:>6.1f} "
              f"{pat or 0:>9,.0f} {s_pat or 0:>9,.0f} {d_pat or 0:>6.1f}")
        for d in (d_rev, d_pat):
            if d is None:
                continue
            checked += 1
            within1 += d <= 1
            within5 += d <= 5
    print(f"\n{within1}/{checked} numbers within 1% of screener, {within5}/{checked} within 5%.")


if __name__ == "__main__":
    main()