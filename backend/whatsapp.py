"""
NutriGuide WhatsApp Patient Bot
===========================
Adapted from AgriSahayak whatsapp.py (Puneeth Reddy T)

Original: Farmer sends leaf photo → disease detection in Hindi
Now:      Patient sends voice/text meal feedback → logged to clinical record
          On discharge → 30-day home meal guide sent in patient's language

Flow:
1. Patient WhatsApps "Maine aadha khaya" to Gupshup sandbox number
2. Gupshup POSTs to /api/v1/whatsapp/webhook  (form-encoded, field: payload)
3. We classify consumption level (Ate fully / Partially / Refused)
4. Log it via DuckDB, reply via Gupshup Outbound API in patient's language
5. On discharge → Azure OpenAI generates 30-day guide → sent to patient + caregiver

Gupshup payload shape (double-nested):
  body["type"] == "message"
  body["payload"]["sender"]["phone"]       ← sender
  body["payload"]["payload"]["type"]       ← "text" | "image" | …
  body["payload"]["payload"]["text"]       ← message text
  body["payload"]["payload"]["url"]        ← image URL (when type=image)
"""

import os
import json
import asyncio
import logging
import httpx
from datetime import datetime, date
from fastapi import APIRouter, Request, Form
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

# ── injected by main.py after startup ─────────────────────────
con: object = None          # DuckDB connection; set by main.py via _wa_module.con = con
patients_db: dict = {}

# Serialises concurrent webhook writes to the shared DuckDB connection.
# DuckDB's single connection is not safe for concurrent writes; a new
# connection per request would conflict with main.py's persistent `con`
# due to DuckDB's file-level write lock.
_db_write_lock = asyncio.Lock()

# ── Gupshup credentials (from .env) ──────────────────────────
GUPSHUP_API_KEY       = os.getenv("GUPSHUP_API_KEY", "")
GUPSHUP_APP_ID        = os.getenv("GUPSHUP_APP_ID", "")
GUPSHUP_SOURCE_NUMBER = os.getenv("GUPSHUP_SOURCE_NUMBER", "")   # your registered WhatsApp number
GUPSHUP_APP_NAME      = os.getenv("GUPSHUP_APP_NAME", "Nutriguide")
_GUPSHUP_OUTBOUND_URL = "https://api.gupshup.io/sm/api/v1/msg"


