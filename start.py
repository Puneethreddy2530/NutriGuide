"""
start.py — NutriGuide One-Command Launcher (Glitchcon 2.0)
  * Creates .venv with Python 3.11 on first run
  * Re-installs packages ONLY when requirements.txt changes (hash stamp)
  * Cleans up ports before launch (PowerShell-based, no deprecated wmic)
  * Launches backend (uvicorn port 8179) + frontend (vite port 5179)

Usage: python start.py
"""

import subprocess, sys, os, time, threading, hashlib, shutil, signal
from pathlib import Path

# Force UTF-8 output so block-art banner renders on Windows (cp1252 default)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT     = Path(__file__).parent
BACKEND  = ROOT / "backend"
FRONTEND = ROOT / "frontend"
WA_BOT   = ROOT / "whatsapp-bot"
VENV     = ROOT / ".venv"
REQS     = BACKEND / "requirements.txt"

BACKEND_PORT  = 8179
FRONTEND_PORT = 5179
PYTHON_TARGET = "3.11"

G = "\033[92m"; T = "\033[96m"; Y = "\033[93m"; R = "\033[91m"
B = "\033[1m";  X = "\033[0m"

def ok(m):   print(f"{G}  [OK]{X}  {m}")
def warn(m): print(f"{Y} [WARN]{X} {m}")
def err(m):  print(f"{R} [ERR]{X}  {m}")
def info(m): print(f"{T} [INFO]{X} {m}")


def banner():
    print(f"""
{T}{B}
  ___   _   ____   ____  ____
 / __| / \ |  _ \ |__ / / ___|
| |   / _ \| |_) | / /  \___ \
| |__/ ___ \  __/ / /__ ___) |
 \___/_/   \_|   /_____|____/

Clinical Nutrition Care Agent
GLITCHCON 2.0 -- G. Kathir Memorial Hospital{X}

  {T}Backend:{X}   http://localhost:{BACKEND_PORT}
  {T}API Docs:{X}  http://localhost:{BACKEND_PORT}/docs
  {T}Frontend:{X}  http://localhost:{FRONTEND_PORT}
  {T}WhatsApp:{X}  node whatsapp-bot/bot.js  (QR in terminal)
""")


# -- venv helpers --------------------------------------------------------------

def find_python311() -> str:
    # On Windows the py launcher supports explicit version selection
    if sys.platform == "win32":
        for candidate in ["py -3.11", "py"]:
            exe, *args = candidate.split()
            if not shutil.which(exe):
                continue
            try:
                out = subprocess.check_output(
                    [exe] + args + ["--version"], stderr=subprocess.STDOUT, text=True
                ).strip()
                if PYTHON_TARGET in out:
                    # Return a form we can pass to subprocess as a list later;
                    # store as a special token and handle in ensure_venv
                    return exe if not args else " ".join([exe] + args)
            except Exception:
                pass

    for exe in ["python3.11", "python3", "python"]:
        if not shutil.which(exe):
            continue
        try:
            out = subprocess.check_output(
                [exe, "--version"], stderr=subprocess.STDOUT, text=True
            ).strip()
            if PYTHON_TARGET in out:
                return exe
        except Exception:
            pass
    return sys.executable   # fallback: current interpreter


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")


STAMP = VENV / ".reqs_hash"

def reqs_hash() -> str:
    return hashlib.md5(REQS.read_bytes()).hexdigest() if REQS.exists() else ""


def ensure_venv():
    py_exe = venv_python()

    # If existing venv is the wrong Python version, nuke it
    if py_exe.exists():
        try:
            out = subprocess.check_output(
                [str(py_exe), "--version"], stderr=subprocess.STDOUT, text=True
            ).strip()
            if PYTHON_TARGET not in out:
                warn(f"Existing .venv is {out}, need {PYTHON_TARGET} — rebuilding...")
                import shutil as _sh
                _sh.rmtree(VENV)
                if STAMP.exists():
                    STAMP.unlink()
        except Exception:
            pass

    if not py_exe.exists():
        base_str = find_python311()
        base_cmd = base_str.split()          # e.g. ["py", "-3.11"] or ["python3.11"]
        base_exe = base_cmd[0]
        if not shutil.which(base_exe):
            err(f"Cannot find Python {PYTHON_TARGET}. Install it and re-run.")
            sys.exit(1)
        info(f"Creating .venv with Python {PYTHON_TARGET} ({base_str})...")
        subprocess.run(base_cmd + ["-m", "venv", str(VENV)], check=True)
        ok(".venv created")

    current = reqs_hash()
    saved   = STAMP.read_text(encoding="utf-8").strip() if STAMP.exists() else ""

    if current == saved:
        ok("Dependencies up to date - skipping pip install")
        return

    info("Installing / updating backend dependencies...")
    pip = str(py_exe)
    subprocess.run([pip, "-m", "pip", "install", "--upgrade", "pip", "-q"], check=True)
    subprocess.run([pip, "-m", "pip", "install", "-r", str(REQS), "-q"], check=True)
    STAMP.write_text(current)
    ok("pip install complete")


