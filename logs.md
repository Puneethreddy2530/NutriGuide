# CAP³S — Debug Logs, Setup Notes & Known Issues

## Project Overview

**CAP³S** — Clinical Nutrition Care Agent  
Hackathon: Glitchcon 2.0  
Stack: Python 3.11.9 (FastAPI) + React 18.3 (Vite)

---

## Startup Commands

### 1. Automated Startup (recommended)
```
cd c:\Users\punee\Desktop\All_Projects\Glitchcon_2.0
py -3.11 start.py
```
`start.py` handles: .env setup → pip install → npm install → backend thread (8179) → frontend thread (5179) → health check poll.

### 2. Manual Backend
```
cd backend
py -3.11 -m uvicorn main:app --host 0.0.0.0 --port 8179 --reload
```

### 3. Manual Frontend
```
cd frontend
npm install
npm run dev
# Runs on http://localhost:5179
# Vite proxy: /api → http://localhost:8179
```

### 4. Health Check
```
curl http://localhost:8179/health
```

### 5. Ollama (must run separately — used by RAG engine + Dietitian AI)
```
ollama serve
ollama pull qwen2.5:7b
```
Fallback model chain: `qwen2.5:7b` → `qwen2.5:1.5b` → `llama3.2` → `mistral`

---

## Ports

| Service  | Port | Notes                          |
|----------|------|--------------------------------|
| Backend  | 8179 | FastAPI + Uvicorn              |
| Frontend | 5179 | Vite dev server                |

> ⚠️ Port 8000 causes conflicts — always use **8179**.

---

## Environment Variables (`.env`)

Copy `backend/.env.template` to `backend/.env` (start.py does this automatically).

```
GEMINI_API_KEY=AIzaSyClD-o2DFsljkMij8btl5L-AKRqKDDod20
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
OLLAMA_URL=http://localhost:11434
```

> ⚠️ **Gemini API key is also hardcoded as a fallback in `backend/gemini_client.py`** line ~10.  
> For production, remove the hardcoded key and use `.env` exclusively.

---

## Known Bugs

### 🔴 CRITICAL — `ImportError: cannot import name 'ask_ollama'`

**File:** `backend/main.py`, line ~390  
**Endpoint affected:** `POST /api/v1/ask_dietitian_ai`  
**Symptom:** Server starts fine, but calling the Dietitian AI endpoint causes a 500 error at runtime:
```
ImportError: cannot import name 'ask_ollama' from 'ollama_client'
```

**Root cause:** `main.py` contains:
```python
from ollama_client import ask_ollama
```
But `ollama_client.py` does NOT define `ask_ollama`. The equivalent function is `quick_response(question, mode)`.

**Fix (one of two options):**

Option A — Update the import in `main.py`:
```python
# Replace:
from ollama_client import ask_ollama
# With:
from ollama_client import quick_response as ask_ollama
```

Option B — Add an alias at the bottom of `ollama_client.py`:
```python
ask_ollama = quick_response
```

---

## Python Packages

```
# Python 3.11.9 — versions proven-working (March 2026)
# PyTorch CUDA 12.1 wheel index (RTX 3050, driver 581.86)
--extra-index-url https://download.pytorch.org/whl/cu121

# API framework
fastapi==0.115.12
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Auth / security
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
bcrypt==4.1.2
cryptography==44.0.0

# HTTP + async
httpx==0.26.0
aiofiles==24.1.0

# Database
duckdb==1.2.2

# Pydantic
pydantic==2.5.3
pydantic-settings==2.1.0

# Gemini AI (Vision + text)
google-generativeai==0.8.4

# Config
python-dotenv==1.0.0

# WhatsApp
twilio==9.4.5

# TTS
edge-tts==6.1.9

# Rate limiting
slowapi==0.1.9

# Image processing
Pillow==10.2.0

# PyTorch CUDA 12.1 — proven working on RTX 3050 6GB Laptop GPU
torch==2.1.2+cu121
torchvision==0.16.2+cu121

# ML helpers
numpy==1.26.3
scikit-learn==1.4.2
transformers==4.36.2

# PDF reports
reportlab==4.2.5

# Post-quantum crypto (Dilithium3 NIST FIPS 204)
dilithium-py==1.4.0

# RAG embeddings
sentence-transformers==2.7.0
```

