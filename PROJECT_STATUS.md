# CAP³S — Project Status Document
**GLITCHCON 2.0 · Problem GKM_10**
_Last updated: March 9, 2026_

---

## TL;DR

| Layer | Status |
|---|---|
| Backend (FastAPI) | ✅ Complete — 20 endpoints, all 7 EHR tools + bonus |
| Knapsack optimizer | ✅ Complete — 442 lines, wired into `generate_meal_plan` |
| PQC (Dilithium3) | ✅ Complete — wired into EHR updates, summaries, PDFs |
| Clinical RAG | ✅ Complete — wired into `/rag/query`, `/rag/explain` |
| Frontend — 7 pages | ✅ Complete — all pages built and routed |
| API client layer | ✅ Complete — retry + offline cache, wired into Dashboard + Compliance |
| CorrelationInsight | ✅ Complete — wired into Compliance page |
| RestrictionConflictGraph | ✅ Complete — wired into MealPlan page |
| Offline banner | ✅ Complete — in App.jsx, shows when network drops |
| Data files | ✅ Complete — 4 JSON files in `data/` |
| Launch script | ✅ Complete — `start.py` at root |
| **Missing** | ⚠ `vite.config.js`, `index.html`, `main.jsx`, `PatientDetail.jsx` |

---

## Full File Tree

```
Glitchcon_2.0/
├── start.py                          (46 lines)   — one-command launcher
├── README.md                         (164 lines)  — full project docs
├── DEMO_SCRIPT.md                    (124 lines)  — 8-min judge demo script
│
├── backend/
│   ├── main.py                       (534 lines)  — FastAPI app, 20 endpoints
│   ├── knapsack_optimizer.py         (442 lines)  — 0/1 DP + Gemini hybrid
│   ├── gemini_client.py              (159 lines)  — Gemini 2.5 Flash client
│   ├── duckdb_engine.py              (1182 lines) — OLAP engine, all clinical tables
│   ├── neopulse_pqc.py               (457 lines)  — CRYSTALS-Dilithium3 (NIST FIPS 204)
│   ├── ollama_client.py              (439 lines)  — local LLM fallback
│   ├── rag_engine.py                 (286 lines)  — clinical RAG, 10 knowledge docs
│   ├── report_generator.py           (267 lines)  — ReportLab PDF + PQC footer
│   ├── whatsapp.py                   (269 lines)  — Twilio multilingual discharge
│   ├── requirements.txt              (22 lines)
│   └── .env.template                 (12 lines)
│
├── data/
│   ├── patients.json                 (88 lines)   — P001, P002, P003 patient records
│   ├── kitchen_inventory.json        (46 lines)   — 40 ingredients with macros
│   ├── restrictions_map.json         (129 lines)  — 14 restriction rules + substitutions
│   └── mid_week_update.json          (22 lines)   — Day 4 liquid→soft update for P003
│
└── frontend/
    ├── package.json                  (21 lines)   — React 18, Vite, Recharts, Lucide
    ├── ⚠ vite.config.js             MISSING
    ├── ⚠ index.html                 MISSING
    └── src/
        ├── App.jsx                   (136 lines)  — sidebar, routing, offline banner
        ├── index.css                 (141 lines)  — dark clinical design system
        │
        ├── api/
        │   └── client.js             (147 lines)  — API client with retry + cache
        │
        ├── components/
        │   ├── CorrelationInsight.jsx    (167 lines)  — Pearson r analytics widget
        │   └── RestrictionConflictGraph.jsx (251 lines) — force-directed canvas graph
        │
        └── pages/
            ├── Dashboard.jsx         (288 lines)  — patient cards, alerts, compliance chart
            ├── ⚠ PatientDetail.jsx   MISSING
            ├── MealPlan.jsx          (203 lines)  — generate plan, day selector, macros
            ├── Compliance.jsx        (263 lines)  — 7-day chart, day grid, update modal
            ├── DietitianAI.jsx       (211 lines)  — Ollama chat + RAG cited-sources
            ├── Reports.jsx           (182 lines)  — PDF download + discharge modal
            └── PQCStatus.jsx         (188 lines)  — live benchmark, Dilithium3 vs RSA
```

**Total source lines (excluding missing files): ~6,400**

---

## Backend — What's Done

### main.py — All 20 Endpoints

