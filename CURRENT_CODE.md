# CAP³S — Current Code Snapshot
> All ports updated to **8179**. Generated March 9, 2026.

---

## Ports at a Glance

| Service | Port |
|---|---|
| Vite frontend | `5179` |
| FastAPI backend | `8179` |
| Vite → API proxy | `/api` → `localhost:8179` |

---

## `start.py`

```python
"""
CAP³S Smart Startup Script — with staged progress bars
Python 3.11.9 | RTX 3050 CUDA | AgriSahayak-proven torch versions
"""
import subprocess, os, sys, shutil, threading, time, webbrowser, re
from pathlib import Path

ROOT    = Path(__file__).parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
PY = "py -3.11"

BAR_WIDTH = 40

def _bar(pct, label=""):
    filled = int(BAR_WIDTH * pct / 100)
    bar = "█" * filled + "░" * (BAR_WIDTH - filled)
    return f"\r  [{bar}] {pct:5.1f}%  {label:<40}"

def _stage(n, total, name):
    print(f"\n{'─'*60}\n  STAGE {n}/{total}  {name}\n{'─'*60}")

def _ok(msg):   print(f"\n  ✅  {msg}")
def _warn(msg): print(f"\n  ⚠️   {msg}")
def _fail(msg): print(f"\n  ❌  {msg}")

# Stage 1 — env check
def check_env():
    env_file = BACKEND / ".env"
    if not env_file.exists():
        template = BACKEND / ".env.template"
        if template.exists():
            shutil.copy(template, env_file)
            _warn("Created .env from template — add GEMINI_API_KEY for full features")
        else:
            _warn(".env missing — Gemini features will use demo mode")
    else:
        content = env_file.read_text()
        if "your_gemini_key_here" in content:
            _warn("GEMINI_API_KEY not set — Tray Vision demo mode")
        else:
            _ok(".env found — full Gemini Vision enabled")

# Stage 4 — backend
def start_backend():
    print("\n  Launching FastAPI on http://0.0.0.0:8179 ...")
    os.chdir(BACKEND)
    subprocess.run(
        f"{PY} -m uvicorn main:app --host 0.0.0.0 --port 8179 --reload --log-level info",
        shell=True, cwd=BACKEND,
    )

# Stage 5 — frontend
def start_frontend():
    if not FRONTEND.exists():
        _warn("Frontend folder not found — skipping"); return
    print("\n  Launching React Vite on http://localhost:5179 ...")
    subprocess.run("npm run dev", shell=True, cwd=FRONTEND)

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  CAP³S — Clinical Nutrition Care Agent")
    print("="*60)

    _stage(1, 5, "Environment Check");           check_env()
    _stage(2, 5, "Python Dependencies");         install_requirements()
    _stage(3, 5, "Frontend Dependencies");       install_frontend_deps()

    _stage(4, 5, "Backend Server  (FastAPI + Uvicorn :8179)")
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()

    import urllib.request, urllib.error
    print("\n  Waiting for backend ...", end="", flush=True)
    for attempt in range(30):
        time.sleep(1)
        try:
            urllib.request.urlopen("http://localhost:8179/health", timeout=2)
            _ok("Backend ready at http://localhost:8179"); break
        except Exception:
            continue
    else:
        _warn("Backend did not respond in 30s")

    _stage(5, 5, "Frontend Dev Server  (Vite :5179)")
    frontend_thread = threading.Thread(target=start_frontend, daemon=True)
    frontend_thread.start()
    time.sleep(3)
    webbrowser.open("http://localhost:5179")

    print("\n" + "="*60)
    print("  🏥  Dashboard  : http://localhost:5179")
    print("  📖  API Docs   : http://localhost:8179/docs")
    print("  ❤️   Health     : http://localhost:8179/health")
    print("  🧬  Food-Drug  : http://localhost:8179/api/v1/food-drug/patient/P001")
    print("  📦  Burn-Rate  : http://localhost:8179/api/v1/kitchen/burn-rate")
    print("  🔐  PQ-RAG     : http://localhost:8179/api/v1/rag/verified-query")
    print("  📸  Tray Demo  : http://localhost:8179/api/v1/tray/demo?patient_id=P001")
    print("="*60)
    print("\n  Press Ctrl+C to stop all servers\n")

    try:
        backend_thread.join()
    except KeyboardInterrupt:
        print("\n\n  👋  Shutting down CAP³S — goodbye!\n")
```

---

## `backend/main.py` — Key sections

### Entry point
```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8179, reload=True)
```

### Dietitian AI endpoint
```python
@app.post("/api/v1/ask_dietitian_ai", tags=["AI Assistant"])
async def ask_dietitian_ai(request: AskDietitianRequest):
    """Ollama primary, Gemini fallback."""
    p = patients_db.get(request.patient_id)
    if not p: raise HTTPException(404, "Patient not found")
    system = f"You are a clinical dietitian AI. Patient: {p['name']}, Diagnosis: {p['diagnosis']}, Restrictions: {', '.join(p['restrictions'])}"
    try:
        from ollama_client import ask_ollama
        resp = await ask_ollama(request.question, system=system)
        return {"response": resp, "source": "ollama"}
    except Exception:
        resp = await ask_gemini(request.question, system=system)
        return {"response": resp, "source": "gemini-fallback"}
```

### Health endpoint
```python
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "CAP³S", ...}
```

---

## `backend/whatsapp.py` — BASE_URL

```python
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8179")
```

---

## `frontend/vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    proxy: {
      '/api': {
        target: 'http://localhost:8179',
        changeOrigin: true,
      },
    },
  },
})
```

---

## `frontend/src/api/client.js`

```js
const BASE_URL = '/api/v1'   // Vite proxies /api → localhost:8179

export async function apiGet(path, params) { ... }
export async function apiPost(path, body) { ... }
export function invalidateCache(path) { ... }
export function useOnlineStatus() { ... }
```

---

## `frontend/src/pages/DietitianAI.jsx` — Chat send()

```jsx
async function send() {
  const text = input.trim(); if (!text || loading) return
  setInput('')
  setMessages(m => [...m, { role: 'user', content: text }])
  setLoading(true)

  const r = await fetch('/api/v1/ask_dietitian_ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, question: text })
  }).then(r => r.json())
    .catch(() => ({ response: '⚠ Could not reach dietitian AI. Is the backend running?' }))

  setMessages(m => [...m, {
    role: 'assistant',
    content: r.response || r.answer || r.error || 'No response',
    sources: r.sources
  }])
  setLoading(false)
}
```

---

## How to run

```powershell
# Terminal 1 — Backend
cd backend
py -3.11 -m uvicorn main:app --host 0.0.0.0 --port 8179 --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
# → http://localhost:5179

# Or all-in-one:
py start.py
```
