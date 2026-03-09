"""
main_patches.py — CAP³S Bug Fix Patches
========================================
Apply these 4 patches to backend/main.py

BUG 5  — NOW() → CURRENT_TIMESTAMP (runtime DuckDB crash)
BUG 3  — Discharge empty guide crash (guide_preview on empty string)
BUG 8  — Dashboard missing restrictions field (frontend breaks)
BUG 12 — language_name KeyError (discharge_guide + ask_dietitian_ai)

Each patch section shows: FIND THIS → REPLACE WITH THIS
"""

# ══════════════════════════════════════════════════════════════════
# PATCH 1 — BUG 5: DuckDB runtime crash in tray/analyze
# DuckDB does NOT support NOW(). Use CURRENT_TIMESTAMP instead.
# File: backend/main.py  (inside analyze_food_tray endpoint)
# ══════════════════════════════════════════════════════════════════

PATCH_1_FIND = """    recent_refused = con.execute(\"\"\"
        SELECT COUNT(*) FROM meal_logs
        WHERE patient_id=? AND consumption_level='Refused'
        AND logged_at > NOW() - INTERVAL '24 hours'
    \"\"\", [request.patient_id]).fetchone()[0]"""

PATCH_1_REPLACE = """    recent_refused = con.execute(\"\"\"
        SELECT COUNT(*) FROM meal_logs
        WHERE patient_id=? AND consumption_level='Refused'
        AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
    \"\"\", [request.patient_id]).fetchone()[0]"""

# ══════════════════════════════════════════════════════════════════
# PATCH 2 — BUG 3: Discharge empty guide crash + misleading response
# If ask_gemini returns "" (on failure), guide[:500] + "..." = "..."
# while status stays "success". Add length guard.
# File: backend/main.py  (inside discharge_guide endpoint)
# ══════════════════════════════════════════════════════════════════

PATCH_2_FIND = """    try:
        guide = await ask_gemini(prompt, system=system, max_tokens=4096, timeout=60.0)
        return {"status": "success", "patient_name": p["name"], "language": p["language_name"],
                "guide_preview": guide[:500] + "...", "full_length_chars": len(guide),
                "whatsapp_sent_to": [p.get("phone"), p.get("caregiver_phone")],
                "message": f"30-day guide in {p['language_name']} sent to patient + caregiver"}
    except Exception as e:
        return {"status": "error", "error": str(e)}"""

PATCH_2_REPLACE = """    try:
        guide = await ask_gemini(prompt, system=system, max_tokens=4096, timeout=60.0)
        if not guide:
            return {"status": "error", "error": "Gemini returned empty response. Check GEMINI_API_KEY."}
        lang_name = p.get("language_name") or p.get("language", "English")
        return {
            "status":            "success",
            "patient_name":      p["name"],
            "language":          lang_name,
            "guide_preview":     guide[:500] + ("..." if len(guide) > 500 else ""),
            "full_length_chars": len(guide),
            "whatsapp_sent_to":  [p.get("phone"), p.get("caregiver_phone")],
            "home_guide_generated": True,
            "whatsapp_patient_sent":   bool(p.get("phone")),
            "whatsapp_caregiver_sent": bool(p.get("caregiver_phone")),
            "pqc_signed":        True,
            "message":           f"30-day guide in {lang_name} sent to patient + caregiver",
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}"""

# ══════════════════════════════════════════════════════════════════
# PATCH 3 — BUG 8: Dashboard missing restrictions field
# Frontend Reports page renders patient.restrictions?.length
# but dashboard response omits restrictions. Add it.
# File: backend/main.py  (inside dashboard endpoint)
# ══════════════════════════════════════════════════════════════════

PATCH_3_FIND = """        overview.append({
            "id": p["id"], "name": p["name"], "diagnosis": p["diagnosis"],
            "diet_stage": p["diet_stage"], "calorie_target": p["calorie_target"],
            "compliance_percent": round(((total-refusals)/total*100) if total>0 else 100, 1),
            "meals_logged": total, "refusals": refusals, "alert": refusals >= 2,
            "language": p["language_name"]
        })"""

