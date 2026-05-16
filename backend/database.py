# backend/database.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_recent_logs(user_id: str, limit: int = 5) -> list:
    """Fetch last N login logs for a user — used to compute features."""
    result = supabase.table("login_logs") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("timestamp", desc=True) \
        .limit(limit) \
        .execute()
    return result.data or []


def insert_login_log(data: dict) -> dict:
    """Insert new login event. Returns the row with its generated id."""
    result = supabase.table("login_logs").insert(data).execute()
    return result.data[0] if result.data else {}


def update_risk_score(log_id: str, risk_score: float):
    """Update risk_score on a login_log row after ML responds."""
    supabase.table("login_logs") \
        .update({"risk_score": risk_score}) \
        .eq("id", log_id) \
        .execute()


def insert_alert(data: dict):
    """Insert alert row — called by SOAR when score >= 0.5."""
    supabase.table("alerts").insert(data).execute()


def get_user_by_clerk_id(clerk_user_id: str):
    """Look up user by Clerk ID. Returns None if not found."""
    result = supabase.table("users") \
        .select("*") \
        .eq("clerk_user_id", clerk_user_id) \
        .limit(1) \
        .execute()
    return result.data[0] if result.data else None


def insert_user(clerk_user_id: str, email: str) -> dict:
    """Create user row on first signup."""
    result = supabase.table("users") \
        .insert({"clerk_user_id": clerk_user_id, "email": email}) \
        .execute()
    return result.data[0] if result.data else {}