# -- DuckDB stale lock cleanup ------------------------------------------------

def clean_duckdb_locks():
    """Remove stale DuckDB WAL/lock files before starting the backend.
    We intentionally do NOT import duckdb here — doing so in the launcher
    process can interfere with the backend subprocess's own connection.
    backend/main.py already has a 12-second retry loop for lock contention."""
    db = BACKEND / "analytics.duckdb"
    for suffix in [".wal", ".lock"]:
        stale = Path(str(db) + suffix)
        if stale.exists():
            try:
                stale.unlink()
                warn(f"Removed stale DuckDB file: {stale.name}")
            except OSError as e:
                warn(f"Could not remove {stale.name}: {e} — backend will retry on its own")
    if db.exists():
        ok("DuckDB stale locks cleared — backend will claim the file")


# -- port/process cleanup -----------------------------------------------------

def free_port(port: int):
    """Kill any process tree listening on *port*.
    Uses taskkill /F /T on Windows so uvicorn --reload worker children
    (which hold DuckDB locks) are also terminated."""
    try:
        if sys.platform == "win32":
            # Get owning PIDs via PowerShell (wmic is deprecated on Win11)
            # Always query — socket probe can miss TIME_WAIT or CLOSE_WAIT states
            ps_script = (
                f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue"
                " | Where-Object {{ $_.OwningProcess -ne 0 }}"
                " | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique"
            )
            out = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", ps_script],
                text=True, timeout=8, stderr=subprocess.DEVNULL,
            ).strip()
            for pid_str in out.splitlines():
                pid_str = pid_str.strip()
                if pid_str.isdigit() and int(pid_str) > 0:
                    # /T kills the entire process tree so child workers die too
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", pid_str],
                        capture_output=True,
                    )
                    warn(f"Killed PID {pid_str} (tree) on port {port}")
        else:
            import socket
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(("127.0.0.1", port)) != 0:
                    return  # nothing listening
            out = subprocess.check_output(
                ["lsof", "-ti", f":{port}"], text=True, stderr=subprocess.DEVNULL
            ).strip()
            for pid in out.splitlines():
                subprocess.run(["kill", "-9", pid], capture_output=True)
                warn(f"Killed PID {pid} on port {port}")
    except Exception:
        pass


def free_backend_procs():
    """Kill stray Python processes running uvicorn/main.py or holding the DuckDB file.
    Catches orphaned reload workers that survive port cleanup."""
    if sys.platform != "win32":
        return
    own_pid = os.getpid()
    try:
        ps_script = (
            "Get-CimInstance Win32_Process"
            " | Where-Object { $_.Name -match 'python' -and"
            " ($_.CommandLine -match 'uvicorn|main:app|main\\.py'"
            " -or $_.CommandLine -match 'analytics\\.duckdb')"
            f" -and $_.ProcessId -ne {own_pid} }}"
            " | ForEach-Object {"
            "   taskkill /F /T /PID $_.ProcessId 2>$null | Out-Null;"
            "   Write-Output $_.ProcessId"
            " }"
        )
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", ps_script],
            text=True, timeout=12, stderr=subprocess.DEVNULL,
        ).strip()
        for pid_str in out.splitlines():
            if pid_str.strip():
                warn(f"Killed stray backend process PID {pid_str.strip()}")
    except Exception:
        pass


# -- .env check ----------------------------------------------------------------