async def send_gupshup_reply(to: str, message: str) -> None:
    """Send an outbound WhatsApp message via Gupshup Outbound API."""
    if not GUPSHUP_API_KEY or not GUPSHUP_SOURCE_NUMBER:
        logger.warning("Gupshup not configured — skipping outbound send")
        return
    payload = {
        "channel": "whatsapp",
        "source": GUPSHUP_SOURCE_NUMBER,
        "destination": to,
        "message": json.dumps({"type": "text", "text": message}),
        "src.name": GUPSHUP_APP_NAME,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _GUPSHUP_OUTBOUND_URL,
                data=payload,
                headers={"apikey": GUPSHUP_API_KEY},
            )
            if resp.status_code not in (200, 202):
                logger.warning("Gupshup send failed [%s]: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.error("Gupshup outbound error: %s", exc)


def classify_consumption(text: str) -> tuple:
    """
    Multilingual consumption classifier with confidence scoring.
    Maps natural language in 9 Indian languages to clinical log levels.

    Returns:
        (label, confidence) where label is one of
        'Ate fully' / 'Partially' / 'Refused' and confidence is 0.0–1.0.

    Confidence logic:
        1.0  — numeric shortcut (patient replied 1 / 2 / 3)
        0.90 — only one category has keyword hits, no cross-category noise
        0.65 — one category wins but competing keywords also found
        0.50 — two categories tied (genuinely ambiguous, e.g. "thoda thoda khaya")
        0.40 — no keywords matched at all (default fallback)
    """
    t = text.lower().strip()

    # ── Numeric shortcuts sent after a clarification prompt ──────────────
    if t in ("1", "1."):
        return ("Ate fully", 1.0)
    if t in ("2", "2."):
        return ("Partially", 1.0)
    if t in ("3", "3."):
        return ("Refused", 1.0)

    # === ATE FULLY ===
    full_keywords = [
        # English
        "full", "ate", "finished", "completed", "all", "everything",
        # Hindi
        "pura", "poora", "kha liya", "sab", "saara",
        # Telugu
        "anni", "poortiga", "tinnanu",
        # Tamil
        "muzhuvathum", "saapitaen", "mudichu",
        # Kannada
        "ella", "thindi maadide", "poorna",
        # Marathi
        "sampurn", "khalle",
        # Bengali
        "shob", "kheyechi",
        # Gujarati
        "badhu", "jamyu",
        # Punjabi
        "sara", "kha lita"
    ]

    # === PARTIALLY ATE ===
    partial_keywords = [
        # English
        "half", "partial", "some", "little", "bit",
        # Hindi
        "thoda", "aadha", "kuch", "thodi",
        # Telugu
        "konjam", "swalpa tinanu",
        # Tamil
        "konjam", "swalpa",
        # Kannada
        "swalpa", "konjam",
        # Marathi
        "thoda", "ardhya",
        # Bengali
        "kichhu", "aadha",
        # Gujarati
        "thodu", "ardhu",
        # Punjabi
        "thoda", "adha"
    ]

    # === REFUSED ===
    refused_keywords = [
        # English
        "no", "refused", "didn't", "didnt", "not", "skip", "nothing",
        # Hindi
        "nahi", "nahin", "nhi", "nahi khaya", "bhook nahi",
        # Telugu
        "tinadam laedu", "vendam", "tinaledhu",
        # Tamil
        "saapidavillai", "vendam", "illai",
        # Kannada
        "tinalaedde", "beda", "alla",
        # Marathi
        "nahi", "khalle nahi",
        # Bengali
        "khainee", "na",
        # Gujarati
        "nathi", "na",
        # Punjabi
        "nahi", "na"
    ]

    refused_hits  = sum(1 for kw in refused_keywords  if kw in t)
    full_hits     = sum(1 for kw in full_keywords     if kw in t)
    partial_hits  = sum(1 for kw in partial_keywords  if kw in t)
    total_hits    = refused_hits + full_hits + partial_hits

    if total_hits == 0:
        # No recognisable keyword — very low confidence default
        return ("Partially", 0.4)

    scores = {"Refused": refused_hits, "Ate fully": full_hits, "Partially": partial_hits}
    winner = max(scores, key=scores.get)
    winner_hits = scores[winner]
    other_hits  = total_hits - winner_hits

    if other_hits == 0:
        confidence = 0.9   # Clean, unambiguous match
    elif winner_hits > other_hits:
        confidence = 0.65  # Winner, but cross-category noise present
    else:
        confidence = 0.5   # Tied / genuinely ambiguous

    return (winner, confidence)


def get_meal_time() -> str:
    """Infer meal time from current hour."""
    hour = datetime.now().hour
    if hour < 10:
        return "breakfast"
    elif hour < 14:
        return "lunch"
    elif hour < 17:
        return "snack"
    else:
        return "dinner"


# Localised reply templates — stolen and adapted from AgriSahayak voice.py
REPLY_TEMPLATES = {
    "te": {
        "logged": "✅ {meal_time} నమోదు చేయబడింది: {level}. మీ ఆరోగ్యం బాగుండాలని ఆశిస్తున్నాం! 🙏",
        "alert": "⚠️ మీరు 2+ భోజనాలు తిరస్కరించారు. మీ డైటీషియన్ మీకు వెంటనే సంప్రదిస్తారు.",
        "help": "🏥 NutriGuide పేషెంట్ బాట్\n\nమీ భోజన స్థితి తెలపండి:\n'పూర్తిగా తిన్నాను' / 'కొంచెం తిన్నాను' / 'తినలేదు'\n\nసహాయానికి 'help' పంపండి.",
        "discharge": "🎉 మీ డిశ్చార్జ్ హోమ్ మీల్ గైడ్ తయారైంది! 30 రోజుల ప్లాన్ మీ WhatsApp కి పంపడమైంది. 🍱",
        "clarify": "మీరు ఎంత తిన్నారు?\n1 = పూర్తిగా తిన్నాను\n2 = కొంచెం తిన్నాను\n3 = తినలేదు\n\nదయచేసి 1, 2 లేదా 3 అని పంపండి."
    },
    "ta": {
        "logged": "✅ {meal_time} பதிவு செய்யப்பட்டது: {level}. நலமாக இருக்கட்டும்! 🙏",
        "alert": "⚠️ நீங்கள் 2+ உணவுகளை மறுத்துள்ளீர்கள். உங்கள் dietitian விரைவில் தொடர்பு கொள்வார்கள்.",
        "help": "🏥 NutriGuide Patient Bot\n\nஉணவு நிலை தெரிவிக்கவும்:\n'முழுவதும் சாப்பிட்டேன்' / 'கொஞ்சம் சாப்பிட்டேன்' / 'சாப்பிடவில்லை'\n\nஉதவிக்கு 'help' அனுப்பவும்.",
        "discharge": "🎉 உங்கள் வீட்டு உணவு வழிகாட்டி தயார்! 30 நாள் திட்டம் WhatsApp-ல் அனுப்பப்பட்டது. 🍱",
        "clarify": "நீங்கள் எவ்வளவு சாப்பிட்டீர்கள்?\n1 = முழுவதும்\n2 = கொஞ்சம்\n3 = சாப்பிடவில்லை\n\nதயவுசெய்து 1, 2 அல்லது 3 அனுப்பவும்."
    },
    "hi": {
        "logged": "✅ {meal_time} दर्ज किया गया: {level}. जल्दी स्वस्थ हों! 🙏",
        "alert": "⚠️ आपने 2+ बार खाने से मना किया है। आपके dietitian जल्द संपर्क करेंगे।",
        "help": "🏥 NutriGuide Patient Bot\n\nखाने की स्थिति बताएं:\n'पूरा खाया' / 'थोड़ा खाया' / 'नहीं खाया'\n\nमदद के लिए 'help' भेजें।",
        "discharge": "🎉 आपकी घरेलू भोजन गाइड तैयार है! 30 दिन का प्लान WhatsApp पर भेजा गया। 🍱",
        "clarify": "क्या आपने खाना खाया?\n1 = पूरा\n2 = थोड़ा\n3 = नहीं\n\nकृपया 1, 2 या 3 भेजें।"
    },
    "en": {
        "logged": "✅ {meal_time} logged: {level}. Wishing you a speedy recovery! 🙏",
        "alert": "⚠️ You've refused 2+ meals. Your dietitian will follow up shortly.",
        "help": "🏥 NutriGuide Patient Bot\n\nReport your meal:\n'Ate fully' / 'Partially' / 'Refused'\n\nSend 'help' for assistance.",
        "discharge": "🎉 Your home meal guide is ready! 30-day plan sent to your WhatsApp. 🍱",
        "clarify": "How much did you eat?\n1 = Ate fully\n2 = Partially\n3 = Refused\n\nPlease reply with 1, 2, or 3."
    }
}


def get_reply(lang: str, key: str, **kwargs) -> str:
    """Get localised reply, fallback to English."""
    templates = REPLY_TEMPLATES.get(lang, REPLY_TEMPLATES["en"])
    template = templates.get(key, REPLY_TEMPLATES["en"].get(key, ""))
    return template.format(**kwargs)


@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    payload: Optional[str] = Form(default=None),
):
    """
    Gupshup WhatsApp webhook — receives patient meal feedback.
    Gupshup POSTs form-encoded data with a single "payload" field (JSON string).
    Architecture adapted from AgriSahayak, domain remapped to clinical nutrition.

    Supported inputs:
    - "Pura khaya" / "Ate fully" → logs "Ate fully"
    - "Thoda khaya" / "Partially" → logs "Partially"
    - "Nahi khaya" / "Refused" → logs "Refused" + alerts dietitian after 2x
    - "help" → returns command guide in patient's language
    - Photo of meal tray → GPT-4o Vision classifies consumption (bonus flex)
    """
    # ── Parse Gupshup's double-nested payload ─────────────────────
    if not payload:
        # Gupshup sometimes sends an empty verification ping
        return {"status": "ok"}

    try:
        body = json.loads(payload)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Received non-JSON payload from Gupshup: %s", str(payload)[:200])
        return {"status": "ok"}

    msg_type = body.get("type")  # "message" | "user-event"
    if msg_type != "message":
        return {"status": "ok"}

    outer   = body.get("payload", {})
    sender  = outer.get("sender", {}).get("phone", "")
    inner   = outer.get("payload", {})
    content_type = inner.get("type", "text")    # "text" | "image" | "audio" …
    text    = inner.get("text", "").strip()
    img_url = inner.get("url", "")

    body_lower = text.lower()
    logger.info("WhatsApp from %s: '%s' [type=%s]", sender, text[:50], content_type)

    # ── Lookup patient by phone ───────────────────────────────────
    patient = next((p for p in patients_db.values() if p.get("phone") == sender), None)

    if not patient:
        await send_gupshup_reply(
            sender,
            "🏥 NutriGuide Clinical Nutrition System\n\n"
            "Your number is not registered. Please contact the hospital reception.\n\n"
            "आपका नंबर पंजीकृत नहीं है। कृपया अस्पताल से संपर्क करें।"
        )
        return {"status": "ok"}

    _LANG_MAP = {"Telugu":"te","Tamil":"ta","Hindi":"hi","Marathi":"mr",
                 "Gujarati":"gu","Kannada":"kn","Bengali":"bn","Punjabi":"pa"}
    lang = _LANG_MAP.get(patient.get("language_name", ""), "en")
    patient_id = patient["id"]
    patient_name = patient["name"]

    # ── HELP ─────────────────────────────────────────────────────
    if body_lower in ["help", "मदद", "உதவி", "సహాయం", ""]:
        await send_gupshup_reply(sender, get_reply(lang, "help"))
        return {"status": "ok"}

    # ── MEAL PHOTO (GPT-4o Vision tray analysis) ─────────────────
    if content_type == "image" and img_url:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                img_resp = await client.get(img_url)
                img_bytes = img_resp.content

            from gemini_client import ask_vision
            import base64
            img_b64 = base64.b64encode(img_bytes).decode()

            raw = await ask_vision(
                img_b64,
                "Look at this hospital meal tray photo. Classify the meal consumption as EXACTLY one of: 'Ate fully', 'Partially', 'Refused'. Reply with ONLY one of those three options.",
                timeout=20.0
            )
            consumption = raw.strip()
            if consumption not in ["Ate fully", "Partially", "Refused"]:
                consumption = "Partially"
            confidence = 0.9  # Vision model output treated as high-confidence

        except Exception as e:
            logger.warning("Vision classification failed, using text fallback: %s", e)
            consumption, confidence = classify_consumption(text)
    else:
        # ── TEXT/VOICE message: IndicBERT multilingual classifier primary ──
        try:
            from ai_models import indic_classify_consumption
            indic_label, indic_conf, indic_meta = await indic_classify_consumption(text)
            if indic_label is not None and indic_conf >= 0.55:
                consumption, confidence = indic_label, indic_conf
                logger.info("IndicBERT classified '%s' → %s (conf=%.2f, src=%s)",
                            text[:40], consumption, confidence, indic_meta.get("source", "?"))
            else:
                # IndicBERT unavailable or low confidence → keyword fallback
                consumption, confidence = classify_consumption(text)
                logger.info("Keyword fallback for '%s' → %s (conf=%.2f)", text[:40], consumption, confidence)
        except Exception as exc:
            logger.warning("IndicBERT call failed: %s — using keyword fallback", exc)
            consumption, confidence = classify_consumption(text)

    logger.info("Classified '%s' → %s (confidence=%.2f)", text[:40], consumption, confidence)

    # ── Low-confidence: ask for structured clarification instead of guessing ──
    if confidence < 0.7:
        logger.info("Low confidence (%.2f) for '%s' — sending clarification prompt", confidence, text[:40])
        await send_gupshup_reply(sender, get_reply(lang, "clarify"))
        return {"status": "ok"}

    # ── Log the consumption ───────────────────────────────────────
    today = str(date.today())
    meal_time = get_meal_time()

    _db = con
    if _db is None:
        logger.error("WhatsApp webhook: DuckDB connection not injected. Bot cannot log meals.")
        await send_gupshup_reply(sender, "⚠️ System error — please contact the hospital. (DB not ready)")
        return {"status": "error", "detail": "db_not_ready"}

    async with _db_write_lock:
        _db.execute(
            "INSERT INTO meal_logs VALUES (?, ?, ?, ?, ?, ?)",
            [patient_id, today, meal_time, consumption, datetime.now(), text[:200]]
        )

        # ── Check consecutive refusals (DuckDB OLAP) ─────────────────
        recent_refusals = _db.execute("""
            SELECT COUNT(*) FROM meal_logs
            WHERE patient_id = ?
              AND consumption_level = 'Refused'
              AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '48' HOUR
        """, [patient_id]).fetchone()[0]

    # ── Build reply ───────────────────────────────────────────────
    meal_time_display = {
        "breakfast": {"te": "అల్పాహారం", "ta": "காலை உணவு", "hi": "नाश्ता", "en": "Breakfast"},
        "lunch":     {"te": "మధ్యాహ్న భోజనం", "ta": "மதிய உணவு", "hi": "दोपहर का खाना", "en": "Lunch"},
        "dinner":    {"te": "రాత్రి భోజనం", "ta": "இரவு உணவు", "hi": "रात का खाना", "en": "Dinner"},
        "snack":     {"te": "స్నాక్స్", "ta": "சிற்றுண்டி", "hi": "स्नैक", "en": "Snack"},
    }
    meal_label = meal_time_display.get(meal_time, {}).get(lang, meal_time.title())

    reply = get_reply(lang, "logged", meal_time=meal_label, level=consumption)

    if recent_refusals >= 2:
        reply += "\n\n" + get_reply(lang, "alert")
        logger.warning("DIETITIAN ALERT: %s (%s) refused %d meals in 48h", patient_name, patient_id, recent_refusals)

    await send_gupshup_reply(sender, reply)
    return {"status": "ok"}


