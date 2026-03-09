# CAP³S — Clinical Nutrition Care Agent
### GLITCHCON 2.0 · Problem GKM_10 · Team: [Your Team Name]

> *"We didn't build a meal planning app. We built the clinical layer connecting doctor's prescription → patient's tray → family's kitchen — in their own language, verified by quantum-resistant cryptography."*

---

## 🏥 What It Does

CAP³S is an end-to-end clinical nutrition management system for hospitals. It solves the exact 7-point problem statement of GKM_10 — and ships the bonus feature.

| # | Problem Requirement | CAP³S Solution |
|---|---|---|
| 1 | Accept dietary requirements from physician | `GET /api/v1/get_dietary_orders/{patient_id}` — pulls EHR diet order |
| 2 | Generate personalized 7-day meal plan | **Knapsack + Gemini hybrid** — CS algorithm selects ingredients, LLM names the dish |
| 3 | Cross-check every meal against restrictions | `POST /api/v1/check_meal_compliance` — DuckDB rule engine + auto-substitution |
| 4 | Adapt plan when physician updates diet order | `POST /api/v1/update_meal_plan` — PQC-signed, kitchen notified |
| 5 | Track patient meal consumption feedback | `POST /api/v1/log_meal_consumption` — DuckDB insert, 48h refusal OLAP alert |
| 6 | Generate weekly nutrition summary | `GET /api/v1/generate_nutrition_summary/{patient_id}` — OLAP aggregate, Dilithium3 signed |
| ★ | 30-day home guide in patient's language → WhatsApp | `POST /api/v1/discharge/{patient_id}` — Gemini multilingual + Twilio delivery |
| 📈 | Per-day compliance timeline for dashboard chart | `GET /api/v1/timeline/{patient_id}?n_days=7` — DuckDB OLAP, remapped from NeoPulse |
| 🍽️ | Kitchen stock levels & low-stock alerts | `GET /api/v1/kitchen/inventory-status` — category breakdown, flags items < 2 kg |

---

## 🧠 The Technical Differentiator

### Knapsack × Gemini Hybrid Meal Planning

Most teams ask the LLM to generate a meal plan and hope the calories are right. We don't.

```
Kitchen inventory (40 ingredients)
         ↓
  Restriction filter          ← removes forbidden items BEFORE the LLM sees anything
  Diet stage filter            ← liquid / soft / solid
  Sodium pre-filter            ← per-meal budget guard
         ↓
  0/1 Knapsack DP algorithm    ← maximises protein density within calorie budget
  (value = protein/cal ratio)  ← O(n·W) where W = budget/5 kcal buckets
         ↓
  Proportional scaling         ← hits target within ±5%
         ↓
  Gemini 2.5 Flash             ← names the dish, writes prep notes ONLY
```

**Result:** Macro accuracy is deterministic. Gemini only does what LLMs are actually good at.

*Pearson r between calorie adherence and compliance: computed client-side from DuckDB timeline data.*

### Post-Quantum Cryptography (NIST FIPS 204)

Every EHR update is signed with CRYSTALS-Dilithium3 (lattice-based, unforgeable under LWE hardness assumption).

```
Pr[Forge] ≤ 2⁻¹²⁸
Signing:    ~46ms   (Dilithium3)
vs RSA-4096: ~2100ms (classical)
```

Applied to: every `update_meal_plan`, every `generate_nutrition_summary`, every PDF report, every discharge summary.

### Clinical RAG (10 Knowledge Documents)

| Source | Topic |
|---|---|
| NKF 2023 | Potassium restriction in CKD |
| KDOQI 2020 | Phosphorus restriction |
| ADA 2024 | Diabetic diet glycaemic index |
| ESPEN 2021 | Post-surgical liquid→soft progression |
| KDIGO 2023 | Fluid restriction in renal failure |
| Indian Heart Association 2023 | Sodium restriction |
| ASPEN 2022 | Protein requirements |
| IIMR | Ragi in diabetic diets |
| IDA 2021 | Traditional Indian Foods in Clinical Nutrition Management |
| WHO 2023 | 30-day home nutrition post-discharge |

---

## 🏗️ Architecture

```
Glitchcon_2.0/
├── start.py                    ← one command to launch everything
├── backend/
│   ├── main.py                 ← FastAPI, 20 endpoints, 7 EHR tools
│   ├── knapsack_optimizer.py   ← 0/1 Knapsack + Gemini hybrid (ORIGINAL)
│   ├── gemini_client.py        ← Gemini 2.5 Flash client
│   ├── duckdb_engine.py        ← OLAP analytics engine
│   ├── neopulse_pqc.py         ← CRYSTALS-Dilithium3 (NIST FIPS 204)
│   ├── ollama_client.py        ← Local LLM fallback
│   ├── rag_engine.py           ← Clinical RAG, 10 knowledge docs
│   ├── report_generator.py     ← ReportLab PDF with PQC footer
│   └── whatsapp.py             ← Twilio multilingual meal logging
├── data/
│   ├── patients.json           ← 3 demo patients (Diabetes, Renal, Post-GI)
│   ├── kitchen_inventory.json  ← 40 ingredients with full macro profiles
│   ├── restrictions_map.json   ← 14 restriction rules + auto-substitution map
│   └── mid_week_update.json    ← Day 4 liquid→soft update for P003
└── frontend/
    ├── src/
    │   ├── api/client.js       ← Offline-aware API client with retry
    │   ├── components/
    │   │   ├── CorrelationInsight.jsx   ← Pearson r client-side analytics
    │   │   └── RestrictionGraph.jsx     ← D3-style restriction conflict graph
    │   └── pages/              ← 7 pages: Dashboard, Patients, Meal Plans,
    │                              Compliance, Dietitian AI, Reports, PQC Status
    └── vite.config.js
```

