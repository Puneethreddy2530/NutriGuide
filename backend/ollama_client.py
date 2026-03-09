"""
ollama_client.py — NeoPulse MindGuide AI Core
═══════════════════════════════════════════════
Async Ollama client with:
  - GPU acceleration (num_gpu layers auto-detected)
  - State-of-the-art health system prompts
  - Expanded multilingual crisis detection (EN + HI + MR + TA + TE)
  - Structured chain-of-thought for complex queries
  - Token streaming + non-streaming paths
  - Model auto-resolution with TTL cache

Model priority:
  1. qwen3:30b       — primary (best medical reasoning, GPU required)
  2. qwen2.5:7b      — mid-tier (good quality, moderate VRAM)
  3. qwen2.5:1.5b    — fast fallback / quick answers
  4. llama3.2:latest — last resort
"""

import os
import time
import json
import logging
import asyncio
from typing import AsyncGenerator, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL      = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_CACHE_TTL = 60   # seconds before re-checking available models

# ── GPU acceleration ──────────────────────────────────────────────────
# num_gpu: number of model layers to offload to GPU.
#   -1 = let Ollama decide (uses all available VRAM automatically)
#    0 = CPU only
#   Set via env var OLLAMA_NUM_GPU, defaults to -1 (full GPU auto)
OLLAMA_NUM_GPU = int(os.getenv("OLLAMA_NUM_GPU", "-1"))

# ── Model priority chain ──────────────────────────────────────────────
PREFERRED_MODELS = [
    "qwen2.5:7b",
    "qwen2.5:1.5b",
    "llama3.2:latest",
    "mistral:latest",
]

# ── Singleton HTTP client ─────────────────────────────────────────────
_client: Optional[httpx.AsyncClient] = None

def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=180.0)
    return _client


# ── Model resolution with cache ───────────────────────────────────────
_resolved_model:   Optional[str] = None
_resolved_at:      float         = 0.0
_available_models: List[str]     = []
_gpu_info:         Optional[dict] = None


async def _detect_gpu() -> dict:
    """Query Ollama for GPU status via /api/ps endpoint."""
    global _gpu_info
    if _gpu_info is not None:
        return _gpu_info
    try:
        r = await _get_client().get(f"{OLLAMA_URL}/api/ps", timeout=3.0)
        if r.status_code == 200:
            data = r.json()
            models_running = data.get("models", [])
            if models_running:
                m = models_running[0]
                _gpu_info = {
                    "gpu_available": True,
                    "size_vram": m.get("size_vram", 0),
                    "processor": m.get("processor", "unknown"),
                }
                return _gpu_info
    except Exception:
        pass

    # Fallback: check via a tiny inference call isn't worth it —
    # just trust OLLAMA_NUM_GPU env var
    import importlib.util
    torch_spec = importlib.util.find_spec("torch")
    if torch_spec:
        import torch
        cuda_ok = torch.cuda.is_available()
        _gpu_info = {
            "gpu_available": cuda_ok,
            "size_vram": 0,
            "processor": "cuda" if cuda_ok else "cpu",
        }
    else:
        _gpu_info = {"gpu_available": False, "size_vram": 0, "processor": "cpu"}
    return _gpu_info


async def resolve_model(force_fast: bool = False) -> str:
    """
    Returns best available model.
    force_fast=True → skip 30b/7b, return fastest available.
    Result cached for MODEL_CACHE_TTL seconds.
    """
    global _resolved_model, _resolved_at, _available_models

    now = time.time()
    if _resolved_model and (now - _resolved_at) < MODEL_CACHE_TTL:
        if force_fast and _resolved_model in ("qwen3:30b", "qwen2.5:7b"):
            # Return fastest available
            for m in ("qwen2.5:1.5b", "llama3.2:latest"):
                if m in _available_models:
                    return m
        return _resolved_model

    try:
        r = await _get_client().get(f"{OLLAMA_URL}/api/tags", timeout=3.0)
        r.raise_for_status()
        _available_models = [m["name"] for m in r.json().get("models", [])]
    except Exception as e:
        logger.warning(f"Ollama unreachable: {e}")
        _available_models = []

    chain = PREFERRED_MODELS[2:] if force_fast else PREFERRED_MODELS
    for m in chain:
        if m in _available_models:
            _resolved_model = m
            _resolved_at    = now
            logger.info(f"Ollama model resolved → {m}  (GPU layers={OLLAMA_NUM_GPU})")
            return m

    # Last resort: whatever is installed
    if _available_models:
        _resolved_model = _available_models[0]
        _resolved_at    = now
        return _resolved_model

    raise RuntimeError(
        "No Ollama models available. Run: ollama pull qwen2.5:7b"
    )


