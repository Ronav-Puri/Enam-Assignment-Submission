"""Deep extraction for the filings that matter most, reading the actual PDF with the 'flash' model.
- results           -> Revenue, EBITDA, PBT, PAT: this quarter vs last quarter (QoQ) vs a year ago (YoY)
- management_change -> who joined/left, which role, and the background the filing gives
The model only COPIES facts; arithmetic and importance scoring are done here in code.

Usage:  python data/scripts/extract_details.py --limit 3   (try a few first)
        python data/scripts/extract_details.py             (everything not yet extracted)
        python data/scripts/extract_details.py --redo      (re-run all; cached answers are free)
"""
import argparse
import time
from typing import Literal

import requests
from google.genai import types
from pydantic import BaseModel

from common import ROOT, supabase_admin
from io import BytesIO
from pypdf import PdfReader, PdfWriter
from llm import client, generate_json, tier_exhausted
from nse import BROWSER

CACHE = ROOT / "data" / "cache" / "pdfs"
FINANCIAL_SECTORS = {"Banking", "NBFC"}            # EBITDA is meaningless for lenders
INLINE_LIMIT = 19_000_000                          # bigger PDFs are uploaded to Gemini first
PAGES = {"results": 15, "management_change": 8}   # the facts we need are always near the front


# ---------- shapes we ask the model to fill ----------

class Period(BaseModel):
    label: str
    revenue: float | None
    other_income: float | None
    finance_costs: float | None
    depreciation: float | None
    exceptional_items: float | None
    pbt: float | None
    pat: float | None


class Results(BaseModel):
    is_results: bool
    basis: Literal["consolidated", "standalone"]
    unit: str
    current: Period
    previous_quarter: Period
    year_ago_quarter: Period
    page: int | None


class Change(BaseModel):
    person_name: str
    role: str
    change: Literal["appointed", "resigned", "retired", "reappointed", "ceased", "redesignated", "other"]
    effective_date: str | None
    background: str | None
    previous_employers: list[str]
    education: list[str]


class MgmtChanges(BaseModel):
    changes: list[Change]


RESULTS_PROMPT = """This PDF is an Indian listed company's stock-exchange filing.
Find the quarterly statement of profit and loss. Prefer CONSOLIDATED figures; use standalone only if
there are no consolidated figures. Read three quarter columns: the latest quarter, the immediately
preceding quarter, and the same quarter of the previous year.
Copy each number EXACTLY as printed, in the unit stated in the table header. Do not compute anything.
revenue = "Revenue from operations" (for banks/NBFCs use "Total income").
exceptional_items = the "Exceptional items" line if present (gain positive, loss negative), else null.
page = the PDF page number where that table is.
If this document has no quarterly results table, set is_results=false and fill the rest with nulls/empty."""

MGMT_PROMPT = """This PDF is an Indian listed company's stock-exchange filing about a change in
directors or management. List every person who is appointed, resigns, retires, ceases or is
re-designated, with their exact role title as written.
background = their career summary AS STATED in the filing (max 60 words), else null.
previous_employers and education: only what the filing states. Do not use outside knowledge."""

TOP_ROLES = ("chief executive", "ceo", "managing director", "chief financial", "cfo", "chairman",
             "chairperson", "whole-time director", "whole time director", "executive director",
             "chief operating", "coo")
SENIOR_ROLES = ("group head", "business head", "president", "chief")


# ---------- helpers ----------

def download_pdf(ann):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{ann['id'].replace(':', '_')}.pdf"
    if not path.exists():
        r = requests.get(ann["attachment_url"], headers=BROWSER, timeout=60)
        r.raise_for_status()
        path.write_bytes(r.content)
    data = path.read_bytes()
    if not data.startswith(b"%PDF"):
        raise ValueError("attachment is not a PDF")
    return path, data

def first_pages(data, n):
    """Keep only the first n pages: the results table / appointment details are near the front."""
    try:
        reader = PdfReader(BytesIO(data))
        if len(reader.pages) <= n:
            return data
        writer = PdfWriter()
        for page in reader.pages[:n]:
            writer.add_page(page)
        buf = BytesIO()
        writer.write(buf)
        return buf.getvalue()
    except Exception:
        return data                                    # unreadable/encrypted: send as is


def pdf_part(path, data):
    """Small PDFs are sent inside the request; big ones are uploaded to Gemini's file store first."""
    if len(data) <= INLINE_LIMIT:
        return types.Part.from_bytes(data=data, mime_type="application/pdf")
    return client().files.upload(file=str(path), config={"mime_type": "application/pdf"})


def to_crore(value, unit):
    if value is None:
        return None
    u = unit.lower()
    if "lakh" in u or "lac" in u:
        return value / 100
    if "million" in u or "mn" in u:
        return value / 10
    if "billion" in u or "bn" in u:
        return value * 100
    return value                                          # already in crore


def pct(new, old):
    if new is None or old in (None, 0):
        return None
    return round(100 * (new - old) / abs(old), 1)