### Code Provenance (Transparent Reuse)

CAP³S is built on two existing production codebases, remapped to the clinical domain:

| File | Source | Changes |
|---|---|---|
| `gemini_client.py` | AgriSahayak | Zero — same Gemini client |
| `duckdb_engine.py` | AgriSahayak | Zero — OLAP engine reused |
| `neopulse_pqc.py` | NeoPulse | Zero — Dilithium3 implementation |
| `ollama_client.py` | NeoPulse | Zero — local LLM fallback |
| `whatsapp.py` | AgriSahayak | Domain remapped: crop alerts → meal logging |
| `rag_engine.py` | AgriSahayak | Knowledge base swapped: crop disease → 10 clinical nutrition docs |
| `report_generator.py` | NeoPulse | Template swapped: health report → clinical nutrition PDF |
| `knapsack_optimizer.py` | **ORIGINAL** | New — 504 lines, 0/1 DP algorithm for clinical meal selection |
| `api/client.js` | AgriSahayak pattern | Offline cache + retry for hospital demo WiFi resilience |
| `RestrictionGraph.jsx` | NeoPulse pattern | Force-directed graph: drug interactions → restriction conflicts |
| `CorrelationInsight.jsx` | NeoPulse pattern | Pearson r: sleep/stress → calorie adherence/compliance |

---

## 🚀 Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- Gemini API key (free tier works)
- Ollama running locally (optional — falls back to Gemini)

### Backend

```bash
cd Glitchcon_2.0/backend
pip install -r requirements.txt
cp .env.template .env
# Edit .env — add GEMINI_API_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# → http://localhost:8000/docs
```

### Frontend

```bash
cd Glitchcon_2.0/frontend
npm install
npm run dev
# → http://localhost:5173
```

### One-command launch

```bash
python start.py
```

---

## 🎯 Demo Patients

| ID | Name | Condition | Language | Diet | Key Constraint |
|---|---|---|---|---|---|
| P001 | Ravi Kumar | Type 2 Diabetes | Telugu | Solid | No sugar, low-GI only |
| P002 | Meena Iyer | Renal Failure Stage 4 | Tamil | Solid | No tomato/banana, K<2000mg |
| P003 | Arjun Singh | Post-GI Surgery | Hindi | Liquid→Soft (Day 4) | 1200→1600 kcal progression |

### Live Demo Flow

1. **Dashboard** → 3 patient cards, red alert badge (48h refusal flag)
2. **Patients → Meena (P002)** → restriction conflict graph lights up, renal nodes glow red
3. **Meal Plans → Generate** → Knapsack selects ingredients → Gemini names dishes → tomato flagged → ridge gourd auto-substituted
4. **Compliance → Arjun (P003)** → mid-week update modal → liquid→soft → "PQC-signed, kitchen notified" → correlation insight appears
5. **Dietitian AI** → ask "why no tomatoes for Meena?" → RAG cites NKF 2023 + KDIGO 2023
6. **Reports → Download PDF** → ReportLab file with Dilithium3 signature footer
7. **PQC Status → Run Benchmark** → 46ms vs 2100ms bar fills live
8. **Reports → Discharge Arjun** → 30-day Hindi home guide → Twilio → WhatsApp delivered

---

## 🔌 API Reference

Full interactive docs at `http://localhost:8000/docs` once backend is running.

| Tag | Endpoints |
|---|---|
| 7 EHR Tools | `GET /get_dietary_orders/{id}`, `GET /get_kitchen_inventory`, `POST /generate_meal_plan`, `POST /check_meal_compliance`, `POST /update_meal_plan`, `POST /log_meal_consumption`, `GET /generate_nutrition_summary/{id}` |
| Bonus WhatsApp | `POST /discharge/{id}`, `POST /whatsapp/webhook` |
| Clinical RAG | `POST /rag/query`, `GET /rag/explain/{restriction}`, `GET /rag/knowledge` |
| Reports | `GET /reports/weekly/{id}` |
| PQC | `GET /pqc/benchmark`, `GET /pqc/status` |
| Dashboard | `GET /dashboard`, `GET /patients`, `GET /timeline/{id}` |

---

## ⚗️ Tech Stack

**Backend:** FastAPI · DuckDB · CRYSTALS-Dilithium3 · Gemini 2.5 Flash · Ollama · ReportLab · Twilio · edge-tts · sentence-transformers

**Frontend:** React 18 · Vite · Recharts · Canvas API (restriction graph) · React Router v6

**Algorithms:** 0/1 Knapsack DP · Pearson correlation · Force-directed graph layout · OLAP window functions

---

## 👥 Team

Built for GLITCHCON 2.0, problem statement GKM_10.

*"Every EHR update signed with NIST FIPS 204. Unforgeable. The bonus WhatsApp feature? Already shipped. In 9 Indian languages."*