class WaProcessRequest(BaseModel):
    # `from` is reserved in Python — field aliased via populate_by_name
    sender: str = Field(..., alias="from")
    text: str

    model_config = {"populate_by_name": True}


@router.post("/process")
async def whatsapp_process(req: WaProcessRequest):
    """
    whatsapp-web.js bridge endpoint.

    The Node bot POSTs { "from": "919876543210@c.us", "text": "thoda khaya" }
    and receives back { "reply": "<localised reply text>" }.

    This runs the identical pipeline as /webhook but:
    - Input is plain JSON (not Gupshup form-encoded)
    - Output is { reply } JSON instead of calling Gupshup outbound API
    - Phone normalisation strips @c.us and adds leading + for patients.json match
    """
    # Normalise number: "919876543210@c.us" → "+919876543210"
    raw_phone = req.sender.split("@")[0]  # strip @c.us / @g.us
    if raw_phone and not raw_phone.startswith("+"):
        raw_phone = "+" + raw_phone

    text = req.text.strip()
    logger.info("WA-web.js process: from=%s text='%s'", raw_phone, text[:60])

    # ── Patient lookup ────────────────────────────────────────────
    patient = next(
        (p for p in patients_db.values() if p.get("phone") == raw_phone),
        None,
    )

    if not patient:
        return {
            "reply": (
                "🏥 NutriGuide Clinical Nutrition\n\n"
                "Your number is not registered. Please contact the hospital.\n"
                "आपका नंबर पंजीकृत नहीं है। कृपया अस्पताल से संपर्क करें।"
            )
        }

    _LANG_MAP = {
        "Telugu": "te", "Tamil": "ta", "Hindi": "hi", "Marathi": "mr",
        "Gujarati": "gu", "Kannada": "kn", "Bengali": "bn", "Punjabi": "pa",
    }
    lang = _LANG_MAP.get(patient.get("language_name", ""), "en")
    patient_id   = patient["id"]
    patient_name = patient["name"]

    body_lower = text.lower()

    # ── HELP ─────────────────────────────────────────────────────
    if body_lower in ["help", "मदद", "உதவி", "సహాయం", ""]:
        return {"reply": get_reply(lang, "help")}

    # ── Classify consumption ──────────────────────────────────────
    try:
        from ai_models import indic_classify_consumption
        indic_label, indic_conf, _ = await indic_classify_consumption(text)
        if indic_label is not None and indic_conf >= 0.55:
            consumption, confidence = indic_label, indic_conf
        else:
            consumption, confidence = classify_consumption(text)
    except Exception as exc:
        logger.warning("IndicBERT failed in /process: %s — keyword fallback", exc)
        consumption, confidence = classify_consumption(text)

    # Low confidence → ask for structured answer
    if confidence < 0.7:
        return {"reply": get_reply(lang, "clarify")}

    # ── Log to DuckDB ─────────────────────────────────────────────
    today     = str(date.today())
    meal_time = get_meal_time()
    _db = con

    if _db is None:
        return {"reply": "⚠️ System error — please contact the hospital. (DB not ready)"}

    async with _db_write_lock:
        _db.execute(
            "INSERT INTO meal_logs VALUES (?, ?, ?, ?, ?, ?)",
            [patient_id, today, meal_time, consumption, datetime.now(), text[:200]],
        )
        recent_refusals = _db.execute("""
            SELECT COUNT(*) FROM meal_logs
            WHERE patient_id = ?
              AND consumption_level = 'Refused'
              AND logged_at >= CURRENT_TIMESTAMP - INTERVAL '48' HOUR
        """, [patient_id]).fetchone()[0]

    # ── Build reply ───────────────────────────────────────────────
    meal_time_display = {
        "breakfast": {"te": "అల్పాహారం",        "ta": "காலை உணவு",  "hi": "नाश्ता",             "en": "Breakfast"},
        "lunch":     {"te": "మధ్యాహ్న భోజనం",   "ta": "மதிய உணவு",  "hi": "दोपहर का खाना",     "en": "Lunch"},
        "dinner":    {"te": "రాత్రి భోజనం",      "ta": "இரவு உணவு",  "hi": "रात का खाना",        "en": "Dinner"},
        "snack":     {"te": "స్నాక్స్",          "ta": "சிற்றுண்டி", "hi": "स्नैक",              "en": "Snack"},
    }
    meal_label = meal_time_display.get(meal_time, {}).get(lang, meal_time.title())
    reply = get_reply(lang, "logged", meal_time=meal_label, level=consumption)

    if recent_refusals >= 2:
        reply += "\n\n" + get_reply(lang, "alert")
        logger.warning(
            "DIETITIAN ALERT (WA-web.js): %s (%s) refused %d meals in 48h",
            patient_name, patient_id, recent_refusals,
        )

    return {"reply": reply}


