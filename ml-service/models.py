# ml-service/models.py
# ─────────────────────────────────────────────────────────────
# PURPOSE: Everything related to the ML model lives here.
#
# This file is separate from main.py intentionally.
# main.py = API layer (handles HTTP requests/responses)
# models.py = ML layer (training, loading, scoring)
#
# This separation means you can improve the model later
# without touching the API code at all.
# ─────────────────────────────────────────────────────────────

import numpy as np
from sklearn.ensemble import IsolationForest
import joblib
import os

MODEL_PATH = "model.pkl"

# ── FEATURE EXPLANATION ──────────────────────────────────────
# Every login gets reduced to exactly 5 numbers.
# These are computed by your backend before calling /predict.
#
# Feature 0: login_hour         (0–23)
#   → What hour did the login happen?
#   → Normal: 8–21  |  Suspicious: 0–5
#
# Feature 1: ip_changed          (0 or 1)
#   → Does this IP differ from the user's last 5 logins?
#   → Normal: 0  |  Suspicious: 1
#
# Feature 2: attempts_last_hour  (integer, min 1)
#   → How many login attempts in the last 60 minutes?
#   → Normal: 1–2  |  Suspicious: 10+
#
# Feature 3: location_changed    (0 or 1)
#   → Is the country/city different from their history?
#   → Normal: 0  |  Suspicious: 1
#
# Feature 4: new_device          (0 or 1)
#   → Is the browser+OS combo new for this user?
#   → Normal: 0  |  Suspicious: 1
# ─────────────────────────────────────────────────────────────

def _generate_normal_data(n: int = 600) -> np.ndarray:
    """
    Creates synthetic 'normal' login data to bootstrap the model.

    WHY: When you first launch, you have zero real login data.
    The model needs training data to learn what normal looks like.
    We simulate 600 normal logins so the model works from day one.

    Later, as real logins accumulate in Supabase, you call
    retrain_from_logs() to replace this synthetic data with real data.
    That's when the model becomes truly personalised per user.
    """
    np.random.seed(42)  # fixed seed = reproducible results every run
    n = 600

    return np.column_stack([
        np.random.randint(8, 21, n),  # login_hour: 8am–9pm
        np.zeros(n),                   # ip_changed: same IP
        np.ones(n),                    # attempts: 1 attempt
        np.zeros(n),                   # location_changed: same city
        np.zeros(n),                   # new_device: known device
    ])


def train_model() -> IsolationForest:
    """
    Trains the Isolation Forest model and saves it to model.pkl.

    WHAT IS ISOLATION FOREST:
    It learns what normal looks like, then scores new data
    by how different it is from normal.
    It never sees attack examples — it just knows normal.
    Anything far from normal gets a high risk score.

    contamination=0.05 means:
    "I expect about 5% of logins to be anomalies."
    This controls how aggressive the model is.
    """
    print("[models] Training fresh model on synthetic normal data...")
    X = _generate_normal_data()
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(X)
    joblib.dump(model, MODEL_PATH)
    print(f"[models] Model trained on {len(X)} samples → saved to {MODEL_PATH}")
    return model


def load_or_train() -> IsolationForest:
    """
    Called once when the FastAPI server starts up.
    Loads model from disk if it exists, otherwise trains a new one.

    This means:
    - First run → trains + saves model.pkl
    - Every subsequent run → loads model.pkl instantly
    - No retraining on every server restart
    """
    if os.path.exists(MODEL_PATH):
        print("[models] Found model.pkl — loading from disk.")
        return joblib.load(MODEL_PATH)
    print("[models] No model.pkl found — training new model.")
    return train_model()


def compute_risk_score(model: IsolationForest, features: list) -> float:
    """
    Converts Isolation Forest output to 0.0–1.0 risk score.

    IsolationForest.score_samples() returns values roughly in [-0.5, 0.5]
    where:
      positive values = normal (deep in cluster)
      negative values = anomalous (easy to isolate)

    We use decision_function() instead which is more stable,
    then normalise properly.
    """
    X = np.array([features])

    # decision_function returns:
    #   positive = normal
    #   negative = anomaly
    raw = model.decision_function(X)[0]

    # Clamp raw to [-0.5, 0.5] range then flip and scale to 0–1
    # raw =  0.5 → score = 0.0  (very normal)
    # raw =  0.0 → score = 0.5  (borderline)
    # raw = -0.5 → score = 1.0  (very anomalous)
    clamped = max(-0.5, min(0.5, raw))
    score = (0.5 - clamped)   # flip: negative raw = high score

    return round(max(0.0, min(1.0, score)), 2)


def retrain_from_logs(login_rows: list) -> IsolationForest:
    """
    Retrain using real login data fetched from Supabase.
    Call this from scripts/retrain.py once you have 200+ real logins.

    Each dict in login_rows needs these keys:
      login_hour, ip_changed, attempts_last_hour,
      location_changed, new_device

    Example call:
      rows = supabase.table("login_logs").select("*").execute().data
      retrain_from_logs(rows)
    """
    print(f"[models] Retraining on {len(login_rows)} real login rows...")
    X = np.array([[
        row["login_hour"],
        int(row["ip_changed"]),
        row["attempts_last_hour"],
        int(row["location_changed"]),
        int(row["new_device"]),
    ] for row in login_rows])

    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(X)
    joblib.dump(model, MODEL_PATH)
    print(f"[models] Retrained model saved to {MODEL_PATH}")
    return model