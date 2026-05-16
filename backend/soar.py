# backend/soar.py
import os
import httpx
from database import insert_alert
from dotenv import load_dotenv

load_dotenv()

CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")


async def run_soar(user_id, clerk_user_id, ip_address, risk_score, reason):
    """
    Decides what action to take based on risk score.
    score < 0.5   → do nothing
    score 0.5–0.89 → create alert only
    score >= 0.9  → disable Clerk user + create alert
    """
    if risk_score < 0.5:
        print(f"[soar] score={risk_score} → normal, no action")
        return

    if risk_score >= 0.9:
        action_taken = await _disable_clerk_user(clerk_user_id)
        print(f"[soar] score={risk_score} → AUTO BLOCK: {action_taken}")
    else:
        action_taken = "alert_only"
        print(f"[soar] score={risk_score} → alert created")

    insert_alert({
        "user_id":      user_id,
        "risk_score":   risk_score,
        "reason":       reason,
        "action_taken": action_taken,
        "resolved":     False
    })


async def _disable_clerk_user(clerk_user_id: str) -> str:
    """Calls Clerk API to ban the user immediately."""
    if not CLERK_SECRET_KEY:
        print("[soar] No CLERK_SECRET_KEY — skipping ban")
        return "clerk_ban_skipped_no_key"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.clerk.com/v1/users/{clerk_user_id}/ban",
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
                timeout=10.0
            )
        return "user_disabled" if resp.status_code == 200 \
               else f"clerk_ban_failed_{resp.status_code}"
    except Exception as e:
        print(f"[soar] error: {e}")
        return "clerk_ban_error"
    