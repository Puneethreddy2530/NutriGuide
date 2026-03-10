"""
Fix encoding issues in frontend source files:
  1. App.jsx / LandingPage.jsx  - strip UTF-8 BOM, reverse CP1252-over-UTF8 mojibake
  2. index.css                  - extract real CSS from PowerShell heredoc wrapper,
                                  then fix mojibake in comments/strings
"""

import os, sys
ROOT = os.path.dirname(__file__)

def fix_mojibake(text: str) -> str:
    """Reverse Windows-1252 mojibake: re-encode each line as cp1252 -> decode as utf-8."""
    result = []
    for line in text.splitlines(True):
        try:
            result.append(line.encode("cp1252").decode("utf-8"))
        except (UnicodeEncodeError, UnicodeDecodeError):
            result.append(line)   # keep original when fix isn't applicable
    return "".join(result)


def fix_source(path):
    """Strip BOM and fix mojibake in any source file (.jsx/.js/.ts/.css/.py)."""
    with open(path, "r", encoding="utf-8-sig") as f:
        content = f.read()
    fixed = fix_mojibake(content)
    with open(path, "w", encoding="utf-8") as f:
        f.write(fixed)
    diff = sum(1 for a, b in zip(content.splitlines(), fixed.splitlines()) if a != b)
    rel = os.path.relpath(path, ROOT)
    print(f"  FIXED  {rel}  ({diff} lines changed)")


def fix_bom_only(path):
    """For JSON: strip BOM only — skip mojibake which could corrupt valid JSON."""
    with open(path, "rb") as f:
        raw = f.read()
    if raw[:3] == b"\xef\xbb\xbf":
        with open(path, "wb") as f:
            f.write(raw[3:])
        rel = os.path.relpath(path, ROOT)
        print(f"  BOM    {rel}  (BOM stripped)")


def fix_index_css(path):
    """Special handler for index.css: extract from PS heredoc if present, then fix mojibake."""
    with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
        raw_lines = f.read().splitlines()

    css_lines, inside = [], False
    HEREDOC_OPEN  = "@'"
    HEREDOC_CLOSE = "'@"

    for line in raw_lines:
        if not inside:
            if HEREDOC_OPEN in line:
                inside = True
            continue
        if line.startswith(">> "):
            stripped = line[3:]
        elif line.startswith(">>"):
            stripped = line[2:]
        else:
            stripped = line
        if stripped.strip() == HEREDOC_CLOSE:
            break
        css_lines.append(stripped)

    if css_lines:
        css_text = fix_mojibake("\n".join(css_lines))
        with open(path, "w", encoding="utf-8") as f:
            f.write(css_text)
        rel = os.path.relpath(path, ROOT)
        print(f"  FIXED  {rel}  ({len(css_lines)} lines from PS heredoc, mojibake fixed)")
    else:
        # No heredoc wrapper — treat as a normal source file
        fix_source(path)


CODE_EXTS = {'.jsx', '.js', '.ts', '.tsx', '.css', '.py'}
JSON_EXTS  = {'.json'}
SKIP_DIRS  = {'node_modules', '__pycache__', '.venv', 'dist', 'build', '.git'}

print("=== NutriGuide encoding fixer (full scan) ===\n")
total = 0
for scan_root in [os.path.join(ROOT, 'frontend'), os.path.join(ROOT, 'backend')]:
    if not os.path.isdir(scan_root):
        continue
    for dirpath, dirnames, filenames in os.walk(scan_root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            ext = os.path.splitext(fname)[1].lower()
            if ext in CODE_EXTS:
                if fname == 'index.css':
                    fix_index_css(fpath)
                else:
                    fix_source(fpath)
                total += 1
            elif ext in JSON_EXTS:
                fix_bom_only(fpath)
                total += 1

# Verification: flag any remaining BOMs
print("\n=== Verification ===")
bom_count = 0
for scan_root in [os.path.join(ROOT, 'frontend'), os.path.join(ROOT, 'backend')]:
    if not os.path.isdir(scan_root):
        continue
    for dirpath, dirnames, filenames in os.walk(scan_root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            ext = os.path.splitext(fname)[1].lower()
            if ext in CODE_EXTS | JSON_EXTS:
                with open(fpath, "rb") as f:
                    head = f.read(3)
                if head == b"\xef\xbb\xbf":
                    rel = os.path.relpath(fpath, ROOT)
                    print(f"  BOM!  {rel}")
                    bom_count += 1

if bom_count == 0:
    print("  All clear — no BOMs found.")
print(f"\nDone — {total} files processed.")
