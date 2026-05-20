```
███████╗███████╗███╗   ██╗████████╗██╗███╗   ██╗███████╗██╗     ███╗   ██╗ ██████╗ ██████╗ ███████╗
██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║████╗  ██║██╔════╝██║     ████╗  ██║██╔═══██╗██╔══██╗██╔════╝
███████╗█████╗  ██╔██╗ ██║   ██║   ██║██╔██╗ ██║█████╗  ██║     ██╔██╗ ██║██║   ██║██║  ██║█████╗  
╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██║╚██╗██║██╔══╝  ██║     ██║╚██╗██║██║   ██║██║  ██║██╔══╝  
███████║███████╗██║ ╚████║   ██║   ██║██║ ╚████║███████╗███████╗██║ ╚████║╚██████╔╝██████╔╝███████╗
╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝
```

**ML-Powered Adaptive IAM & Threat Orchestrator**

> An AI-powered security platform that monitors user login behaviour, detects anomalies using Isolation Forest ML, and automatically responds to cyber threats in real time — no human intervention required.

![Python](https://img.shields.io/badge/Python-3.9-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.128-green?style=flat-square&logo=fastapi)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![Scikit-learn](https://img.shields.io/badge/scikit--learn-Isolation_Forest-orange?style=flat-square&logo=scikit-learn)
![Clerk](https://img.shields.io/badge/Clerk-Auth-purple?style=flat-square)

---

## 📌 What is SentinelNode?

SentinelNode is a real-time, AI-powered Identity Access Management (IAM) security system that watches every user login, scores it for risk using a machine learning model, and automatically takes action — blocking accounts, raising alerts, and logging everything — without any manual work.

Unlike rule-based systems that only catch known attack patterns, SentinelNode uses **unsupervised anomaly detection** — it learns what normal looks like for your users and flags anything that deviates, including zero-day credential attacks it has never seen before.

```
User logs in  →  Clerk webhook  →  Feature extraction  →  Isolation Forest  →  Risk score  →  SOAR action  →  Dashboard
```

---

## ✨ Key Features

| # | Feature | Description |
|---|---------|-------------|
| 01 | 🔐 Clerk Authentication | Managed login, signup, and session handling — no password code written |
| 02 | 📡 Real-time Webhook Pipeline | Every login fires a Clerk webhook → backend → ML → SOAR in milliseconds |
| 03 | 🧠 Isolation Forest ML | Unsupervised anomaly detection — no labelled attack data required |
| 04 | ⚡ 3-Tier Risk Scoring | NORMAL (< 0.5) · ALERT (0.5–0.89) · BLOCK (≥ 0.9) |
| 05 | 🤖 SOAR Engine | Auto-disables Clerk accounts and creates alerts when score ≥ 0.9 |
| 06 | 🗄️ Supabase Database | PostgreSQL with RLS — stores users, login logs, and alerts persistently |
| 07 | 📊 CrowdStrike-style Dashboard | Live charts, ML threshold tester, score distribution donuts, detections table |
| 08 | 🧪 Attack Simulator | Simulate normal / suspicious / brute force logins directly from the UI |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LOGIN (Clerk)                       │
│              Email / password verified by Clerk                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │  session.created webhook
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGROK TUNNEL (dev only)                      │
│         Exposes localhost:8001 to Clerk's servers               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND  :8001                        │
│   POST /api/ingest-log                                          │
│   · Resolve or create user in Supabase                         │
│   · Compute 5 ML features from login history                   │
│   · Insert login_log row (risk_score = null)                   │
└──────────────┬──────────────────────────────────────────────────┘
               │  POST /predict
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FASTAPI ML SERVICE  :8000                     │
│   · Isolation Forest loaded from model.pkl                     │
│   · Scores 5 features → risk_score 0.0–1.0                    │
│   · Returns { risk_score, verdict, action }                    │
└──────────────┬──────────────────────────────────────────────────┘
               │  risk_score returned
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SOAR ENGINE  (soar.py)                     │
│   score < 0.5   → log only, no action                          │
│   score 0.5–0.89 → insert alert row (alert_only)              │
│   score ≥ 0.9   → Clerk API ban + insert alert row            │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (PostgreSQL)                       │
│   login_logs  ·  alerts  ·  users                              │
└──────────────┬──────────────────────────────────────────────────┘
               │  GET /api/logs · GET /api/alerts
               ▼
┌─────────────────────────────────────────────────────────────────┐
│               NEXT.JS DASHBOARD  :3000                          │
│   Activity dashboard · Detections · SOAR engine                │
│   ML insights · Settings · Threshold tester                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧠 ML Model — Isolation Forest

### Why Isolation Forest?

Traditional fraud detection requires **labelled attack data** — thousands of examples of "this is an attack." That data is almost impossible to get for a new system with no history.

Isolation Forest solves this by being **fully unsupervised**. It never sees attack examples. Instead:

1. It learns the shape of **normal login behaviour** from training data
2. It scores new logins by how different they are from that normal cluster
3. Anomalies are **isolated quickly** (few random cuts needed)
4. Normal points are **deep in the cluster** (many cuts needed to isolate)

This means SentinelNode detects attacks it has **never seen before**, including zero-day credential stuffing and novel brute force patterns.

### Dataset — How Training Data Was Built

**No external dataset was used.** The training data was generated synthetically to represent normal user behaviour, then improved with real login events as they accumulate.

**Phase 1 — Synthetic bootstrapping (600 samples)**

```python
# ml-service/models.py — _generate_normal_data()
np.column_stack([
    np.random.randint(8, 21, n),  # login_hour: 8am–9pm (business hours)
    np.zeros(n),                   # ip_changed: 0 — same IP = normal
    np.ones(n),                    # attempts: 1 — single attempt = normal
    np.zeros(n),                   # location_changed: 0 — same city
    np.zeros(n),                   # new_device: 0 — known device
])
```

A normal user logs in during business hours, from the same IP they always use, on a device you've seen before, with one attempt. This cluster defines "normal."

**Phase 2 — Real data retraining**

As real logins accumulate in Supabase's `login_logs` table, `retrain_from_logs()` can be called to replace synthetic data with real user patterns, significantly reducing false positives.

### The 5 Features

| Feature | Type | Normal | Suspicious |
|---------|------|--------|------------|
| `login_hour` | int 0–23 | 8–20 (business hours) | 0–5 (off-hours) |
| `ip_changed` | 0 or 1 | 0 — same IP as history | 1 — new IP address |
| `attempts_last_hour` | int | 1–2 attempts | 10+ attempts |
| `location_changed` | 0 or 1 | 0 — same city | 1 — different country |
| `new_device` | 0 or 1 | 0 — known browser/OS | 1 — unseen device |

### Risk Score Thresholds

| Score Range | Verdict | SOAR Action |
|-------------|---------|-------------|
| 0.00 – 0.49 | 🟢 NORMAL | Log only — no action |
| 0.50 – 0.89 | 🟡 ALERT | Insert alert row — human reviews |
| 0.90 – 1.00 | 🔴 BLOCK | Disable Clerk account + insert alert |

### Model Parameters

```python
IsolationForest(
    contamination=0.05,   # expect 5% of logins to be anomalies
    random_state=42       # reproducible results across restarts
)
```

`contamination=0.05` controls aggression — lower means more false alarms, higher means more missed attacks. Tunable based on your false positive rate.

---

## 📊 Dashboard Pages

| Page | What it shows |
|------|---------------|
| **Activity dashboard** | SentinelScore, 4 stat cards with sparklines, risk bar chart, score distribution donuts, ML threshold tester with live sliders, active alerts panel, simulate buttons, detections table |
| **Detections** | All login events with filter tabs (All / High / Medium / Normal), full feature columns including ip_changed and new_device |
| **SOAR engine** | 4 execution stats, workflow rules table, all alert executions with action taken and resolved status |
| **ML insights** | Model configuration, feature importance bars, riskiest login hours chart from real data |
| **Settings** | All service URLs, startup commands for every service |

---

## ⚙️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| Next.js 16 (React) | Dashboard UI, App Router, client-side polling |
| TypeScript | Type safety for API responses and component props |
| Inline SVG | Custom sparklines, bar charts, donut charts — zero dependencies |

### Authentication
| Technology | Purpose |
|-----------|---------|
| Clerk | Login, signup, session management, webhook events |
| Clerk REST API | `POST /v1/users/{id}/ban` — SOAR auto-disable |

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI | Two services — ml-service (:8000) and backend (:8001) |
| Pydantic | Automatic request validation with typed schemas |
| httpx | Async HTTP client for backend → ML service calls |
| python-dotenv | Load `.env` secrets without hardcoding |
| uvicorn | ASGI server to run FastAPI |
| svix | Clerk webhook signature verification |

### ML / Data Science
| Technology | Purpose |
|-----------|---------|
| scikit-learn | `IsolationForest` — core anomaly detection algorithm |
| numpy | Feature vector array operations |
| joblib | Serialize trained model to `model.pkl` for persistence |

### Database
| Technology | Purpose |
|-----------|---------|
| Supabase (PostgreSQL) | Three tables: `users`, `login_logs`, `alerts` |
| Row Level Security | Anon key filtered by RLS policies |
| Supabase Python client | Backend reads/writes via service role key |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| ngrok | Dev tunnel — exposes :8001 to Clerk's webhook server |
| GitHub | Version control — 11 commits, clean history |

---

## 📁 Project Structure

```
sentinelnode/
│
├── frontend/                          ← Next.js dashboard
│   ├── app/
│   │   ├── page.tsx                   ← Full dashboard (5 pages in one file)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── .env.local                     ← Supabase anon key (gitignored)
│   └── package.json
│
├── backend/                           ← FastAPI SOAR engine
│   ├── main.py                        ← POST /api/ingest-log, GET /api/logs, GET /api/alerts
│   ├── database.py                    ← Supabase client + helper functions
│   ├── soar.py                        ← Risk threshold → automated action
│   ├── requirements.txt
│   ├── .env                           ← Supabase + Clerk keys (gitignored)
│   └── venv/                          ← Python 3.9 virtual environment (gitignored)
│
├── ml-service/                        ← FastAPI ML prediction service
│   ├── main.py                        ← POST /predict, GET /health
│   ├── models.py                      ← IsolationForest train / load / score
│   ├── model.pkl                      ← Trained model file (gitignored)
│   ├── requirements.txt
│   └── venv/                          ← Python 3.9 virtual environment (gitignored)
│
├── docs/                              ← Architecture diagrams
├── scripts/                           ← Utility scripts
├── .gitignore                         ← venv, .env, node_modules, model.pkl excluded
└── README.md
```

---

## 🗄️ Database Schema

```sql
-- Users — mirrors Clerk users into your own DB
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  is_banned     BOOLEAN DEFAULT false
);

-- Login logs — one row per login attempt, forever
CREATE TABLE login_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  ip_address          TEXT,
  device              TEXT,
  location            TEXT,
  login_hour          INT,
  ip_changed          BOOLEAN DEFAULT false,
  location_changed    BOOLEAN DEFAULT false,
  new_device          BOOLEAN DEFAULT false,
  attempts_last_hour  INT DEFAULT 1,
  risk_score          FLOAT,              -- null until ML responds
  timestamp           TIMESTAMPTZ DEFAULT now()
);

-- Alerts — only written when score >= 0.5
CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  risk_score    FLOAT NOT NULL,
  reason        TEXT,
  action_taken  TEXT,                     -- "alert_only" or "user_disabled"
  resolved      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## ▶️ How to Run

### Prerequisites

- Python 3.9 (system Python, not Anaconda)
- Node.js 18+
- A Supabase account (free tier works)
- A Clerk account (free tier works)
- ngrok account (free tier works)

### Step 1 — Clone the repo

```bash
git clone https://github.com/Amman352/Sentinel-Node.git
cd Sentinel-Node
```

### Step 2 — Set up ML service

```bash
cd ml-service
/usr/bin/python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn scikit-learn numpy joblib
pip freeze > requirements.txt
```

### Step 3 — Set up Backend

```bash
cd ../backend
/usr/bin/python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn supabase python-dotenv httpx svix
```

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...your-service-role-key...
ML_SERVICE_URL=http://localhost:8000
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

### Step 4 — Set up Frontend

```bash
cd ../frontend
npm install
npm install @supabase/supabase-js
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
```

### Step 5 — Create Supabase tables

Go to Supabase → SQL Editor → paste and run the full schema from the Database Schema section above.

### Step 6 — Run everything

Open 4 terminals:

```bash
# Terminal 1 — ML service
cd ml-service && source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Backend
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8001

# Terminal 3 — Frontend
cd frontend && npm run dev

# Terminal 4 — ngrok (for Clerk webhooks)
ngrok http 8001 --region=in
```

Open **http://localhost:3000**

### Step 7 — Connect Clerk webhook

1. Go to Clerk dashboard → Configure → Webhooks → Add Endpoint
2. URL: `https://your-ngrok-url.ngrok-free.app/api/ingest-log`
3. Events: `session.created` + `user.created`
4. Copy the signing secret → paste into `backend/.env` as `CLERK_WEBHOOK_SECRET`

---

## 🧪 Testing the Pipeline

**Test from the dashboard** — use the Simulate detections buttons on the Activity dashboard page.

**Test from terminal:**

```bash
# Normal login — expect score ~0.08, verdict: normal
curl -X POST http://localhost:8001/api/ingest-log \
  -H "Content-Type: application/json" \
  -d '{"type":"session.created","data":{"user_id":"user_test_normal"}}'

# Brute force — same user, 6 rapid attempts — expect score rising to alert
for i in 1 2 3 4 5 6; do
  curl -s -X POST http://localhost:8001/api/ingest-log \
    -H "Content-Type: application/json" \
    -d '{"type":"session.created","data":{"user_id":"user_attacker"}}' &
done

# Test ML directly
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"login_hour":3,"ip_changed":1,"attempts_last_hour":15,"location_changed":1,"new_device":1}'
```

---

## 🔍 Detection Logic

### How the risk score is computed

```python
# ml-service/models.py — compute_risk_score()
X = np.array([[login_hour, ip_changed, attempts_last_hour, location_changed, new_device]])
raw = model.decision_function(X)[0]   # positive = normal, negative = anomaly
score = (0.5 - raw)                    # flip and normalise to 0.0–1.0
return round(max(0.0, min(1.0, score)), 2)
```

`decision_function()` returns how far a point is from the decision boundary:
- **Positive** → inside the normal cluster → low risk score
- **Negative** → outside the normal cluster → high risk score

### SOAR tier actions

```
score < 0.5   →  log_only         →  no action, just stored in login_logs
score 0.5–0.89 →  alert_only       →  INSERT into alerts, action_taken = "alert_only"
score ≥ 0.9   →  user_disabled    →  POST Clerk ban API + INSERT into alerts
```

---

## ⚠️ Known Limitations & Future Work

| Limitation | Planned Fix |
|-----------|-------------|
| Cold start — first 200 logins use synthetic data | Automatic retraining cron job after 200+ real logins |
| One global model for all users | Per-user Isolation Forest models (Phase 2) |
| `location_changed` hardcoded to 0 | Integrate MaxMind GeoIP API |
| ngrok required in development | Deploy backend to Render/Railway for permanent URL |
| No email alerting | SendGrid integration when score ≥ 0.9 |
| Cloudflare IP block pending | Configure Cloudflare Zone ID and API token |

---

## 🎯 Use Cases

- Small companies that can't afford enterprise SIEM tools
- Developers who want ML-powered auth security without a security team
- Cybersecurity students learning about SOAR, IAM, and anomaly detection
- Capstone and final year projects demonstrating full-stack AI security

---

## 👨‍💻 Author

**Amman Khan**
B.Tech CSE — Cyber Security

> Built for educational and research purposes · SentinelNode AI
