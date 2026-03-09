# CAP³S — Complete Bug Fix Guide

Every crash, silent failure, and mismatch identified from a full line-by-line read of both files.
Fixes are ordered by severity (crash > silent failure > wrong data).

---

## BUG 1 — CRASH: `whatsapp.py` circular import kills the bot on every webhook call

**File:** `backend/whatsapp.py` line 5232  
**File:** `backend/main.py` line 2080

### What's broken
```python
# whatsapp.py — inside the webhook handler
from main import patients_db, con   # ← circular import
```
`main.py` does `from whatsapp import router` at module load time. When the first webhook arrives, Python tries to re-import `main` from inside `whatsapp` — which is still being loaded. Python returns a partially-initialised module, so `patients_db` and `con` are NOT yet defined. Result: `ImportError` or `AttributeError: module 'main' has no attribute 'patients_db'`. The bot is completely dead.

### Fix — 3 steps

**Step 1 — `whatsapp.py`: add module-level globals at the top (after the imports)**
```python
# ── injected by main.py after startup ─────────────────────────
patients_db: dict = {}
con = None          # duckdb.DuckDBPyConnection, set by main.py
```

**Step 2 — `whatsapp.py`: DELETE the circular import line inside the webhook**
```python
# DELETE this line (line 5232):
from main import patients_db, con
```
The rest of the webhook already uses `patients_db` and `con` as bare names — those will now resolve to the module-level globals above.

**Step 3 — `main.py`: inject the references after the router is registered**
```python
# Existing line (line 2080-2081):
from whatsapp import router as whatsapp_router
app.include_router(whatsapp_router, prefix="/api/v1/whatsapp", tags=["WhatsApp Bot"])

# ADD these two lines immediately after:
import whatsapp as _wa_module
_wa_module.patients_db = patients_db
_wa_module.con = con
```

---

## BUG 2 — CRASH: `pqc_sign()` passes `bytes` to `NeoPulseShield.sign()` which expects `str`

**File:** `backend/main.py` line 2118

### What's broken
```python
def pqc_sign(payload: str) -> str:
    if PQC_AVAILABLE and _pqc:
        try:
            sig = _pqc.sign(payload.encode())   # ← passes bytes
```

`NeoPulseShield.sign()` signature (line 3522):
```python
def sign(self, content: str) -> PQSignature:
    ...
    msg_bytes = content.encode("utf-8")   # ← calls .encode() on the arg itself
```
So you're calling `.encode()` on bytes (already encoded), which throws `AttributeError: 'bytes' object has no attribute 'encode'`. PQC signing crashes, falls through to the HMAC fallback silently — but if the `try/except` is ever removed, this would crash the endpoint.

### Fix
```python
def pqc_sign(payload: str) -> str:
    if PQC_AVAILABLE and _pqc:
        try:
            sig = _pqc.sign(payload)   # ← pass str, NOT payload.encode()
            return sig.tau_bind
        except Exception:
            pass
    import hashlib, hmac
    h = hashlib.sha3_256(f"SIM:{payload}".encode()).hexdigest()
    return f"SIM_DILITHIUM3_{h[:32]}"
```

---

## BUG 3 — CRASH: `report_generator.py` circular import of `pqc_sign`

**File:** `backend/report_generator.py` line 4758

### What's broken
```python
async def build_weekly_nutrition_report(...):
    ...
    from main import pqc_sign   # ← circular import at runtime
```
`main.py` calls `build_weekly_nutrition_report` (line 2533). `report_generator.py` then imports from `main`. Same circular dependency pattern as Bug 1 — will fail or return a stale module reference.

### Fix — pass `pqc_sign` as a parameter

**`report_generator.py` — change the function signature:**
```python
async def build_weekly_nutrition_report(
    patient_id: str,
    patients_db: dict,
    con: duckdb.DuckDBPyConnection,
    pqc_sign_fn,                      # ← add this
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> bytes:
    ...
    # DELETE: from main import pqc_sign
    sig = pqc_sign_fn(f"REPORT|{patient_id}|{start}|{end}|{compliance}")  # ← use it
```

**`main.py` — update the call site (line 2533):**
```python
pdf_bytes = await build_weekly_nutrition_report(
    patient_id, patients_db, con, pqc_sign,   # ← pass pqc_sign
    start_date, end_date
)
```

---

## BUG 4 — CRASH on startup: `_pqc.generate_keys()` regenerates keys on every restart