@router.get("/status")
async def whatsapp_status():
    """Check WhatsApp bot configuration status (Gupshup)."""
    return {
        "provider": "Gupshup",
        "configured": bool(GUPSHUP_API_KEY and GUPSHUP_SOURCE_NUMBER),
        "api_key_hint": GUPSHUP_API_KEY[:8] + "..." if GUPSHUP_API_KEY else "not_set",
        "source_number": GUPSHUP_SOURCE_NUMBER or "not_set",
        "app_name": GUPSHUP_APP_NAME,
        "capabilities": [
            "meal_consumption_logging",
            "multilingual_9_indian_languages",
            "azure_gpt4o_vision_tray_photo",
            "dietitian_alert_on_2_refusals",
            "discharge_home_meal_guide"
        ],
        "supported_languages": ["te", "ta", "hi", "mr", "gu", "kn", "bn", "pa", "en"],
        "instructions": (
            "1. Run: ngrok http 8179\n"
            "2. Paste https://<ngrok-id>.ngrok-free.app/api/v1/whatsapp/webhook into Gupshup dashboard → Callback URL\n"
            "3. GUPSHUP_API_KEY, GUPSHUP_SOURCE_NUMBER, GUPSHUP_APP_NAME set in backend/.env\n"
            "4. Each test phone must first opt-in by messaging Gupshup sandbox number\n"
            "5. Patients send meal feedback in their language → auto-logged"
        )
    }
