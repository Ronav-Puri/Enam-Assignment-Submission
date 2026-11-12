"""Day-1 check: can we reach every source FINN depends on? Prints OK / FAIL for each."""
import datetime as dt

import requests

from common import env, supabase_admin

BROWSER = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"),
    "Accept-Language": "en-US,en;q=0.9",
}


def check(name, fn):
    try:
        print(f"[OK]   {name}: {fn()}")
    except Exception as e:
        print(f"[FAIL] {name}: {type(e).__name__}: {str(e)[:200]}")


def yahoo_prices():
    import yfinance as yf
    df = yf.download(["INFY.NS", "TCS.NS"], period="1mo", progress=False, auto_adjust=False)
    if df.empty:
        raise RuntimeError("no rows returned")
    return f"{len(df)} trading days, latest {df.index[-1].date()}"


def nse_announcements():
    s = requests.Session()
    s.headers.update(BROWSER)
    s.get("https://www.nseindia.com/", timeout=15)          # NSE needs cookies from the homepage first
    r = s.get(
        "https://www.nseindia.com/api/corporate-announcements",
        params={"index": "equities", "symbol": "INFY"},
        headers={"Accept": "application/json",
                 "Referer": "https://www.nseindia.com/get-quotes/equity?symbol=INFY"},
        timeout=15,
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        return "reachable, but 0 rows"
    return f"{len(rows)} notices; latest: {rows[0].get('an_dt')} | {rows[0].get('desc')}"


def bse_announcements():
    today = dt.date.today()
    start = today - dt.timedelta(days=30)
    r = requests.get(
        "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w",
        params={"pageno": 1, "strCat": -1, "strPrevDate": start.strftime("%Y%m%d"),
                "strScrip": "500209", "strSearch": "P", "strToDate": today.strftime("%Y%m%d"),
                "strType": "C", "subcategory": -1},
        headers={**BROWSER, "Accept": "application/json",
                 "Referer": "https://www.bseindia.com/", "Origin": "https://www.bseindia.com"},
        timeout=15,
    )
    r.raise_for_status()
    rows = r.json().get("Table", [])
    if not rows:
        return "reachable, but 0 rows in last 30 days"
    return f"{len(rows)} notices; latest: {rows[0].get('NEWS_DT')} | {rows[0].get('NEWSSUB')}"


def screener_documents():
    from bs4 import BeautifulSoup
    r = requests.get("https://www.screener.in/company/INFY/consolidated/", headers=BROWSER, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    reports = soup.select("#documents div.annual-reports a")
    concalls = soup.select("#documents div.concalls a")
    transcripts = [a for a in concalls if a.get_text(strip=True).lower() == "transcript"]
    latest = reports[0].get_text(" ", strip=True) if reports else "none"
    return f"{len(transcripts)} transcripts, {len(reports)} annual reports (latest: {latest})"


def gemini():
    from llm import generate
    used = []
    for tier in ("lite", "flash", "pro"):
        print(f"         trying tier '{tier}' ...", flush=True)
        _, model = generate(tier, "Reply with: ok")
        used.append(f"{tier} → {model}")
    return " | ".join(used)


def supabase_db():
    rows = supabase_admin().table("companies").select("symbol").execute().data
    return f"connected, {len(rows)} companies in database"


if __name__ == "__main__":
    check("Yahoo Finance prices", yahoo_prices)
    check("NSE announcements   ", nse_announcements)
    check("BSE announcements   ", bse_announcements)
    check("Screener documents  ", screener_documents)
    check("Gemini API          ", gemini)
    check("Supabase database   ", supabase_db)