**File:** `backend/main.py` line 2004

### What's broken
```python
_pqc = NeoPulseShield()
_pqc.generate_keys()    # ← generates fresh keys, never loads saved ones
```
`generate_keys()` creates a new Dilithium3 key pair and discards any previously saved keys. Every restart invalidates all previously-signed records. `load_or_generate_keys()` exists specifically to load from disk and only generate if not found.

Additionally, `generate_keys()` does NOT call `save_keys()` — so keys aren't even persisted. The PQC layer is effectively stateless across restarts.

### Fix
```python
_pqc = NeoPulseShield()
_pqc.load_or_generate_keys()    # ← loads from disk, generates+saves only if missing
```

---

## BUG 5 — CRASH: `check_meal_compliance` receives wrong payload from frontend (422 error)

**File:** `frontend/src/pages/MealPlan.jsx` line 5027  
**File:** `backend/main.py` line 2089-2092

### What's broken

Frontend sends:
```json
{ "patient_id": "P001", "meal_plan": [{ "day_number": 1, "meal_time": "breakfast", ... }] }
```

Backend `ComplianceCheckRequest` expects:
```python
class ComplianceCheckRequest(BaseModel):
    patient_id: str
    meal_items: List[str]   # ← flat list of ingredient name strings
    meal_name: str          # ← required, not sent at all
```

Pydantic will return HTTP 422 Unprocessable Entity every time "Check Compliance" is clicked. The frontend will silently swallow the error (the `.catch(() => null)` on line 5028 means `compliance` stays `null`).

### Fix — update the frontend to send the correct shape

In `MealPlan.jsx`, replace the `checkCompliance` function:
```jsx
async function checkCompliance() {
    if (!plan) return
    setChecking(true)
    // Flatten all meals in the plan to ingredient lists and check each day
    const dayMeals = plan.meal_plan?.filter(m => m.day_number === activeDay) || []
    const allIngredients = dayMeals.flatMap(m => m.ingredients || [])
    const mealName = dayMeals.map(m => m.dish_name).filter(Boolean).join(', ')

    const r = await fetch('/api/v1/check_meal_compliance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        meal_items: allIngredients,
        meal_name: mealName || 'Day plan'
      })
    }).then(r => r.json()).catch(() => null)
    setChecking(false)
    setCompliance(r)
}
```

---

## BUG 6 — CRASH: `ask_dietitian_ai` imports `ask_ollama` which doesn't exist

**File:** `backend/main.py` line 2424

### What's broken
```python
from ollama_client import ask_ollama   # ← does not exist
```

`ollama_client.py` exports: `chat()`, `quick_response()`, `stream_response()`, `resolve_model()`, `is_ollama_running()`, `detect_crisis()`. There is NO `ask_ollama` function. This throws `ImportError` and the endpoint crashes.

### Fix
```python
async def ask_dietitian_ai(request: AskDietitianRequest):
    p = patients_db.get(request.patient_id)
    if not p: raise HTTPException(404, "Patient not found")
    system = f"You are a clinical dietitian AI. Patient: {p['name']}, Diagnosis: {p['diagnosis']}, Restrictions: {', '.join(p['restrictions'])}"
    try:
        from ollama_client import quick_response   # ← correct function name
        resp = await quick_response(request.question, mode="general_health")
        return {"response": resp, "source": "ollama"}
    except Exception:
        resp = await ask_gemini(request.question, system=system)
        return {"response": resp, "source": "gemini-fallback"}
```

---

## BUG 7 — SILENT FAILURE: `dashboard` returns `language_name` but `whatsapp.py` reads `language`

**File:** `backend/main.py` line 2444  
**File:** `backend/whatsapp.py` line 5243

### What's broken
`dashboard` endpoint returns:
```python
"language": p["language_name"]   # e.g. "Telugu", "Tamil"
```

But `whatsapp.py` reads:
```python
lang = patient.get("language", "en")
```
And then uses `lang` as a key in `REPLY_TEMPLATES` which has keys `"te"`, `"ta"`, `"hi"`, `"en"`. 

So a Telugu patient gets `"Telugu"` as their lang key, which doesn't match any template, falls back to English, and all bot replies are in English regardless of patient language.

### Fix — two options (pick one)

**Option A (recommended): ensure `patients.json` has a `"language"` field with the 2-letter code**
```json
{
  "id": "P001",
  "name": "Ravi Kumar",
  "language": "hi",
  "language_name": "Hindi",
  ...
}
```
The `whatsapp.py` line `patient.get("language", "en")` will then work correctly.

