"""One place for every AI call: tiers, fallback models, retries and timeouts."""
import time

from google import genai
from google.genai import types

from common import env

TIERS = {"lite": "GEMINI_MODEL_LITE", "flash": "GEMINI_MODEL_FLASH", "pro": "GEMINI_MODEL_PRO"}
RETRYABLE = {429, 500, 503, 504}          # rate-limited, overloaded, or slow: worth retrying
_client = None


def client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=env("GEMINI_API_KEY"),
                               http_options=types.HttpOptions(timeout=60_000))   # 60 s per call
    return _client


def models_for(tier):
    return [m.strip() for m in env(TIERS[tier]).split(",") if m.strip()]


def generate(tier, contents, config=None, retries_per_model=2):
    """Try each model in the tier in order. Retry briefly on overload, then fall back.
    Returns (response, model_used) so we can record which model produced each answer."""
    last_error = None
    for model in models_for(tier):
        for attempt in range(retries_per_model):
            try:
                resp = client().models.generate_content(model=model, contents=contents, config=config)
                return resp, model
            except Exception as e:
                last_error = e
                code = getattr(e, "code", None)
                print(f"  [llm] {model} try {attempt + 1} failed: {code or type(e).__name__}", flush=True)
                if code == 400:                      # our request is wrong: no point trying others
                    raise
                if code is not None and code not in RETRYABLE:
                    break                            # e.g. 404 retired model: go to next model
                time.sleep(2 ** attempt)             # overloaded or timed out: wait 1 s, 2 s ...
    raise RuntimeError(f"All models for tier '{tier}' failed. Last error: {last_error}")