"""Label every unlabelled announcement: category, importance (0-3), one-line summary.
Free keyword rules first; everything else goes to the 'lite' model, 20 notices per call."""
import hashlib
import json
from typing import Literal

from pydantic import BaseModel

from common import supabase_admin
from llm import generate_json
from taxonomy import CATEGORIES, DEFAULT_IMPORTANCE, rule_classify

BATCH = 20

PROMPT = """You triage Indian stock-exchange filings for a long-term equity investor.
For EACH filing below return:
- id: copied exactly
- category: one of {categories}
- importance (be strict; most filings are 0 or 1):
  3 = changes the investment case: quarterly results, acquisition/merger/demerger, CEO/MD/CFO change,
      credit rating DOWNGRADE, regulatory ban, plant shutdown, USFDA warning letter, fraud, default,
      large fund raise (QIP, rights issue).
  2 = worth reading today: order win with a stated value, capex plan, litigation or penalty with an amount,
      clarification of a negative news report, monthly sales/business update, rating upgrade.
  1 = minor: rating reaffirmed or withdrawn, dividend, small orders, disclosures with little content.
  0 = routine paperwork: intimations, scheduling notices, compliance filings, newspaper ads.
- summary: ONE plain sentence, max 20 words, with the concrete fact (names, numbers, dates).
  If the text lacks the key fact (e.g. no order value), say only what is known in fewer words. Never pad.
  Empty string if importance is 0.
Use only the text given. Do not guess.

Filings (JSON):
{filings}"""


class Label(BaseModel):
    id: str
    category: Literal[tuple(CATEGORIES)]
    importance: int
    summary: str


class Labels(BaseModel):
    labels: list[Label]


def main():
    sb = supabase_admin()
    names = {c["symbol"]: c["name"] for c in sb.table("companies").select("symbol, name").execute().data}
    rows = (sb.table("announcements").select("id, symbol, subject, body")
            .is_("category", "null").execute().data)
    print(f"{len(rows)} unlabelled notices")

    for_ai, by_rules = [], 0
    for r in rows:
        category = rule_classify(r["subject"], r["body"])
        if category:
            sb.table("announcements").update({
                "category": category, "importance": DEFAULT_IMPORTANCE[category],
                "classified_by": "rules"}).eq("id", r["id"]).execute()
            by_rules += 1
        else:
            for_ai.append(r)
    print(f"  {by_rules} labelled free by rules, {len(for_ai)} going to the AI")

    for i in range(0, len(for_ai), BATCH):
        batch = for_ai[i:i + BATCH]
        filings = [{"id": r["id"], "company": names.get(r["symbol"], r["symbol"]),
                    "subject": r["subject"], "text": (r["body"] or "")[:1200]} for r in batch]
        prompt = PROMPT.format(categories=", ".join(CATEGORIES), filings=json.dumps(filings, ensure_ascii=False))
        answer, model = generate_json("lite", prompt, Labels,
                                      cache_key=hashlib.sha256(prompt.encode()).hexdigest())
        wanted = {r["id"] for r in batch}
        for lab in answer.labels:
            if lab.id not in wanted:
                continue                                   # ignore anything the model invented
            sb.table("announcements").update({
                "category": lab.category,
                "importance": max(0, min(3, lab.importance)),
                "summary": lab.summary or None,
                "classified_by": model}).eq("id", lab.id).execute()
        print(f"  batch {i // BATCH + 1}: {len(answer.labels)} labelled by {model}")


if __name__ == "__main__":
    main()