**Option B: fix `whatsapp.py` to map language name → code**
```python
LANG_CODE_MAP = {
    "Telugu": "te", "Tamil": "ta", "Hindi": "hi",
    "Marathi": "mr", "Gujarati": "gu", "Kannada": "kn",
    "Bengali": "bn", "Punjabi": "pa", "English": "en"
}
lang_raw = patient.get("language", patient.get("language_name", "en"))
lang = LANG_CODE_MAP.get(lang_raw, lang_raw[:2].lower() if len(lang_raw) > 2 else "en")
```

---

## BUG 8 — SILENT FAILURE: `con.execute()` in whatsapp.py will crash if Bug 1 fix isn't applied

This is a consequence of Bug 1. After applying Bug 1's fix, `con` will be properly injected. But if for any reason `con` is still `None` (e.g., main.py failed to inject), line 5289 will crash:
```python
con.execute("INSERT INTO meal_logs VALUES (?, ?, ?, ?, ?, ?)", [...])
```

**Add a guard in `whatsapp.py` webhook handler:**
```python
if con is None:
    logger.error("WhatsApp webhook: DuckDB connection not injected. Bot cannot log meals.")
    return twiml_response("⚠️ System error — please contact the hospital. (DB not ready)")
```
Add this right after the `patients_db`/`con` are used to look up the patient.

---

## BUG 9 — WRONG DATA: `dashboard` endpoint sends `language_name` as `language` to frontend

**File:** `backend/main.py` line 2444  
**File:** `frontend/src/pages/Dashboard.jsx` line 4411 and `Reports.jsx` line 5489

### What's broken
The dashboard API returns `"language": p["language_name"]` (e.g. `"Telugu"`).  
The frontend displays: `{p.id} · {p.language}` and `Language: {patient.language}`.

This actually *displays* fine (shows "Telugu") but the `Reports.jsx` discharge modal (line 5496) says:
```jsx
`In ${patient.language} using Gemini 2.5 Flash`
```
So it shows "In Telugu" which is correct display-wise — but if any backend code reads this `language` field expecting a 2-letter code, it breaks (see Bug 7).

**Fix:** In `patients.json`, always store BOTH fields. The dashboard API is fine as-is for display, as long as `whatsapp.py` reads the correct `language` code field (Option A from Bug 7).

---

## BUG 10 — MISSING ENDPOINT: `FoodDrugGraph` and `KitchenBurnRate` — endpoints exist, check vite proxy

**Files:** `frontend/src/components/FoodDrugGraph.jsx` line 2984, `KitchenBurnRate.jsx` line 3184

### What was suspected (but is actually fine)
The endpoints DO exist in `main.py`:
- `GET /api/v1/food-drug/patient/{patient_id}` (line 2846) ✓
- `GET /api/v1/kitchen/burn-rate` (line 3000) ✓

### What might still fail
The frontend fetches these as bare `/api/v1/...` paths. This only works if `vite.config.js` has a proxy configured:

```js
// vite.config.js — verify this exists:
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8179'
    }
  }
})
```
If the proxy is missing, all fetch calls return 404 in dev. **Check your `vite.config.js`.**

---

## BUG 11 — WRONG DATA: `meal_logs` table INSERT missing `log_date` index leading to DuckDB type error

**File:** `backend/whatsapp.py` line 5289-5292

### What's broken
```python
con.execute(
    "INSERT INTO meal_logs VALUES (?, ?, ?, ?, ?, ?)",
    [patient_id, today, meal_time, consumption, datetime.now(), body[:200]]
)
```
`today = str(date.today())` — this is a `str`, but the schema says `log_date DATE`. DuckDB will auto-cast `str → DATE` when the format is `YYYY-MM-DD`, so this usually works. However the `logged_at` column is `TIMESTAMP` and `datetime.now()` is correct there.

The refusal check on line 5295 uses `logged_at >= CURRENT_TIMESTAMP - INTERVAL '48' HOUR`. This is correct.

**No change needed here** — just verify `today` is always in `YYYY-MM-DD` format (it is, via `str(date.today())`).

---

## BUG 12 — POTENTIAL CRASH: `generate_meal_plan` fallback plan `_demo_plan()` may have shape mismatch

**File:** `backend/main.py` line 2227 and 2469

