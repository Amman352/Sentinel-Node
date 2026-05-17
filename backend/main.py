# backend/main.py
import os
import httpx
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import (
    get_user_by_clerk_id, insert_user,
    insert_login_log, update_risk_score,
    get_recent_logs, supabase
)
from soar import run_soar

load_dotenv()

ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://localhost:8000")

app = FastAPI(title="SentinelNode Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/ingest-log")
async def ingest_log(request: Request):
    try:
        body = await request.json()
    except Exception:
        return {"status": "error", "message": "invalid JSON"}

    event_type = body.get("type", "")
    print(f"[ingest] Received event: {event_type}")

    if event_type not in ("session.created", "user.created"):
        return {"status": "ignored", "event": event_type}

    data = body.get("data", {})
    clerk_user_id = (
        data.get("user_id") or
        data.get("id") or
        "test_user"
    )
    print(f"[ingest] clerk_user_id={clerk_user_id}")

    if event_type == "user.created":
        emails = data.get("email_addresses", [])
        email = emails[0].get("email_address", "") if emails else ""
        if clerk_user_id != "test_user":
            if not get_user_by_clerk_id(clerk_user_id):
                insert_user(clerk_user_id, email)
        return {"status": "user_created"}

    # session.created — full pipeline
    ip_address = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or "unknown"
    )
    device = request.headers.get("user-agent", "unknown")[:200]
    login_hour = datetime.now(timezone.utc).hour

    user = get_user_by_clerk_id(clerk_user_id)
    if not user:
        user = insert_user(clerk_user_id, "")
    user_id = user["id"]

    recent = get_recent_logs(user_id, limit=5)
    past_ips = {log["ip_address"] for log in recent if log.get("ip_address")}
    past_devices = {log["device"] for log in recent if log.get("device")}

    ip_changed = 1 if (past_ips and ip_address not in past_ips) else 0
    new_device  = 1 if (past_devices and device not in past_devices) else 0
    attempts_last_hour = len(recent) + 1
    location_changed = 0

    log_row = insert_login_log({
        "user_id":            user_id,
        "ip_address":         ip_address,
        "device":             device,
        "login_hour":         login_hour,
        "ip_changed":         bool(ip_changed),
        "new_device":         bool(new_device),
        "location_changed":   False,
        "attempts_last_hour": attempts_last_hour,
    })
    log_id = log_row.get("id")

    risk_score = 0.1
    verdict = "normal"
    try:
        async with httpx.AsyncClient() as client:
            ml_resp = await client.post(
                f"{ML_SERVICE_URL}/predict",
                json={
                    "login_hour":         login_hour,
                    "ip_changed":         ip_changed,
                    "attempts_last_hour": attempts_last_hour,
                    "location_changed":   location_changed,
                    "new_device":         new_device,
                },
                timeout=5.0
            )
        ml_data = ml_resp.json()
        risk_score = ml_data.get("risk_score", 0.1)
        verdict    = ml_data.get("verdict", "normal")
        print(f"[ingest] score={risk_score} verdict={verdict}")
    except Exception as e:
        print(f"[ingest] ML unreachable: {e}")

    if log_id:
        update_risk_score(log_id, risk_score)

    reason = (f"score={risk_score}, ip_changed={ip_changed}, "
              f"new_device={new_device}, attempts={attempts_last_hour}, "
              f"hour={login_hour}")
    await run_soar(user_id, clerk_user_id, ip_address, risk_score, reason)

    return {"status": "processed", "risk_score": risk_score, "verdict": verdict}


@app.get("/api/logs")
def get_logs(limit: int = 20):
    """Returns recent login logs for the dashboard."""
    result = supabase.table("login_logs") \
        .select("*").order("timestamp", desc=True).limit(limit).execute()
    return {"logs": result.data or []}


@app.get("/api/alerts")
def get_alerts(limit: int = 10):
    """Returns unresolved alerts for the dashboard."""
    result = supabase.table("alerts") \
        .select("*").eq("resolved", False) \
        .order("created_at", desc=True).limit(limit).execute()
    return {"alerts": result.data or []}


@app.get("/health")
def health():
    return {"status": "ok", "service": "backend"}