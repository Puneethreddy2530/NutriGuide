"""
start.py — CAP³S One-Command Launcher
=====================================
Starts backend (uvicorn port 8179) + frontend (vite port 5179) concurrently.

Usage:
    python start.py

Prerequisites:
    pip install -r backend/requirements.txt
    cd frontend && npm install
"""

import subprocess
import sys
import os
import time
import signal
import threading
from pathlib import Path

ROOT = Path(__file__).parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

BACKEND_PORT  = 8179
FRONTEND_PORT = 5179

GREEN  = "\033[92m"
TEAL   = "\033[96m"
YELLOW = "\033[93m"
RED    = "\033[91m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def banner():
    print(f"""
{TEAL}{BOLD}
 ██████  █████  ██████   ██████  ███████
██      ██   ██ ██   ██ ██       ██
██      ███████ ██████   ██████  ███████
██      ██   ██ ██            ██      ██
 ██████ ██   ██ ██       ██████  ███████

Clinical Nutrition Care Agent
GLITCHCON 2.0 — G. Kathir Memorial Hospital
{RESET}
{TEAL}Backend:  {RESET}http://localhost:{BACKEND_PORT}
{TEAL}API Docs: {RESET}http://localhost:{BACKEND_PORT}/docs
{TEAL}Frontend: {RESET}http://localhost:{FRONTEND_PORT}
""")


def check_env():
    """Check critical environment variables."""
    env_path = BACKEND / ".env"
    if not env_path.exists():
        template = BACKEND / ".env.template"
        if template.exists():
            import shutil
            shutil.copy(template, env_path)
            print(f"{YELLOW}⚠  Created .env from template. Add your GEMINI_API_KEY!{RESET}")
        else:
            print(f"{YELLOW}⚠  No .env found in backend/. Creating minimal .env{RESET}")
            env_path.write_text(
                "GEMINI_API_KEY=\n"
                "TWILIO_ACCOUNT_SID=\n"
                "TWILIO_AUTH_TOKEN=\n"
                "OLLAMA_URL=http://localhost:11434\n"
                "OLLAMA_MODEL=qwen2.5:7b\n"
            )

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        # Try reading from .env directly
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.split("=", 1)[1].strip()
    if not api_key:
        print(f"{YELLOW}⚠  GEMINI_API_KEY not set — meal naming will use fallback names{RESET}")
    else:
        print(f"{GREEN}✅ GEMINI_API_KEY configured{RESET}")


def stream_output(proc, prefix, colour):
    """Stream subprocess output with a coloured prefix."""
    for line in iter(proc.stdout.readline, b""):
        print(f"{colour}[{prefix}]{RESET} {line.decode('utf-8', errors='replace').rstrip()}")


def run():
    banner()
    check_env()

    procs = []

    # ── Backend ────────────────────────────────────────────────────
    print(f"\n{TEAL}Starting backend…{RESET}")
    if not (BACKEND / "main.py").exists():
        print(f"{RED}✗ backend/main.py not found{RESET}")
        sys.exit(1)

    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--reload", "--port", str(BACKEND_PORT), "--host", "0.0.0.0"],
        cwd=BACKEND,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    procs.append(backend_proc)
    threading.Thread(
        target=stream_output, args=(backend_proc, "BACKEND", TEAL), daemon=True
    ).start()

    time.sleep(2)  # Let backend initialize before starting frontend

    # ── Frontend ───────────────────────────────────────────────────
    print(f"\n{GREEN}Starting frontend…{RESET}")
    if not (FRONTEND / "package.json").exists():
        print(f"{YELLOW}⚠  frontend/package.json not found — skipping frontend{RESET}")
    else:
        # Check if node_modules exists
        if not (FRONTEND / "node_modules").exists():
            print(f"{YELLOW}Installing frontend dependencies…{RESET}")
            subprocess.run(["npm", "install"], cwd=FRONTEND, check=True)

        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=FRONTEND,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            shell=(sys.platform == "win32"),
        )
        procs.append(frontend_proc)
        threading.Thread(
            target=stream_output, args=(frontend_proc, "FRONTEND", GREEN), daemon=True
        ).start()

    print(f"\n{BOLD}{GREEN}✅ CAP³S is running!{RESET}")
    print(f"{TEAL}Press Ctrl+C to stop all services{RESET}\n")

    # ── Graceful shutdown ──────────────────────────────────────────
    def shutdown(sig, frame):
        print(f"\n{YELLOW}Shutting down CAP³S…{RESET}")
        for p in procs:
            try:
                p.terminate()
                p.wait(timeout=5)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        print(f"{GREEN}Goodbye! 👋{RESET}")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Wait for processes
    try:
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        shutdown(None, None)


if __name__ == "__main__":
    run()