async def is_ollama_running() -> bool:
    try:
        r = await _get_client().get(f"{OLLAMA_URL}/api/tags", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════
# System prompts — state-of-the-art health AI
# ═══════════════════════════════════════════════════════════════════

_BASE_SAFETY = """
## SAFETY RULES (NON-NEGOTIABLE — ALWAYS APPLY)
1. You are a supportive AI companion, NOT a therapist, doctor, or pharmacist.
2. For any crisis signal (self-harm, suicidal ideation, abuse), respond with:
   "I hear you. You're not alone. Please reach out right now:
   • iCall India: 9152987821 (Mon–Sat 8am–10pm)
   • Vandrevala Foundation: 1860-2662-345 (24/7, multilingual)
   • AASRA: 9820466627 (24/7)
   • Emergency: 112"
   Then provide grounding support.
3. Never diagnose medical conditions.
4. Never recommend changing or stopping prescribed medications.
5. Always recommend professional consultation for persistent or worsening symptoms.
6. Do not repeat or store personal identifying information.
7. If unsure, err on the side of caution and recommend professional help.
"""

SYSTEM_PROMPTS = {
    "mental_health": f"""You are MindGuide, an empathetic AI mental wellness companion embedded in NeoPulse HealthOS.

## YOUR IDENTITY
You combine the warmth of a trusted friend with evidence-based psychological principles. You are trained in:
- Cognitive Behavioural Therapy (CBT) — identify and reframe thought patterns
- Dialectical Behaviour Therapy (DBT) — distress tolerance and emotional regulation
- Acceptance & Commitment Therapy (ACT) — psychological flexibility
- Mindfulness-Based Stress Reduction (MBSR) — present-moment awareness
- Motivational Interviewing — gentle, non-judgmental goal exploration

## HOW YOU RESPOND
1. **Validate first** — always acknowledge the emotion before offering techniques
2. **Ask before advising** — one clarifying question often helps more than immediate advice
3. **Personalise** — use the user's health context from NeoPulse naturally and gently
4. **Be concise** — 3-5 sentences unless the user clearly needs more
5. **Use plain language** — avoid clinical jargon; write like a caring human
6. **Offer agency** — always give the user a choice ("Would you like to try X, or would you prefer Y?")

## TECHNIQUES TO OFFER (when appropriate)
- 4-7-8 breathing, box breathing, physiological sigh
- 5-4-3-2-1 grounding (senses)
- Body scan, progressive muscle relaxation
- Thought records, cognitive restructuring
- Behavioural activation scheduling
- Values clarification exercises

## CONTEXT AWARENESS
When the user's NeoPulse data is provided, weave it in naturally:
- "I can see your stress has been elevated this week — that takes a real toll."
- "Your mood data shows a declining pattern over the last few days. What's been happening?"
Never fabricate context that wasn't provided. Never make the user feel surveilled.

{_BASE_SAFETY}""",

    "medication": f"""You are MindGuide, a medication information assistant in NeoPulse HealthOS.

## YOUR ROLE
- Explain medications, side effects, and adherence strategies in plain language
- Interpret drug interaction flags raised by NeoPulse's GNN model
- Help users understand their prescribed regimens (not change them)
- Provide practical adherence tips (timing, reminders, food interactions)
- Explain what the medication does in the body in simple terms

## COMMUNICATION RULES
1. Always preface with: "This is general information — please confirm with your pharmacist or doctor."
2. When the drug GNN flags severity=2 (dangerous): escalate immediately —
   "⚠️ Potential serious interaction detected. Please contact your prescriber today before taking both."
3. For severity=1: mention, don't alarm — "This combination is worth discussing with your pharmacist."
4. Never recommend stopping, changing dose, or swapping medications.
5. Format medication info clearly: what it is → what it does → common side effects → tips.

## ADHERENCE COACHING
- Use motivational techniques: understand barriers, not just remind
- Suggest pill organizers, phone alarms, habit stacking
- Normalise forgetting, focus on what to do next (never double-dose without advice)

{_BASE_SAFETY}""",

    "general_health": f"""You are MindGuide, a health and wellness guide in NeoPulse HealthOS.

## YOUR ROLE
- Answer health, lifestyle, and wellness questions with evidence-based information
- Help users understand their NeoPulse metrics (emotion trends, activity, sleep, stress)
- Provide actionable wellness recommendations grounded in current research
- Bridge tracked data insights to meaningful lifestyle changes
- Triage appropriately: identify when professional care is warranted

## RESPONSE STRUCTURE (for health info questions)
1. Direct answer first (no preamble)
2. Brief explanation of the science
3. 2-3 practical, actionable steps
4. When to see a doctor (if relevant)

## INTERPRETING NEOPULSE DATA
When metrics are available:
- Emotion score trends: explain what they mean for mental health trajectory
- Activity correlations: connect exercise patterns to mood and stress
- Sleep patterns: link to cognitive performance and emotional regulation
- Medication adherence: frame as self-care, not compliance

## SCOPE BOUNDARIES
- Wellness, nutrition, sleep, stress, exercise, preventive care ✓
- Diagnosing symptoms, prescribing, interpreting lab results ✗
- Safe triage: know when to say "please see a doctor for this"

{_BASE_SAFETY}""",
}

SUPPORTED_LANGUAGES = {
    "english":  {"name": "English",  "code": "en", "script": "Latin"},
    "hindi":    {"name": "Hindi",    "code": "hi", "script": "Devanagari"},
    "marathi":  {"name": "Marathi",  "code": "mr", "script": "Devanagari"},
    "telugu":   {"name": "Telugu",   "code": "te", "script": "Telugu"},
    "tamil":    {"name": "Tamil",    "code": "ta", "script": "Tamil"},
    "kannada":  {"name": "Kannada",  "code": "kn", "script": "Kannada"},
    "bengali":  {"name": "Bengali",  "code": "bn", "script": "Bengali"},
    "gujarati": {"name": "Gujarati", "code": "gu", "script": "Gujarati"},
    "punjabi":  {"name": "Punjabi",  "code": "pa", "script": "Gurmukhi"},
}


def build_system_prompt(
    mode: str,
    health_context: Optional[Dict] = None,
    pq_verified: bool = False,
    language: str = "english",
) -> str:
    base = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["general_health"])

    # ── Health context injection ─────────────────────────────────────
    if health_context:
        ctx_lines = ["\n\n## USER'S CURRENT HEALTH SNAPSHOT (from NeoPulse tracking)"]
        ctx_lines.append("*Use this to personalise your response naturally — don't list these like a report.*\n")

        if health_context.get("recent_emotion"):
            ctx_lines.append(f"- Dominant emotion (last 3 days): **{health_context['recent_emotion']}**")

        if health_context.get("stress_score") is not None:
            pct = round(health_context["stress_score"] * 100)
            level = "🔴 elevated" if pct > 65 else "🟡 moderate" if pct > 35 else "🟢 low"
            ctx_lines.append(f"- Stress level: {pct}% ({level})")

        if health_context.get("sleep_hours"):
            hrs = health_context["sleep_hours"]
            quality = "good" if hrs >= 7 else ("fair" if hrs >= 6 else "poor — below recommended minimum")
            ctx_lines.append(f"- Recent sleep: {hrs:.1f}h average ({quality})")

        if health_context.get("medication_adherence") is not None:
            pct = round(health_context["medication_adherence"] * 100)
            ctx_lines.append(f"- Medication adherence: {pct}%{'  ⚠️ needs attention' if pct < 70 else ''}")

        if health_context.get("last_activity"):
            ctx_lines.append(f"- Last activity: {health_context['last_activity']}")

        if health_context.get("mood_trend"):
            t = health_context["mood_trend"]
            arrow = "📈" if "improving" in t else ("📉" if "declining" in t else "➡️")
            ctx_lines.append(f"- Mood trend: {arrow} {t}")

        base += "\n".join(ctx_lines)

    # ── PQ-verified knowledge base ───────────────────────────────────
    if pq_verified:
        base += (
            "\n\n## KNOWLEDGE BASE CONTEXT"
            "\nThe retrieved documents below have been cryptographically verified via "
            "post-quantum Dilithium signatures (CRYSTALS-Dilithium). "
            "Treat them as authoritative medical/wellness sources. "
            "Cite with [Source N] where relevant. Do not fabricate sources."
        )

    # ── Language requirement ─────────────────────────────────────────
    if language and language.lower() in SUPPORTED_LANGUAGES:
        lang = SUPPORTED_LANGUAGES[language.lower()]
        base += (
            f"\n\n## LANGUAGE"
            f"\nRespond ENTIRELY in {lang['name']} using {lang['script']} script. "
            f"This is mandatory — do not mix languages unless the user does."
        )

    return base


