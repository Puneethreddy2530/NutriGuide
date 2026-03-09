"""
start.py — CAP³S One-Command Launcher (Glitchcon 2.0)
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
 ██████  █████  ██████   ██████  ███████
██      ██   ██ ██   ██ ██       ██
██      ███████ ██████   ██████  ███████
██      ██   ██ ██            ██      ██
 ██████ ██   ██ ██       ██████  ███████

Clinical Nutrition Care Agent
GLITCHCON 2.0 — G. Kathir Memorial Hospital{X}

  {T}Backend:{X}  http://localhost:{BACKEND_PORT}
  {T}API Docs:{X} http://localhost:{BACKEND_PORT}/docs
  {T}Frontend:{X} http://localhost:{FRONTEND_PORT}
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
    saved   = STAMP.read_text().strip() if STAMP.exists() else ""

    if current == saved:
        ok("Dependencies up to date - skipping pip install")
        return

    info("Installing / updating backend dependencies...")
    pip = str(py_exe)
    subprocess.run([pip, "-m", "pip", "install", "--upgrade", "pip", "-q"], check=True)
    subprocess.run([pip, "-m", "pip", "install", "-r", str(REQS), "-q"], check=True)
    STAMP.write_text(current)
    ok("pip install complete")


# -- port/process cleanup -----------------------------------------------------

def free_port(port: int):
    """Kill any process tree listening on *port*.
    Uses taskkill /F /T on Windows so uvicorn --reload worker children
    (which hold DuckDB locks) are also terminated."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", port)) != 0:
            return  # nothing listening
    try:
        if sys.platform == "win32":
            # Get owning PIDs via PowerShell (wmic is deprecated on Win11)
            ps_script = (
                f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue"
                " | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique"
            )
            out = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", ps_script],
                text=True, timeout=8, stderr=subprocess.DEVNULL,
            ).strip()
            for pid_str in out.splitlines():
                pid_str = pid_str.strip()
                if pid_str.isdigit() and int(pid_str) > 0:
                    # /T kills the entire process tree so uvicorn reload workers die too
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", pid_str],
                        capture_output=True,
                    )
                    warn(f"Killed PID {pid_str} (tree) on port {port}")
        else:
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
    db_file = str(BACKEND / "analytics.duckdb").replace("\\", "\\\\")
    try:
        ps_script = (
            "Get-CimInstance Win32_Process"
            " | Where-Object { $_.Name -match 'python' -and"
            " ($_.CommandLine -match 'uvicorn|main:app|main\\.py'"
            f" -or $_.CommandLine -match 'analytics\\.duckdb')"
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
            warn(".env created from template in backend/ — add your GEMINI_API_KEY!")
        else:
            env_path.write_text(
                "GEMINI_API_KEY=\n"
                "GUPSHUP_API_KEY=\n"
                "GUPSHUP_SOURCE_NUMBER=\n"
                "GUPSHUP_APP_NAME=CAP3S\n"
                "OLLAMA_URL=http://localhost:11434\n"
                "OLLAMA_MODEL=qwen2.5:7b\n"
            )
            warn(".env created in backend/ — add your GEMINI_API_KEY")

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        for line in env_path.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.split("=", 1)[1].strip()
    if api_key:
        ok("GEMINI_API_KEY configured  [AI meal plans + voice + reports active]")
    else:
        warn("GEMINI_API_KEY not set — meal naming will use fallback names")


# -- output streaming ----------------------------------------------------------

def stream(proc, label, colour):
    for line in iter(proc.stdout.readline, b""):
        print(f"{colour}[{label}]{X} {line.decode('utf-8', 'replace').rstrip()}")


# -- main ----------------------------------------------------------------------

def run():
    banner()

    ensure_venv()
    check_env()

    # Free ports and stray procs — do two passes to catch uvicorn reload children
    for _ in range(2):
        free_port(BACKEND_PORT)
        free_port(FRONTEND_PORT)
        free_backend_procs()
    time.sleep(1)              # let OS release file handles and sockets

    py  = str(venv_python())
    npm = shutil.which("npm") or "npm"
    procs = []

    # Backend
    if not (BACKEND / "main.py").exists():
        err("backend/main.py not found")
        sys.exit(1)

    print(f"\n{T}Starting backend...{X}")
    bp = subprocess.Popen(
        [py, "-m", "uvicorn", "main:app",
         "--reload", "--port", str(BACKEND_PORT), "--host", "0.0.0.0"],
        cwd=BACKEND, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    procs.append(bp)
    threading.Thread(target=stream, args=(bp, "BACK", T), daemon=True).start()
    time.sleep(2)

    # Frontend
    print(f"\n{G}Starting frontend...{X}")
    if (FRONTEND / "package.json").exists():
        if not (FRONTEND / "node_modules").exists():
            info("npm install (first run)...")
            subprocess.run([npm, "install"], cwd=FRONTEND, check=True,
                           shell=(sys.platform == "win32"))
        fp = subprocess.Popen(
            [npm, "run", "dev", "--", "--port", str(FRONTEND_PORT), "--strictPort"],
            cwd=FRONTEND,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            shell=(sys.platform == "win32"),
        )
        procs.append(fp)
        threading.Thread(target=stream, args=(fp, "FRONT", G), daemon=True).start()
    else:
        warn("frontend/package.json not found - skipping frontend")

    print(f"\n{B}{G}CAP3S is running!  Ctrl+C to stop{X}\n")

    def shutdown(sig=None, frame=None):
        print(f"\n{Y}Shutting down...{X}")
        for p in procs:
            try: p.terminate(); p.wait(timeout=5)
            except Exception:
                try: p.kill()
                except Exception: pass
        print("Goodbye!")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    try:
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    run()