### What's broken
When the knapsack pipeline fails, the fallback is:
```python
return {"status": "fallback", "message": str(e), "plan": _demo_plan(...)}
```

But the frontend reads `r.meal_plan` (line 5019 `setPlan(r)` then line 5033 `plan?.meal_plan`). The fallback returns `plan` (nested key), not `meal_plan` at top level.

Check `_demo_plan()` at line 2469 — if it returns a dict without `meal_plan` key, the UI will show nothing with no error (just empty state).

### Fix — ensure fallback matches the success response shape:
```python
except Exception as e:
    logger.error(f"Knapsack pipeline failed: {e}")
    demo = _demo_plan(request.patient_id, p, request.duration_days)
    return {
        "status": "fallback",
        "message": str(e),
        "meal_plan": demo.get("meal_plan", demo),   # ← expose meal_plan at top level
        "plan": demo
    }
```

---

## Summary Table

| # | Severity | File | Line | Issue | Fix |
|---|----------|------|------|-------|-----|
| 1 | 🔴 CRASH | `whatsapp.py` | 5232 | Circular import — bot dead on every call | Module-level globals + inject from main.py |
| 2 | 🔴 CRASH | `main.py` | 2118 | `pqc_sign` passes `bytes` to `sign(str)` | Change `payload.encode()` → `payload` |
| 3 | 🔴 CRASH | `report_generator.py` | 4758 | Circular import of `pqc_sign` | Pass as parameter |
| 4 | 🟠 DATA | `main.py` | 2004 | `generate_keys()` resets PQC on every restart | Change to `load_or_generate_keys()` |
| 5 | 🔴 CRASH | `MealPlan.jsx` | 5027 | Wrong payload shape → 422 from backend | Flatten ingredients before sending |
| 6 | 🔴 CRASH | `main.py` | 2424 | `ask_ollama` doesn't exist in ollama_client | Change to `quick_response()` |
| 7 | 🟠 SILENT | `whatsapp.py` | 5243 | `language` key missing → always English replies | Add `language` field to patients.json |
| 8 | 🔴 CRASH | `whatsapp.py` | 5289 | `con` is None guard missing | Add None check + user-friendly TwiML error |
| 9 | 🟡 DISPLAY | `main.py` | 2444 | `language_name` sent as `language` | Fine for display; ensure patients.json has both |
| 10 | 🟡 ENV | `vite.config.js` | — | Proxy for `/api` may be missing | Verify `proxy: { '/api': 'http://localhost:8179' }` |
| 11 | ✅ OK | `whatsapp.py` | 5289 | `str` date → DuckDB DATE works | No change needed |
| 12 | 🟠 SILENT | `main.py` | 2227 | Fallback plan missing `meal_plan` top-level key | Expose `meal_plan` in fallback response |

---

## Quick Start: Apply all fixes in order

1. **`patients.json`** — add `"language": "hi"` (2-letter code) to every patient entry alongside existing `"language_name"`
2. **`backend/main.py`** — change `_pqc.generate_keys()` → `_pqc.load_or_generate_keys()` (Bug 4)
3. **`backend/main.py`** — change `_pqc.sign(payload.encode())` → `_pqc.sign(payload)` in `pqc_sign()` (Bug 2)
4. **`backend/main.py`** — change `from ollama_client import ask_ollama` → `from ollama_client import quick_response` and use `quick_response(request.question)` (Bug 6)
5. **`backend/main.py`** — after `app.include_router(whatsapp_router...)`, inject globals into whatsapp module (Bug 1, Step 3)
6. **`backend/main.py`** — update `build_weekly_nutrition_report` call to pass `pqc_sign` (Bug 3)
7. **`backend/whatsapp.py`** — add module-level `patients_db = {}` and `con = None` (Bug 1, Step 1)
8. **`backend/whatsapp.py`** — delete `from main import patients_db, con` inside the webhook (Bug 1, Step 2)
9. **`backend/whatsapp.py`** — add `if con is None: return twiml_response(...)` guard (Bug 8)
10. **`backend/report_generator.py`** — add `pqc_sign_fn` parameter, delete `from main import pqc_sign` (Bug 3)
11. **`frontend/src/pages/MealPlan.jsx`** — fix `checkCompliance` to send `meal_items` + `meal_name` (Bug 5)
12. **`frontend/vite.config.js`** — verify `/api` proxy to `http://localhost:8179` (Bug 10)
