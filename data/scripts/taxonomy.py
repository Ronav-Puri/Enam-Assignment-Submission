"""Announcement categories (from ENAM's reference document) and the free keyword rules."""

CATEGORIES = [
    "results", "M&A", "fund_raise", "management_change", "litigation", "insider_trading",
    "earnings_call", "investor_meetings", "credit_rating", "dividend", "bonus_split", "capex",
    "press_release", "postal_ballot", "agm_egm", "pledging", "unclassified",
]

# 3 = must see, 2 = worth reading today, 1 = minor, 0 = routine (collapsed in the app)
DEFAULT_IMPORTANCE = {
    "results": 3, "M&A": 3, "management_change": 3, "litigation": 2, "fund_raise": 2,
    "capex": 2, "pledging": 2, "credit_rating": 1, "insider_trading": 1, "dividend": 1,
    "bonus_split": 1, "earnings_call": 1, "press_release": 1, "investor_meetings": 0,
    "postal_ballot": 0, "agm_egm": 0, "unclassified": 0,
}

# Only subjects whose meaning is unambiguous. Vague ones ("General Updates",
# "Outcome of Board Meeting", "Updates", "Appointment") go to the AI instead.
SUBJECT_RULES = [
    (("financial result",), "results"),
    (("change in management", "change in director", "change in key managerial", "cessation"),
     "management_change"),
    (("trading window", "newspaper publication", "loss of share", "duplicate share", "esop", "esos",
      "allotment of securities", "compliance certificate", "certificate under", "shareholding pattern",
      "investor complaints"), "unclassified"),
    (("postal ballot",), "postal_ballot"),
    (("shareholders meeting", "general meeting"), "agm_egm"),
]


def rule_classify(subject, body):
    """Return a category if a free rule is certain, else None (= ask the AI)."""
    s, b = (subject or "").lower(), (body or "").lower()
    if "investor meet" in s or "con. call" in s:
        is_call_material = any(w in b for w in ("transcript", "audio recording", "recording of", "audio/video"))
        return "earnings_call" if is_call_material else "investor_meetings"
    for keywords, category in SUBJECT_RULES:
        if any(k in s for k in keywords):
            return category
    return None