def headline(period, unit, is_financial):
    rev, pbt, pat, exc = (to_crore(getattr(period, k), unit)
                          for k in ("revenue", "pbt", "pat", "exceptional_items"))
    ebitda = None
    if not is_financial and None not in (period.pbt, period.finance_costs, period.depreciation):
        # operating EBITDA = PBT + interest + depreciation - other income - exceptional items
        ebitda = to_crore(period.pbt + period.finance_costs + period.depreciation
                          - (period.other_income or 0) - (period.exceptional_items or 0), unit)
    return {"label": period.label, "revenue": rev, "ebitda": ebitda, "pbt": pbt, "pat": pat,
            "exceptional_items": exc,
            "ebitda_margin": round(100 * ebitda / rev, 1) if ebitda is not None and rev else None}


def change_importance(c):
    """Importance from the job title, by fixed rules (predictable and explainable)."""
    role = c.role.lower()
    if c.change not in ("appointed", "resigned", "retired", "ceased"):
        return 1                                          # re-appointments / re-designations
    if "independent" in role or "vice president" in role:
        return 1
    if any(k in role for k in TOP_ROLES):
        if "non-executive" in role and "chair" not in role:
            return 1
        return 3
    if any(k in role for k in SENIOR_ROLES):
        return 2
    return 1


def process_results(ann, part, is_financial):
    r, model = generate_json("flash", [part, RESULTS_PROMPT], Results, cache_key=f"results-v2:{ann['id']}")
    if not r.is_results:
        return {"skipped": "no results table in this document"}, 1, None, model
    cur, prev, yago = (headline(p, r.unit, is_financial)
                       for p in (r.current, r.previous_quarter, r.year_ago_quarter))
    growth = {m: {"qoq": pct(cur[m], prev[m]), "yoy": pct(cur[m], yago[m])}
              for m in ("revenue", "ebitda", "pbt", "pat")}
    extracted = {"type": "results", "basis": r.basis, "unit": "₹ crore", "page": r.page,
                 "current": cur, "previous_quarter": prev, "year_ago_quarter": yago, "growth": growth}

    def fmt(m):
        g = growth[m]["yoy"]
        name = "Revenue" if m == "revenue" else m.upper()
        return f"{name} ₹{cur[m]:,.0f} cr" + (f" ({g:+.1f}% YoY)" if g is not None else "")

    summary = f"{cur['label']}: " + ", ".join(fmt(m) for m in ("revenue", "pat") if cur[m] is not None)
    if cur["exceptional_items"]:
        kind = "gain" if cur["exceptional_items"] > 0 else "loss"
        summary += f"; includes one-off {kind} of ₹{abs(cur['exceptional_items']):,.0f} cr"
    return extracted, 3, summary, model


def process_mgmt(ann, part):
    r, model = generate_json("flash", [part, MGMT_PROMPT], MgmtChanges, cache_key=ann["id"])
    if not r.changes:
        return {"type": "management_change", "changes": []}, 1, None, model
    scored = sorted(r.changes, key=change_importance, reverse=True)
    top = scored[0]
    changes = [{**c.model_dump(), "importance": change_importance(c)} for c in r.changes]
    summary = f"{top.person_name} {top.change} as {top.role}"
    return {"type": "management_change", "changes": changes}, change_importance(top), summary, model


# ---------- main ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only process this many (for testing)")
    ap.add_argument("--redo", action="store_true", help="re-process filings already extracted")
    args = ap.parse_args()

    sb = supabase_admin()
    sectors = {c["symbol"]: c["sector"] for c in sb.table("companies").select("symbol, sector").execute().data}
    q = (sb.table("announcements").select("id, symbol, category, subject, attachment_url")
         .in_("category", ["results", "management_change"]).not_.is_("attachment_url", "null"))
    if not args.redo:
        q = q.is_("extracted", "null")
    todo = q.order("published_at", desc=True).execute().data
    if args.limit:
        todo = todo[:args.limit]
    print(f"{len(todo)} filings to read")

    for ann in todo:
        try:
            path, data = download_pdf(ann)
            part = pdf_part(path, first_pages(data, PAGES[ann["category"]]))
            if ann["category"] == "results":
                extracted, importance, summary, model = process_results(
                    ann, part, sectors.get(ann["symbol"]) in FINANCIAL_SECTORS)
            else:
                extracted, importance, summary, model = process_mgmt(ann, part)
            update = {"extracted": extracted, "importance": importance}
            if summary:
                update["summary"] = summary
            sb.table("announcements").update(update).eq("id", ann["id"]).execute()
            print(f"  {ann['symbol']:<11} {ann['category']:<18} imp={importance} {model:<18} "
                  f"{summary or extracted.get('skipped')}")
        except Exception as e:
            if "All models" in str(e):
                # temporary (quota/overload): leave it unprocessed so the next run retries it
                print(f"  {ann['symbol']:<11} {ann['category']:<18} postponed (quota)")
                if tier_exhausted("flash"):
                    print("Daily free quota used up. Run again after 1:30 pm IST.")
                    break
            else:
                sb.table("announcements").update({"extracted": {"skipped": str(e)[:200]}}).eq("id", ann["id"]).execute()
                print(f"  {ann['symbol']:<11} {ann['category']:<18} FAILED: {str(e)[:120]}")
        time.sleep(4)                                  # stay under free-tier rate limits


if __name__ == "__main__":
    main()