Install command:
```
py -3.11 -m pip install -r backend/requirements.txt
```

---

## Frontend Packages

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "recharts": "^2.15.3",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.2"
  }
}
```

Install command:
```
cd frontend && npm install
```

---

## Hardware / GPU

| Item       | Details                              |
|------------|--------------------------------------|
| GPU        | NVIDIA RTX 3050 6GB (Laptop)        |
| CUDA       | 12.1                                 |
| Driver     | 581.86                               |
| PyTorch    | 2.1.2+cu121                          |
| Ollama GPU | `OLLAMA_NUM_GPU=-1` (auto VRAM)      |

Ollama uses `num_gpu: -1` in request options → offloads all layers to VRAM automatically.

---

## PQC (Post-Quantum Cryptography)

- **Algorithm:** CRYSTALS-Dilithium3 (NIST FIPS 204)
- **Library:** `dilithium-py==1.4.0`
- **Security level:** 128-bit post-quantum
- **Forge probability:** ≤ 2⁻¹²⁸
- **3-Layer NeoPulse Shield:**
  - L1: Dilithium3 (primary, real PQC)
  - L2: HMAC-SHA3-256 (secondary, classical fallback)
  - L3: UOV simulation on F_256^112 (oil-and-vinegar multivariate)
- **Fallback:** If `dilithium-py` is not installed or Dilithium3 signing fails, `neopulse_pqc.py` automatically falls back to HMAC-SHA3-256 simulation.
- **Key persistence:** Keys saved to `backend/pqc_keys/` on first run.

---

## Data Files Required

All must exist in `data/`:

| File                        | Contents                                      |
|-----------------------------|-----------------------------------------------|
| `data/patients.json`        | 3 patients: P001 Ravi (Diabetes), P002 Meena (Renal), P003 Arjun (Post-GI) |
| `data/kitchen_inventory.json` | Hospital kitchen ingredient stock (kg)      |
| `data/restrictions_map.json`  | Diet restriction rules per diagnosis         |
| `data/food_drug_interactions.json` | Drug × food interaction knowledge base |

---

## Patients Reference

| ID   | Name        | Diagnosis         | Diet Stage   |
|------|-------------|-------------------|--------------|
| P001 | Ravi Kumar  | Type 2 Diabetes   | Regular      |
| P002 | Meena Iyer  | CKD Stage 3       | Renal        |
| P003 | Arjun Singh | Post-GI Surgery   | Liquid → Soft|

---

## API Endpoints Reference

| Method | Path                              | Feature                          |
|--------|-----------------------------------|----------------------------------|
| GET    | /health                           | Health check                     |
| GET    | /api/v1/dashboard                 | KPI summary + alerts             |
| GET    | /api/v1/patients                  | All 3 patients                   |
| GET    | /api/v1/dietary-orders/{id}       | EHR dietary orders               |
| GET    | /api/v1/kitchen-inventory         | Kitchen stock                    |
| POST   | /api/v1/generate_meal_plan        | 7-day knapsack meal plan         |
| POST   | /api/v1/check_meal_compliance     | Compliance check                 |
| POST   | /api/v1/update_meal_plan          | PQC-signed diet update           |
| POST   | /api/v1/log_meal_consumption      | Log meal eaten                   |
| GET    | /api/v1/generate_nutrition_summary/{id} | Daily nutrition summary    |
| GET    | /api/v1/discharge-guide/{id}      | Gemini discharge guide           |
| POST   | /api/v1/ask_dietitian_ai          | ⚠️ BROKEN (ask_ollama bug)       |
| GET    | /api/v1/timeline/{id}             | 7-day compliance timeline        |
| POST   | /api/v1/tray/analyze              | SOTA 1: Gemini Vision tray photo |
| GET    | /api/v1/tray/demo                 | SOTA 1: Demo tray analysis       |
| GET    | /api/v1/food-drug/patient/{id}    | SOTA 2: Food-drug GNN graph      |
| POST   | /api/v1/food-drug/check-meal      | SOTA 2: Meal drug check          |
| GET    | /api/v1/kitchen/burn-rate         | SOTA 3: Inventory burn-rate      |
| GET    | /api/v1/kitchen/inventory-status  | SOTA 3: Stock overview           |
| POST   | /api/v1/rag/sign-knowledge        | SOTA 4: Sign RAG knowledge base  |
| POST   | /api/v1/rag/verified-query        | SOTA 4: PQ-signed RAG query      |
| GET    | /api/v1/rag/verified-query        | SOTA 4: PQ-signed RAG (GET)      |
| POST   | /api/v1/rag/query                 | RAG clinical query (Ollama)      |
| GET    | /api/v1/rag/explain/{restriction} | Explain a restriction            |
| GET    | /api/v1/rag/knowledge             | List all RAG knowledge docs      |
| GET    | /api/v1/reports/pdf/{id}          | PDF nutrition report             |
| POST   | /api/v1/discharge/{id}            | Discharge + PDF report           |
| GET    | /api/v1/pqc/benchmark             | PQC speed benchmark              |
| GET    | /api/v1/pqc/status                | PQC status + key info            |
| GET    | /api/v1/whatsapp/status           | WhatsApp webhook status          |
| POST   | /api/v1/whatsapp/webhook          | WhatsApp meal log webhook        |

---

## WhatsApp Integration

- Provider: **Twilio**
- Webhook: `POST /api/v1/whatsapp/webhook`
- 9 languages: EN, HI, TE, TA, KN, MR, BN, GU, PA
- Consumption levels: "Ate fully" / "Partially" / "Refused"
- 48h refusal streak → automatic dietitian alert
- Photo tray analysis via Gemini Vision (same as SOTA 1)

---

## RAG Knowledge Base

10 signed clinical documents (`CKB_001` – `CKB_010`):
1. Potassium Restriction in CKD (NKF 2023)
2. Phosphorus Restriction CKD (KDOQI 2020)
3. Diabetic Diet GI Management (ADA 2024)
4. Post-Surgical Nutrition Liquid→Soft (ESPEN 2021)
5. Sodium Restriction Guidelines (IHA 2023)
6. Protein Requirements ICU (ASPEN 2022)
7. Traditional Indian Foods in Clinical Nutrition Management (IDA 2021)
8. Fluid Restriction Renal (KDIGO 2023)
9. Ragi in Diabetic Management (IIMR Research)
10. 30-Day Home Nutrition Post-Discharge (WHO 2023)

Primary AI: **Ollama** (`qwen2.5:7b`)  
Fallback AI: **Gemini** (`gemini-2.5-flash`)

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ImportError: cannot import name 'ask_ollama'` | `ask_ollama` not defined in `ollama_client.py` | Add `ask_ollama = quick_response` to `ollama_client.py` |
| `Connection refused :8179` | Backend not started | Run `py -3.11 -m uvicorn main:app --port 8179` |
| `Connection refused :11434` | Ollama not running | Run `ollama serve` |
| `GEMINI_API_KEY not set` | Missing `.env` | Copy `.env.template` to `.env` and fill keys |
| `ModuleNotFoundError: reportlab` | Not installed | Run `pip install reportlab==4.2.5` |
| `ModuleNotFoundError: dilithium` | Not installed | Run `pip install dilithium-py==1.4.0` — PQC falls back to HMAC-SHA3 sim if missing |
| PDF download 500 error | ReportLab fail | Check `REPORTLAB_AVAILABLE` flag in `report_generator.py`; plain text fallback activates |
| Meal plan returns empty | DuckDB cold start | Generate plan first via `POST /api/v1/generate_meal_plan` before querying compliance |

---

## Architecture Notes

- **DuckDB** is used in two modes:
  - CAP³S tables: `meal_logs`, `meal_plans`, `diet_updates` (in-memory + file `backend/analytics.duckdb`)
  - AgriSahayak legacy tables: `disease_analytics`, `price_analytics`, `yield_analytics`, `land_polygons` (unused in CAP³S UI but present in `duckdb_engine.py`)
- **Knapsack optimizer** uses 0-1 DP with protein-density value function over 5g granularity
- **Meal names** are generated by Gemini (with restrictions hard-blocked at TOP of prompt to prevent unsafe suggestions)
- **PQC keys** are generated fresh if not found in `backend/pqc_keys/` folder
- **Sentence-transformers** (`all-MiniLM-L6-v2`) used for semantic RAG retrieval — downloads ~90MB model on first run