# ── Options builder ───────────────────────────────────────────────────
def _build_options(temperature: float, max_tokens: int, mode: str = "chat") -> dict:
    """Build Ollama options dict with GPU acceleration."""
    opts = {
        "temperature":    temperature,
        "num_predict":    max_tokens,
        "num_ctx":        8192,          # larger context window for health conversations
        "top_p":          0.92,
        "top_k":          50,
        "repeat_penalty": 1.08,
        "stop":           ["User:", "Human:", "<|end|>", "<|im_end|>"],
    }
    # GPU acceleration — offload all layers if VRAM allows
    if OLLAMA_NUM_GPU != 0:
        opts["num_gpu"] = OLLAMA_NUM_GPU   # -1 = auto (Ollama chooses based on VRAM)
    return opts


# ═══════════════════════════════════════════════════════════════════
# Core API calls
# ═══════════════════════════════════════════════════════════════════

async def stream_response(
    messages: List[Dict],
    system: str,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
    mode: str = "chat",
) -> AsyncGenerator[str, None]:
    """
    Token-by-token streaming generator.
    Yields text chunks as they arrive from Ollama.
    GPU acceleration is applied automatically via num_gpu option.
    """
    if model is None:
        model = await resolve_model()

    payload = {
        "model":    model,
        "messages": [{"role": "system", "content": system}] + messages,
        "stream":   True,
        "think":    False,
        "options":  _build_options(temperature, max_tokens, mode),
    }

    try:
        async with _get_client().stream(
            "POST",
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            timeout=None,   # streaming — no read timeout
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        yield f"data: {token}\n\n"
                    if chunk.get("done"):
                        break
                except json.JSONDecodeError:
                    continue

    except httpx.ConnectError:
        yield "\n\n[MindGuide offline — Ollama not running. Start with: `ollama serve`]"
    except Exception as e:
        logger.error(f"Ollama stream error: {e}")
        yield f"\n\n[Stream error: {str(e)}]"


async def chat(
    messages: List[Dict],
    system: str,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> Dict:
    """
    Non-streaming chat completion.
    Returns full response dict.
    GPU acceleration applied via num_gpu option.
    """
    if model is None:
        model = await resolve_model()

    payload = {
        "model":    model,
        "messages": [{"role": "system", "content": system}] + messages,
        "stream":   False,
        "think":    False,
        "options":  _build_options(temperature, max_tokens),
    }

    t0 = time.time()
    try:
        r = await _get_client().post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            timeout=120.0,
        )
        r.raise_for_status()
        data    = r.json()
        content = data.get("message", {}).get("content", "").strip()
        return {
            "content":  content,
            "model":    model,
            "time_ms":  round((time.time() - t0) * 1000),
            "tokens":   data.get("eval_count", 0),
            "done":     True,
            "gpu_used": OLLAMA_NUM_GPU != 0,
        }
    except httpx.ConnectError:
        raise RuntimeError("Ollama not running. Start with: ollama serve")
    except Exception as e:
        raise RuntimeError(f"Ollama error: {e}")


async def quick_response(question: str, mode: str = "general_health") -> str:
    """Fast single-turn response. Uses fastest available model."""
    model  = await resolve_model(force_fast=True)
    system = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["general_health"])
    result = await chat(
        [{"role": "user", "content": question}],
        system=system,
        model=model,
        temperature=0.5,
        max_tokens=400,
    )
    return result["content"]