| Tag | Method | Endpoint | Status |
|---|---|---|---|
| 7 EHR Tools | GET | `/api/v1/get_dietary_orders/{patient_id}` | ✅ |
| 7 EHR Tools | GET | `/api/v1/get_kitchen_inventory` | ✅ |
| 7 EHR Tools | POST | `/api/v1/generate_meal_plan` | ✅ (Knapsack + Gemini) |
| 7 EHR Tools | POST | `/api/v1/check_meal_compliance` | ✅ (DuckDB rule engine) |
| 7 EHR Tools | POST | `/api/v1/update_meal_plan` | ✅ (PQC-signed) |
| 7 EHR Tools | POST | `/api/v1/log_meal_consumption` | ✅ (DuckDB insert) |
| 7 EHR Tools | GET | `/api/v1/generate_nutrition_summary/{patient_id}` | ✅ (PQC-signed) |
| Bonus | POST | `/api/v1/discharge/{patient_id}` | ✅ (Gemini multilingual + Twilio) |
| AI | POST | `/api/v1/ask_dietitian_ai` | ✅ (Ollama + Gemini fallback) |
| Dashboard | GET | `/api/v1/dashboard` | ✅ |
| Dashboard | GET | `/api/v1/patients` | ✅ |
| Dashboard | GET | `/api/v1/patients/{patient_id}` | ✅ |
| Dashboard | GET | `/api/v1/timeline/{patient_id}` | ✅ |
| RAG | POST | `/api/v1/rag/query` | ✅ |
| RAG | GET | `/api/v1/rag/explain/{restriction}` | ✅ |
| RAG | GET | `/api/v1/rag/knowledge` | ✅ |
| Reports | GET | `/api/v1/reports/weekly/{patient_id}` | ✅ (PDF streaming) |
| PQC | GET | `/api/v1/pqc/benchmark` | ✅ |
| PQC | GET | `/api/v1/pqc/status` | ✅ |
| Health | GET | `/health` | ✅ |
| WhatsApp webhook | POST | `/api/v1/whatsapp/webhook` | ✅ (via whatsapp.py router) |

### Module Wiring in main.py

| Module | How it's imported | Where used |
|---|---|---|
| `gemini_client.py` | `from gemini_client import ask_gemini` | `generate_meal_plan`, `discharge`, `ask_dietitian_ai` |
| `knapsack_optimizer.py` | `from knapsack_optimizer import generate_hybrid_meal_plan` (lazy, inside generate_meal_plan) | `POST /generate_meal_plan` |
| `neopulse_pqc.py` | `from neopulse_pqc import NeoPulseShield` (try/except, graceful fallback) | `update_meal_plan`, `generate_nutrition_summary`, `reports/weekly` |
| `duckdb_engine.py` | `from duckdb_engine import init_duckdb` | App startup — initialises all tables |
| `rag_engine.py` | lazy import inside endpoints | `/rag/query`, `/rag/explain`, `/rag/knowledge` |
| `report_generator.py` | inline in `/reports/weekly` | PDF generation with PQC footer |
| `whatsapp.py` | `from whatsapp import router as whatsapp_router` | Mounted as sub-router |
| `ollama_client.py` | used by `ask_dietitian_ai` as local fallback | Dietitian AI endpoint |

---

## Frontend — What's Done

### Pages

| Page | File | Lines | API calls | Special components |
|---|---|---|---|---|
| Dashboard | `Dashboard.jsx` | 288 | `dashboardApi.get()`, `mealPlanApi.logConsumption()`, `useOnlineStatus()` | Log meal modal, compliance bar chart |
| Patients (EHR) | `PatientDetail.jsx` | **MISSING** | — | RestrictionConflictGraph should also appear here |
| Meal Plans | `MealPlan.jsx` | 203 | Raw fetch → `/generate_meal_plan`, `/check_meal_compliance` | **RestrictionConflictGraph** wired in |
| Compliance | `Compliance.jsx` | 263 | `nutritionApi.getTimeline()`, `nutritionApi.getSummary()`, `mealPlanApi.update()` | **CorrelationInsight** wired in, mid-week update modal |
| Dietitian AI | `DietitianAI.jsx` | 211 | Raw fetch → `/rag/query`, `/ask_dietitian_ai` | RAG cited-sources panel |
| Reports | `Reports.jsx` | 182 | Raw fetch → `/reports/weekly`, `/discharge` | PDF download, discharge + WhatsApp modal |
| PQC Status | `PQCStatus.jsx` | 188 | Raw fetch → `/pqc/status`, `/pqc/benchmark` | Live benchmark animation |

### Components

| Component | File | Lines | Purpose | Where wired |
|---|---|---|---|---|
| CorrelationInsight | `components/CorrelationInsight.jsx` | 167 | Pearson r between calorie adherence and compliance. All computed client-side, no hardcoding. | **Compliance.jsx** — renders after 7-day grid, only when ≥3 data points exist |
| RestrictionConflictGraph | `components/RestrictionConflictGraph.jsx` | 251 | Force-directed canvas graph of restriction nodes. Renal conflicts glow red + pulse. No D3 dependency — pure spring simulation in canvas. | **MealPlan.jsx** — renders immediately on patient select, before plan is generated |

### API Client (`src/api/client.js`) — 147 lines

