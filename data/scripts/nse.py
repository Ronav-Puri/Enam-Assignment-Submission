"""Small NSE client: gets the cookies NSE requires and retries when it refuses."""
import time

import requests

BROWSER = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"),
    "Accept-Language": "en-US,en;q=0.9",
}


class NSE:
    BASE = "https://www.nseindia.com"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(BROWSER)
        self._warm_up()

    def _warm_up(self):
        self.session.get(self.BASE + "/", timeout=15)

    def get_json(self, path, params, symbol=""):
        for attempt in range(3):
            r = self.session.get(
                self.BASE + path, params=params, timeout=20,
                headers={"Accept": "application/json",
                         "Referer": f"{self.BASE}/get-quotes/equity?symbol={symbol}"},
            )
            if r.status_code in (401, 403):          # cookies expired: wait, refresh, retry
                time.sleep(2 * (attempt + 1))
                self._warm_up()
                continue
            r.raise_for_status()
            return r.json()
        raise RuntimeError(f"NSE refused {path} three times")

    def announcements(self, symbol, start, end):
        data = self.get_json(
            "/api/corporate-announcements",
            {"index": "equities", "symbol": symbol,
             "from_date": start.strftime("%d-%m-%Y"), "to_date": end.strftime("%d-%m-%Y")},
            symbol,
        )
        return data.get("data", []) if isinstance(data, dict) else data