def check_env():
    env_path = BACKEND / ".env"
    if not env_path.exists():
        template = BACKEND / ".env.template"
        if template.exists():
            import shutil as _sh
            _sh.copy(template, env_path)
            warn(".env created from template in backend/ — add your AZURE_OPENAI_API_KEY!")
        else:
            env_path.write_text(
                "AZURE_OPENAI_API_KEY=\n"
                "AZURE_OPENAI_ENDPOINT=\n"
                "AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o\n"
                "AZURE_OPENAI_API_VERSION=2025-01-01-preview\n"
                "GUPSHUP_API_KEY=\n"
                "GUPSHUP_SOURCE_NUMBER=\n"
                "GUPSHUP_APP_NAME=Nutriguide\n"
                "OLLAMA_URL=http://localhost:11434\n"
                "OLLAMA_MODEL=qwen2.5:7b\n"
                "FRONTEND_URL=http://localhost:5179\n"
            )
            warn(".env created in backend/ — add your AZURE_OPENAI_API_KEY")

    # Load .env into os.environ so subprocesses spawned from here inherit them,
    # and so the status check below reflects the actual runtime values.
    try:
        from dotenv import load_dotenv as _lde
        _lde(env_path, override=False)
    except ImportError:
        # python-dotenv not yet installed (first run before pip install) — fall back
        # to manual parse so the status message is still accurate.
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                k, _, v = line.partition("=")
                k = k.strip()
                if k and not k.startswith("#") and k not in os.environ:
                    os.environ[k] = v.strip()
        except Exception:
            pass

    api_key = os.getenv("AZURE_OPENAI_API_KEY", "")
    if api_key:
        ok("AZURE_OPENAI_API_KEY configured  [GPT-4o chat + vision + Whisper active]")
    else:
        warn("AZURE_OPENAI_API_KEY not set — AI features will use fallback responses")


# -- output streaming ----------------------------------------------------------

def stream(proc, label, colour):
    for line in iter(proc.stdout.readline, b""):
        print(f"{colour}[{label}]{X} {line.decode('utf-8', 'replace').rstrip()}")


# -- main ----------------------------------------------------------------------

