# ml-service/main.py
# ─────────────────────────────────────────────────────────────
# PURPOSE: FastAPI server — the HTTP API layer.
#
# This is what your backend calls after every Clerk login.
# It receives login features, asks the model for a score,
# and returns: risk_score + verdict + action.
#
# Endpoints:
#   POST /predict  → main endpoint, returns risk score
#   GET  /health   → confirms server is running
#
# Run with:
#   uvicorn main:app --reload --port 8000
#
# Interactive docs (FREE from FastAPI):
#   http://localhost:8000/docs
# ─────────────────────────────────────────────────────────────

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from models import load_or_train, compute_risk_score

# ── App initialisation ───────────────────────────────────────
app = FastAPI(
    title="SentinelNode ML Service",
    description="Anomaly detection for login events",
    version="0.1.0"
)

# CORS: allows your Next.js frontend and backend to call this
# In production you'd replace "*" with your actual domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load model at startup ────────────────────────────────────
# This runs ONCE when the server starts.
# If model.pkl exists → loads it (fast).
# If not → trains a fresh one from synthetic data (first run).
# All subsequent requests reuse this loaded model.
model = load_or_train()


# ── Input schema ─────────────────────────────────────────────
# Pydantic automatically validates incoming JSON.
# If any field is missing or wrong type → returns 422 error.
# Field(...) means the field is required (no default).
class LoginEvent(BaseModel):
    login_hour: int = Field(..., ge=0, le=23,
        description="Hour of login in 24h format (0-23)")
    ip_changed: int = Field(..., ge=0, le=1,
        description="1 if IP differs from user's last 5 logins")
    attempts_last_hour: int = Field(..., ge=1,
        description="Number of login attempts in last 60 minutes")
    location_changed: int = Field(..., ge=0, le=1,
        description="1 if country or city differs from history")
    new_device: int = Field(..., ge=0, le=1,
        description="1 if this browser+OS combo is new for user")


# ── POST /predict ────────────────────────────────────────────
@app.post("/predict")
def predict(event: LoginEvent):
    """
    MAIN ENDPOINT — called by your backend after every login.

    INPUT (JSON body):
    {
      "login_hour": 9,
      "ip_changed": 0,
      "attempts_last_hour": 1,
      "location_changed": 0,
      "new_device": 0
    }

    OUTPUT:
    {
      "risk_score": 0.08,
      "verdict": "normal",
      "action": "log_only"
    }

    VERDICT THRESHOLDS:
    score < 0.50  → "normal" → just log it, no action
    score 0.50–0.89 → "alert" → create alert in Supabase
    score >= 0.90 → "block"  → SOAR auto-blocks IP + disables user
    """

    # Build feature list in the exact order the model expects
    features = [
        event.login_hour,
        event.ip_changed,
        event.attempts_last_hour,
        event.location_changed,
        event.new_device,
    ]

    # Ask the model for a score
    risk_score = compute_risk_score(model, features)

    # Decide verdict and action based on score
    if risk_score >= 0.90:
        verdict = "block"
        action  = "disable_user_and_block_ip"
    elif risk_score >= 0.50:
        verdict = "alert"
        action  = "create_alert"
    else:
        verdict = "normal"
        action  = "log_only"

    # Log to terminal so you can watch in real time
    print(f"[predict] hour={event.login_hour} ip_changed={event.ip_changed} "
          f"attempts={event.attempts_last_hour} → score={risk_score} [{verdict}]")

    return {
        "risk_score": risk_score,
        "verdict":    verdict,
        "action":     action,
    }


# ── GET /health ──────────────────────────────────────────────
@app.get("/health")
def health():
    """
    Your backend calls this before sending login data.
    Confirms the ML service is alive and model is loaded.
    """
    return {"status": "ok", "model": "loaded"}