| Feature | Detail |
|---|---|
| Exponential backoff retry | 3 attempts: 400ms → 800ms → 1600ms |
| In-memory GET cache | 5-minute TTL, survives component re-renders |
| SessionStorage fallback | Survives page refresh when offline |
| `useOnlineStatus()` hook | Wired into `Dashboard.jsx` |
| Typed endpoint helpers | `dashboardApi`, `patientApi`, `mealPlanApi`, `nutritionApi`, `ragApi`, `reportsApi`, `pqcApi`, `aiApi` |

**Pages currently using `api/client.js`:** Dashboard, Compliance
**Pages still using raw `fetch` directly:** MealPlan, DietitianAI, Reports, PQCStatus
_(Functional either way — raw fetch works fine, just no retry/cache benefit)_

### App.jsx — Global Shell

- Sidebar with 7 nav links + alert badge counter
- Polls `/api/v1/dashboard` every 30s to update alert count
- **Offline amber banner** — fixed top bar, shows when `navigator.onLine` is false
- React Router v6 with all 7 routes wired

---

## Data Files

| File | Contents |
|---|---|
| `patients.json` | P001 Ravi Kumar (Diabetes, Telugu), P002 Meena Iyer (Renal Stage 4, Tamil), P003 Arjun Singh (Post-GI Surgery, Hindi) |
| `kitchen_inventory.json` | 40 ingredients with full macro profiles (calories, protein, carbs, fat, sodium, potassium, tags) |
| `restrictions_map.json` | 14 restriction rules (low-sugar, low-potassium, liquid-only, etc.) each with forbidden ingredients, tags, and auto-substitution map |
| `mid_week_update.json` | Pre-built Day 4 update: P003 liquid → soft, 1200 → 1600 kcal, physician note from Dr. Ramesh Gupta |

---

## What's Missing

| Item | Impact | Where needed |
|---|---|---|
| `frontend/vite.config.js` | **BLOCKS `npm run dev`** | Vite won't start without it — needs proxy `/api → localhost:8000` |
| `frontend/index.html` | **BLOCKS `npm run dev`** | Entry point for Vite |
| `frontend/src/main.jsx` | **BLOCKS app render** | React DOM root mount |
| `frontend/src/pages/PatientDetail.jsx` | Route `/patients` shows blank | EHR viewer page, RestrictionConflictGraph should also appear here |

---

## What Needs To Be Done Still

1. **Add missing 4 files** (`vite.config.js`, `index.html`, `main.jsx`, `PatientDetail.jsx`) — frontend won't run at all without them.
2. **Optional:** Wire remaining pages to `api/client.js` — MealPlan, DietitianAI, Reports, PQCStatus currently use raw `fetch`. Works fine but doesn't benefit from retry/cache.
3. **Optional:** Wire `RestrictionConflictGraph` into `PatientDetail.jsx` once it's created (the README and demo script both reference it there).
4. **Environment setup:** Copy `backend/.env.template` → `backend/.env`, add `GEMINI_API_KEY` and Twilio credentials before demo.
5. **Ollama:** Must be running locally for Dietitian AI local fallback.

---

## How To Run (Once Missing Files Are Added)

```bash
# Option 1 — one command from root
python start.py

# Option 2 — manual
cd backend
pip install -r requirements.txt
cp .env.template .env   # add GEMINI_API_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# In a second terminal
cd frontend
npm install
npm run dev
# → http://localhost:5173
# → http://localhost:8000/docs  (Swagger UI)
```

---

## Code Provenance Summary

| File | Origin | Changes made |
|---|---|---|
| `gemini_client.py` | AgriSahayak | Zero |
| `duckdb_engine.py` | AgriSahayak | Zero (new clinical tables added in main.py) |
| `neopulse_pqc.py` | NeoPulse | Zero |
| `ollama_client.py` | NeoPulse | Zero |
| `whatsapp.py` | AgriSahayak | Domain remapped: crop alerts → meal discharge |
| `rag_engine.py` | AgriSahayak | Knowledge base swapped: crop disease → 10 clinical nutrition guidelines |
| `report_generator.py` | NeoPulse | Template swapped: health report → clinical nutrition PDF |
| `knapsack_optimizer.py` | **ORIGINAL** | New — 442 lines, 0/1 DP for clinical ingredient selection |
| `api/client.js` | AgriSahayak pattern | Offline cache + retry adapted for hospital demo |
| `RestrictionConflictGraph.jsx` | NeoPulse DrugInteractionGraph pattern | Drug nodes → restriction nodes; pure canvas (no D3) |
| `CorrelationInsight.jsx` | NeoPulse HealthTimeline pattern | Sleep/stress correlations → calorie adherence/compliance |
| All pages + App.jsx | **ORIGINAL** | Purpose-built for clinical nutrition UI |