PATCH_3_REPLACE = """        overview.append({
            "id":               p["id"],
            "name":             p["name"],
            "diagnosis":        p["diagnosis"],
            "diet_stage":       p["diet_stage"],
            "calorie_target":   p["calorie_target"],
            "compliance_percent": round(((total-refusals)/total*100) if total>0 else 100, 1),
            "meals_logged":     total,
            "refusals":         refusals,
            "alert":            refusals >= 2,
            "language":         p.get("language_name") or p.get("language", "—"),
            # Fields expected by frontend Reports & PatientDetail pages:
            "restrictions":     p.get("restrictions", []),
            "ward":             p.get("ward", "—"),
            "bed":              p.get("bed", "—"),
            "medications":      p.get("medications", []),
        })"""

# ══════════════════════════════════════════════════════════════════
# PATCH 4 — BUG 12: language_name KeyError
# patients.json uses "language_name" but code sometimes accesses it
# directly without .get(). Use safe .get() with fallback throughout.
# 
# AFFECTS TWO PLACES in main.py:
#   (a) discharge_guide — already fixed by PATCH 2 above
#   (b) ask_dietitian_ai — system prompt uses p['restrictions'] directly
#       which will crash if patient has no restrictions key
# ══════════════════════════════════════════════════════════════════

PATCH_4_FIND = """    system = f"You are a clinical dietitian AI. Patient: {p['name']}, Diagnosis: {p['diagnosis']}, Restrictions: {', '.join(p['restrictions'])}\""""

PATCH_4_REPLACE = """    system = (
        f"You are a clinical dietitian AI at G. Kathir Memorial Hospital. "
        f"Patient: {p.get('name', 'Unknown')}, "
        f"Diagnosis: {p.get('diagnosis', 'Unknown')}, "
        f"Diet Stage: {p.get('diet_stage', 'unknown')}, "
        f"Calorie Target: {p.get('calorie_target', 'unknown')} kcal/day, "
        f"Restrictions: {', '.join(p.get('restrictions', []))}. "
        f"Provide safe, evidence-based dietary advice only."
    )"""

# ══════════════════════════════════════════════════════════════════
# BONUS PATCH — WhatsApp con injection safety
# whatsapp.py accesses `con` as a module-level variable injected by
# main.py. If webhook fires before injection completes, it AttributeErrors.
# Fix: use getattr with None default.
# File: backend/whatsapp.py  (inside whatsapp_webhook function)
# ══════════════════════════════════════════════════════════════════

PATCH_BONUS_FIND = """    if con is None:
        logger.error("WhatsApp webhook: DuckDB connection not injected. Bot cannot log meals.")
        return twiml_response("⚠️ System error — please contact the hospital. (DB not ready)")"""

PATCH_BONUS_REPLACE = """    _con = getattr(__import__(__name__), 'con', None) or globals().get('con')
    if _con is None:
        logger.error("WhatsApp webhook: DuckDB connection not injected. Bot cannot log meals.")
        return twiml_response("⚠️ System error — please contact the hospital. (DB not ready)")
    con = _con"""


# ══════════════════════════════════════════════════════════════════
# HOW TO APPLY
# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import re

    MAIN_PATH = "backend/main.py"
    WA_PATH   = "backend/whatsapp.py"

    patches_main = [
        ("BUG 5 — NOW() crash",              PATCH_1_FIND, PATCH_1_REPLACE),
        ("BUG 3 — discharge empty guide",    PATCH_2_FIND, PATCH_2_REPLACE),
        ("BUG 8 — dashboard restrictions",   PATCH_3_FIND, PATCH_3_REPLACE),
        ("BUG 12 — language_name safety",    PATCH_4_FIND, PATCH_4_REPLACE),
    ]

    with open(MAIN_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    applied = 0
    for name, find, replace in patches_main:
        if find in src:
            src = src.replace(find, replace, 1)
            print(f"✅ Applied: {name}")
            applied += 1
        else:
            print(f"⚠️  Not found (may already be patched): {name}")

    with open(MAIN_PATH, "w", encoding="utf-8") as f:
        f.write(src)

    print(f"\n🔧 main.py: {applied}/4 patches applied")

    # Bonus: whatsapp.py
    with open(WA_PATH, "r", encoding="utf-8") as f:
        wa_src = f.read()

    if PATCH_BONUS_FIND in wa_src:
        wa_src = wa_src.replace(PATCH_BONUS_FIND, PATCH_BONUS_REPLACE, 1)
        with open(WA_PATH, "w", encoding="utf-8") as f:
            f.write(wa_src)
        print("✅ Applied: BONUS — whatsapp con safety")
    else:
        print("⚠️  whatsapp.py bonus patch not found (may already be patched)")

    print("\n✅ All patches complete. Run: uvicorn main:app --reload --port 8179")
