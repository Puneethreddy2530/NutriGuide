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


def fix_jsx(rel):
    path = os.path.join(ROOT, rel)
    with open(path, "r", encoding="utf-8-sig") as f:   # utf-8-sig strips BOM
        content = f.read()
    fixed = fix_mojibake(content)
    with open(path, "w", encoding="utf-8") as f:
        f.write(fixed)
    diff = sum(1 for a, b in zip(content.splitlines(), fixed.splitlines()) if a != b)
    print(f"  FIXED  {rel}  ({diff} lines changed, BOM stripped)")


def fix_css(rel):
    path = os.path.join(ROOT, rel)
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

        # Strip PowerShell continuation prefix ">> " or ">>"
        if line.startswith(">> "):
            stripped = line[3:]
        elif line.startswith(">>"):
            stripped = line[2:]
        else:
            stripped = line

        if stripped.strip() == HEREDOC_CLOSE:
            break

        css_lines.append(stripped)

    if not css_lines:
        print(f"  WARN   {rel}: no heredoc found — file may already be clean, skipping")
        return

    css_text = fix_mojibake("\n".join(css_lines))
    with open(path, "w", encoding="utf-8") as f:
        f.write(css_text)
    print(f"  FIXED  {rel}  ({len(css_lines)} lines extracted from PS heredoc, mojibake fixed)")


print("=== CAP3S encoding fixer ===")
fix_jsx("frontend/src/App.jsx")
fix_jsx("frontend/src/components/LandingPage.jsx")
fix_css("frontend/src/index.css")

# Quick verification
print("\n=== Verification ===")
for rel in ["frontend/src/App.jsx", "frontend/src/index.css",
            "frontend/src/components/LandingPage.jsx"]:
    path = os.path.join(ROOT, rel)
    with open(path, "rb") as f:
        head = f.read(12)
    has_bom = head[:3] == b"\xef\xbb\xbf"
    size = os.path.getsize(path)
    print(f"  {'BOM!' if has_bom else 'OK  '}  {rel}  ({size} bytes)  first={head.hex()}")

print("\nDone.")