def run():
    banner()

    ensure_venv()
    check_env()

    # Free ports and stray procs — two passes to catch all child workers
    info("Cleaning up stale processes...")
    for _ in range(2):
        free_port(BACKEND_PORT)
        free_port(FRONTEND_PORT)
        free_backend_procs()
        time.sleep(1)  # let the OS release sockets between passes
    info("Waiting for ports to release...")
    time.sleep(2)              # let OS fully release file handles and sockets

    # Remove any stale DuckDB WAL/lock left by a previously crashed backend
    clean_duckdb_locks()

    py  = str(venv_python())
    npm = shutil.which("npm") or "npm"
    procs = []

    # Local AI (Ollama)
    import urllib.request as _ur
    ollama = shutil.which("ollama")
    if ollama:
        _ollama_up = False
        try:
            with _ur.urlopen("http://127.0.0.1:11434/", timeout=1) as _r:
                _ollama_up = True
        except Exception:
            pass

        if not _ollama_up:
            print(f"\n{T}Starting Ollama (Local AI Engine)...{X}")
            # Run "ollama serve"
            ollama_proc = subprocess.Popen(
                [ollama, "serve"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT
            )
            procs.append(ollama_proc)
            threading.Thread(target=stream, args=(ollama_proc, "OLLAMA", T), daemon=True).start()
            
            info("Waiting for Ollama to be ready (up to 15s)...")
            for _i in range(15):
                time.sleep(1)
                if ollama_proc.poll() is not None:
                    err(f"Ollama exited early (code {ollama_proc.poll()})")
                    break
                try:
                    with _ur.urlopen("http://127.0.0.1:11434/", timeout=1) as _r:
                        if _r.status == 200:
                            _ollama_up = True
                            ok("Ollama is ready at http://localhost:11434")
                            break
                except Exception:
                    pass
            
            if not _ollama_up and ollama_proc.poll() is None:
                warn("Ollama did not respond on port 11434 in time — continuing anyway")
        else:
            ok("Ollama is already running (port 11434)")
    else:
        warn("Ollama not found in PATH — local AI features will fail unless Azure OpenAI is configured")

    # Backend

    if not (BACKEND / "main.py").exists():
        err("backend/main.py not found")
        sys.exit(1)

    print(f"\n{T}Starting backend...{X}")
    # No --reload: avoids Windows multiprocessing spawn issues that crash
    # the uvicorn worker (SpawnProcess-1) and release the DuckDB file lock.
    bp = subprocess.Popen(
        [py, "-m", "uvicorn", "main:app",
         "--port", str(BACKEND_PORT), "--host", "0.0.0.0",
         "--log-level", "info"],
        cwd=BACKEND, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    procs.append(bp)
    threading.Thread(target=stream, args=(bp, "BACK", T), daemon=True).start()

    # Wait for backend to actually serve HTTP (up to 60 s).
    # Heavy imports (transformers, duckdb, torch) can take 20-30 s on first run.
    # We probe /health (lightweight JSON) not /docs (full OpenAPI render).
    _backend_ready = False
    import urllib.request as _ur
    info("Waiting for backend to start (this may take 10-30 s)...")
    for _i in range(60):
        time.sleep(1)
        if bp.poll() is not None:
            err(f"Backend exited early (code {bp.poll()}) — check [BACK] output above")
            break
        try:
            with _ur.urlopen(f"http://127.0.0.1:{BACKEND_PORT}/health", timeout=3) as _r:
                if _r.status == 200:
                    _backend_ready = True
                    ok(f"Backend ready at http://localhost:{BACKEND_PORT}")
                    break
        except Exception:
            pass  # not ready yet
    if not _backend_ready and bp.poll() is None:
        warn("Backend did not respond in 60 s — starting frontend anyway")

    # Frontend
    print(f"\n{G}Starting frontend...{X}")
    if (FRONTEND / "package.json").exists():
        if not (FRONTEND / "node_modules").exists():
            info("npm install (first run)...")
            subprocess.run([npm, "install"], cwd=FRONTEND, check=True,
                           shell=(sys.platform == "win32"))
        fp = subprocess.Popen(
            # On Windows, shell=True with a list ignores all args after the first.
            # Use a string command so the full argument list is passed correctly.
            f'"{npm}" run dev -- --port {FRONTEND_PORT} --strictPort'
            if sys.platform == "win32"
            else [npm, "run", "dev", "--", "--port", str(FRONTEND_PORT), "--strictPort"],
            cwd=FRONTEND,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            shell=(sys.platform == "win32"),
        )
        procs.append(fp)
        threading.Thread(target=stream, args=(fp, "FRONT", G), daemon=True).start()
    else:
        warn("frontend/package.json not found - skipping frontend")

    # WhatsApp bot (node)
    node = shutil.which("node")
    wa_proc = None
    if node and (WA_BOT / "bot.js").exists():
        # Kill any stray node bot.js left from a previous run that still holds
        # the Puppeteer Chrome userDataDir lock (.wwebjs_auth/session).
        if sys.platform == "win32":
            try:
                ps_kill = (
                    "Get-CimInstance Win32_Process"
                    " | Where-Object { $_.Name -match 'node' -and"
                    " $_.CommandLine -match 'bot\\.js' }"
                    " | ForEach-Object { taskkill /F /T /PID $_.ProcessId 2>$null; Write-Output $_.ProcessId }"
                )
                out = subprocess.check_output(
                    ["powershell", "-NoProfile", "-Command", ps_kill],
                    text=True, timeout=8, stderr=subprocess.DEVNULL,
                ).strip()
                for pid_str in out.splitlines():
                    if pid_str.strip():
                        warn(f"Killed stray node bot.js PID {pid_str.strip()}")
                if out.strip():
                    time.sleep(2)  # let Puppeteer release the profile lock
            except Exception:
                pass
        if not (WA_BOT / "node_modules").exists():
            info("npm install for whatsapp-bot (first run)...")
            subprocess.run([npm, "install"], cwd=WA_BOT, check=True,
                           shell=(sys.platform == "win32"))
        print(f"\n{Y}Starting WhatsApp bot...{X}")
        wa_proc = subprocess.Popen(
            [node, "bot.js"],
            cwd=WA_BOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        threading.Thread(target=stream, args=(wa_proc, "WA", Y), daemon=True).start()
        ok("WhatsApp bot started — scan the QR code printed above")
    else:
        if not node:
            warn("node not found — skipping WhatsApp bot (install Node.js to enable)")
        else:
            warn("whatsapp-bot/bot.js not found — skipping WhatsApp bot")

    print(f"\n{B}{G}Nutriguide is running!  Ctrl+C to stop{X}\n")

    def shutdown(sig=None, frame=None):
        print(f"\n{Y}Shutting down...{X}")
        all_procs = list(procs) + ([wa_proc] if wa_proc is not None else [])
        for p in all_procs:
            try:
                if sys.platform == "win32":
                    # /T kills entire process tree — critical for shell=True
                    # which wraps node/vite inside cmd.exe
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(p.pid)],
                        capture_output=True, timeout=8,
                    )
                else:
                    os.killpg(os.getpgid(p.pid), signal.SIGTERM)
                p.wait(timeout=5)
            except Exception:
                try: p.kill()
                except Exception: pass
        # Safety net: kill anything still on our ports
        for port in [BACKEND_PORT, FRONTEND_PORT]:
            free_port(port)
        print("Goodbye!")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(3)
            # WA bot is optional — if it dies just warn, don't kill backend/frontend
            if wa_proc is not None and wa_proc.poll() is not None:
                warn("WhatsApp bot exited (see [WA] output above). Backend/frontend still running.")
                wa_proc = None  # stop checking so we only warn once
            # Critical processes: backend + frontend must stay up
            for p in procs:
                if p.poll() is not None:
                    err("A critical process exited unexpectedly. Shutting down...")
                    shutdown()
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    run()
