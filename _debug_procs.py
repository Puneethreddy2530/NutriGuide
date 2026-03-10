"""Debug: list Python processes that free_backend_procs() would match."""
import os, subprocess
pid = os.getpid()
print(f"My PID: {pid}")

project_name = "Glitchcon_2.0"
ps_script = (
    "Get-CimInstance Win32_Process"
    " | Where-Object { $_.Name -match 'python'"
    f" -and $_.ProcessId -ne {pid}"
    " -and ($_.ExecutablePath -like '*.venv\\*'"
    "   -or $_.ExecutablePath -like 'C:\\Python311\\*'"
    "   -or $_.ExecutablePath -like 'C:\\Python3*\\*'"
    f"  -or $_.CommandLine  -like '*{project_name}*') }}"
    " | Select-Object ProcessId, Name, @{Name='Cmd';Expression={$_.CommandLine.Substring(0, [Math]::Min(120, $_.CommandLine.Length))}}"
    " | Format-List"
)
print(f"PS Script:\n{ps_script}\n")
try:
    out = subprocess.check_output(
        ["powershell", "-NoProfile", "-Command", ps_script],
        text=True, timeout=12, stderr=subprocess.STDOUT,
    ).strip()
    print(f"Matched processes:\n{out}" if out else "No matches!")
except subprocess.CalledProcessError as e:
    print(f"PS error (rc={e.returncode}):\n{e.output}")
except Exception as e:
    print(f"Error: {e}")
