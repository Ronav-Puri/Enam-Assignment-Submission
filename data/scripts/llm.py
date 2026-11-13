"""One place for every AI call: tiers, fallback models, retries and timeouts."""
import time

from google import genai
from google.genai import types

from common import env

import hashlib

TIERS = {"lite": "GEMINI_MODEL_LITE", "flash": "GEMINI_MODEL_FLASH", "pro": "GEMINI_MODEL_PRO"}
RETRYABLE = {429, 500, 503, 504}          # rate-limited, overloaded, or slow: worth retrying
_client = None


def client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=env("GEMINI_API_KEY"),
                               http_options=types.HttpOptions(timeout=120_000))   # 120 s per call
    return _client


def models_for(tier):
    return [m.strip() for m in env(TIERS[tier]).split(",") if m.strip()]


EXHAUSTED = set()          # models that ran out of DAILY free quota during this run


def tier_exhausted(tier):
    return all(m in EXHAUSTED for m in models_for(tier))


def generate(tier, contents, config=None, retries_per_model=3):
    """Try each model in the tier in order.
    - 503/504/timeout (overloaded): short wait, retry, then fall back to the next model
    - 429 per-minute limit: wait as long as Google asks, then retry the SAME model
    - 429 per-day limit: give up on that model for the rest of this run
    Returns (response, model_used)."""
    last_error = None
    for model in models_for(tier):
        if model in EXHAUSTED:
            continue
        for attempt in range(retries_per_model):
            try:
                resp = client().models.generate_content(model=model, contents=contents, config=config)
                return resp, model
            except Exception as e:
                last_error = e
                code, msg = getattr(e, "code", None), str(e)
                print(f"  [llm] {model} try {attempt + 1} failed: {code or type(e).__name__}", flush=True)
                if code == 400:
                    raise
                if code == 429:
                    if "PerDay" in msg:
                        EXHAUSTED.add(model)
                        print(f"  [llm] {model} is out of today's free quota; skipping it", flush=True)
                        break
                    wait = re.search(r"retryDelay\W+(\d+)", msg)
                    time.sleep(min(int(wait.group(1)) + 1 if wait else 30, 65))
                    continue
                if code is not None and code not in RETRYABLE:
                    break
                time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"All models for tier '{tier}' failed. Last error: {last_error}")

def generate_json(tier, contents, schema, cache_key, config_extra=None):
    """Ask for an answer in a fixed JSON shape (a pydantic class). Answers are cached in
    the llm_cache table under cache_key, so the same question is never paid for twice.
    Returns (answer_object, model_used)."""
    from common import supabase_admin
    sb = supabase_admin()
    key = hashlib.sha256(f"{tier}|{schema.__name__}|{cache_key}".encode()).hexdigest()

    hit = sb.table("llm_cache").select("output, model").eq("key", key).execute().data
    if hit:
        return schema.model_validate(hit[0]["output"]), hit[0]["model"]

    config = types.GenerateContentConfig(
        response_mime_type="application/json", response_schema=schema, temperature=0,
        **(config_extra or {}))
    resp, model = generate(tier, contents, config)
    answer = resp.parsed if resp.parsed is not None else schema.model_validate_json(resp.text)

    sb.table("llm_cache").upsert({"key": key, "model": model, "output": answer.model_dump()}).execute()
    return answer, model