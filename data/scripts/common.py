"""Shared helpers for all backend scripts: read settings from .env, make a Supabase client."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]   # the finn/ folder
load_dotenv(ROOT / ".env")


def env(name: str) -> str:
    """Read a required setting from .env, or stop with a clear message."""
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing {name} in .env")
    return value


def supabase_admin():
    """Supabase client using the SECRET key. It bypasses privacy rules,
    so it must only ever be used in backend scripts, never in the app."""
    from supabase import create_client
    return create_client(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"))