# ═══════════════════════════════════════════════════════════════════
# Crisis detection — local fast check BEFORE sending to model
# ═══════════════════════════════════════════════════════════════════

# Comprehensive multilingual crisis patterns
CRISIS_PATTERNS = [
    # English
    "want to die", "kill myself", "end my life", "suicide", "suicidal",
    "no reason to live", "hurt myself", "self harm", "cut myself",
    "can't go on", "give up on life", "take my life", "not worth living",
    "end it all", "better off dead", "disappear forever", "don't want to exist",
    "overdose", "hang myself", "jump off",
    # Hindi (Devanagari)
    "मरना चाहता", "मरना चाहती", "खुद को नुकसान", "आत्महत्या",
    "जीना नहीं चाहता", "जीना नहीं चाहती", "खुद को मारना",
    "मर जाना चाहता", "मर जाना चाहती", "जिंदगी खत्म",
    # Hindi (romanised)
    "marna chahta", "marna chahti", "aatmhatya", "khud ko nuksaan",
    "jeena nahi chahta", "jeena nahi chahti",
    # Marathi
    "मला मरायचं आहे", "आत्महत्या करायची", "स्वतःला इजा",
    # Tamil
    "தற்கொலை", "சாக வேண்டும்",
    # Telugu
    "ఆత్మహత్య", "చనిపోవాలని",
]

CRISIS_RESPONSE = """I hear you, and I'm really glad you reached out. You matter.

Please connect with someone who can help right now:

• **iCall India**: 9152987821 (Mon–Sat, 8am–10pm IST) — trained counsellors
• **Vandrevala Foundation**: 1860-2662-345 (24/7, multilingual)
• **AASRA**: 9820466627 (24/7)
• **Emergency**: 112

If you're in immediate danger, please go to your nearest emergency room.

---

I'm here with you while you reach out. Would you like to try a grounding exercise together? \
Just focus on 5 things you can see around you right now — I'll guide you through the rest."""


def detect_crisis(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in CRISIS_PATTERNS)
