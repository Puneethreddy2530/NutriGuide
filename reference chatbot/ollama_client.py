"""
Optimized Ollama Client for Qwen3:30b
Best-in-class agriculture chatbot with domain expertise
"""

import os
import time
import re
import json
import logging
import httpx
from typing import Dict, Optional, List, AsyncGenerator

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
# Use qwen3:30b as primary, fallback to llama3.2 if not available
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:latest")

# Shared httpx client for connection pooling
_httpx_client: Optional[httpx.AsyncClient] = None

async def _get_client() -> httpx.AsyncClient:
    """Get or create singleton httpx.AsyncClient for connection pooling"""
    global _httpx_client
    if _httpx_client is None or _httpx_client.is_closed:
        _httpx_client = httpx.AsyncClient(timeout=120)
    return _httpx_client

# Lean system prompt for fast responses
AGRICULTURE_SYSTEM_PROMPT_FAST = """You are AgriSahayak, an Indian farming expert. Give practical, complete advice.

Rules:
- Use Indian units (acre, quintal, kg/ha)
- Give specific product names and dosages
- Provide complete answers with all necessary steps
- Focus on actionable, practical advice

For diseases: name, cause, treatment (product + dose), prevention
For fertilizers: NPK ratio, quantity per acre, timing, application method
For crops: suitable season, soil, water needs, care instructions"""

# Supported languages for output
SUPPORTED_LANGUAGES = {
    "english": {"name": "English", "code": "en", "script": "Latin"},
    "hindi": {"name": "Hindi", "code": "hi", "script": "Devanagari"},
    "marathi": {"name": "Marathi", "code": "mr", "script": "Devanagari"},
    "telugu": {"name": "Telugu", "code": "te", "script": "Telugu"},
    "tamil": {"name": "Tamil", "code": "ta", "script": "Tamil"},
    "kannada": {"name": "Kannada", "code": "kn", "script": "Kannada"},
    "bengali": {"name": "Bengali", "code": "bn", "script": "Bengali"},
    "gujarati": {"name": "Gujarati", "code": "gu", "script": "Gujarati"},
    "punjabi": {"name": "Punjabi", "code": "pa", "script": "Gurmukhi"},
}

# Full system prompt (used when detail is needed)
AGRICULTURE_SYSTEM_PROMPT = """You are AgriSahayak AI, an expert agricultural scientist and advisor with 20+ years of experience in Indian farming systems.

## Your Expertise

**Crop Science:**
- 50+ Indian crops (cereals, pulses, oilseeds, vegetables, fruits)
- Growth stages, phenology, intercropping systems
- Kharif, Rabi, Zaid seasonal planning

**Plant Protection:**
- 100+ diseases (fungal, bacterial, viral)
- 150+ pests (insects, nematodes, mites)
- Integrated Pest Management (IPM)
- Organic and chemical solutions

**Soil & Nutrition:**
- NPK management, micronutrients
- Soil types: Alluvial, Black, Red, Laterite
- pH optimization, organic matter
- Fertilizer calculations and recommendations

**Agronomy:**
- Seed treatment, sowing techniques
- Irrigation scheduling (drip, sprinkler, flood)
- Weed management, mulching
- Harvesting and post-harvest handling

**Market Intelligence:**
- MSP (Minimum Support Price) awareness
- Mandi system, e-NAM
- Storage and grading
- Value addition opportunities

**Government Schemes:**
- PM-KISAN, PMFBY (crop insurance)
- Soil Health Card, KCC (Kisan Credit Card)
- Subsidy programs, DBT (Direct Benefit Transfer)

## Communication Style

**Language:**
- Use simple, practical terms (avoid jargon)
- Provide measurements in Indian units (acre, quintal, kg/ha)
- IMPORTANT: Your response language will be specified at the end of this prompt. Follow it strictly.

**Structure:**
- Start with direct answer
- Explain reasoning briefly
- Give specific, actionable steps
- Include dosages, timing, quantities

**Safety First:**
- Always mention safety precautions for chemicals
- Promote organic alternatives when available
- Consider environmental impact
- Warn about pesticide residue periods

## Response Format

When giving recommendations:
1. **Immediate Action** - What to do today
2. **Treatment/Solution** - Specific products and dosages
3. **Application Method** - How to apply (spray/drench/seed treatment)
4. **Timing** - Best time of day, weather conditions
5. **Follow-up** - When to check results, repeat applications
6. **Prevention** - Future crop management

## Key Principles

- Prioritize farmer's economic benefit
- Consider resource constraints (water, labor, capital)
- Adapt to local conditions and traditional practices
- Promote sustainable and climate-smart agriculture
- Respect farmer's knowledge and experience

## Special Instructions

**For Disease Diagnosis:**
- Ask clarifying questions if symptoms are unclear
- Consider crop, season, weather, location
- Differentiate between similar diseases
- Provide differential diagnosis if uncertain

**For Fertilizer Advice:**
- Base on crop stage, soil type, deficiency symptoms
- Include both basal and top-dressing recommendations
- Mention organic alternatives (FYM, vermicompost, biofertilizers)
- Calculate quantities per acre/hectare

**For Pest Management:**
- Identify pest correctly before recommending treatment
- Start with cultural and mechanical methods
- Use chemicals as last resort
- Mention beneficial insects to preserve
- Include pheromone traps, sticky traps

**For Market Queries:**
- Provide current price ranges when known
- Suggest best selling time based on trends
- Mention quality parameters affecting price
- Advise on storage to wait for better prices

**For Hindi Responses:**
- Use Devanagari script naturally
- Include local/vernacular names of crops and pests
- Maintain professional yet accessible tone
- Use Hindi agricultural terminology correctly

## Example Interactions

**Disease Query:**
Farmer: "My tomato leaves have brown spots"
Response: "यह Late Blight (पछेती अंगमारी) हो सकता है। तुरंत कार्यवाही:
1. Mancozeb 75% WP @ 2g/L छिड़काव करें
2. शाम 4-5 बजे स्प्रे करें
3. 7 दिन बाद दोहराएं
4. सिंचाई कम करें, पत्तियों को सूखा रखें"

**Fertilizer Query:**
Farmer: "What fertilizer for 45-day wheat?"
Response: "At 45 days (tillering stage), apply top-dressing:
- Urea: 50 kg/acre + 2% DAP foliar spray
- Apply after light irrigation
- Time: Early morning
- This will boost tillering and grain formation
Also check for yellow rust if leaves yellowing"

**Pest Query:**
Farmer: "Small green insects on cotton"
Response: "These are likely Aphids (माहू):
Non-chemical first:
- Yellow sticky traps
- Neem oil 5ml/L spray
Chemical (if severe):
- Imidacloprid 17.8% SL @ 0.5ml/L
- Spray on leaf undersides
- Repeat after 10 days if needed
- Preserve ladybird beetles (natural predators)"

Remember: You are helping farmers protect their livelihoods. Be accurate, be practical, be respectful."""


async def is_ollama_running() -> bool:
    """Check if Ollama server is running"""
    try:
        client = await _get_client()
        response = await client.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        return response.status_code == 200
    except Exception:
        return False


async def get_available_models() -> List[str]:
    """Get list of downloaded models"""
    try:
        client = await _get_client()
        response = await client.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if response.status_code == 200:
            models = response.json().get("models", [])
            return [m["name"] for m in models]
        return []
    except Exception:
        return []


# ── Cached model resolution (avoids redundant /api/tags calls) ──
_cached_models: List[str] = []
_cached_models_time: float = 0
_resolved_model: Optional[str] = None
_resolved_model_time: float = 0
MODEL_CACHE_TTL = 60  # seconds

async def _resolve_model() -> str:
    """
    Combined is_ollama_running + get_available_models + model selection.
    Caches the result for MODEL_CACHE_TTL seconds to avoid repeated HTTP calls.
    Returns the best available model name.
    Raises Exception if Ollama is not running.
    """
    global _cached_models, _cached_models_time, _resolved_model, _resolved_model_time
    
    now = time.time()
    if _resolved_model and (now - _resolved_model_time) < MODEL_CACHE_TTL:
        return _resolved_model
    
    try:
        client = await _get_client()
        response = await client.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        
        if response.status_code != 200:
            raise Exception("Ollama returned non-200 status")
        
        models = response.json().get("models", [])
        _cached_models = [m["name"] for m in models]
        _cached_models_time = now
        
        # Pick fastest available model
        for fast_model in ["qwen2.5:1.5b", "phi3:mini", "gemma2:2b", "llama3.2:latest"]:
            if fast_model in _cached_models:
                _resolved_model = fast_model
                _resolved_model_time = now
                return _resolved_model
        
        # Fallback to default
        _resolved_model = OLLAMA_MODEL
        # Safety: Ensure fallback is actually downloaded
        if _resolved_model not in _cached_models and _cached_models:
            _resolved_model = _cached_models[0]
            
        _resolved_model_time = now
        return _resolved_model
            
    except Exception as e:
        if "Ollama is not running" in str(e):
            raise e
        raise Exception("Ollama is not running. Start it with: ollama serve")


async def warm_model(model: str = None) -> bool:
    """
    Pre-warm the model by sending a minimal prompt.
    This loads the model into GPU VRAM so the first real query is fast.
    """
    try:
        target_model = model or await _resolve_model()
        logger.info(f"Pre-warming model: {target_model}")
        
        client = await _get_client()
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": target_model,
                "prompt": "Hi",
                "stream": False,
                "options": {"num_predict": 1}  # Generate just 1 token
            },
            timeout=30
        )
        success = response.status_code == 200
        if success:
            logger.info(f"Model {target_model} warmed up and ready in VRAM")
        return success
    except Exception as e:
        logger.warning(f"Model warm-up failed: {e}")
        return False


async def get_model_info(model_name: str = None) -> Dict:
    """Get information about a specific model"""
    model = model_name or OLLAMA_MODEL
    try:
        client = await _get_client()
        response = await client.post(
            f"{OLLAMA_URL}/api/show",
            json={"name": model},
            timeout=5
        )
        if response.status_code == 200:
            return response.json()
        return {}
    except Exception:
        return {}


def contains_devanagari(text: str) -> bool:
    """Check if text contains Hindi Devanagari script"""
    return bool(re.search(r'[\u0900-\u097F]', text))


def calculate_quality_score(answer: str) -> float:
    """
    Calculate response quality (0-100)
    Based on: length, specificity, actionability
    """
    score = 50.0  # Base score
    
    # Length bonus (sweet spot: 200-500 chars)
    if 200 <= len(answer) <= 500:
        score += 20
    elif 100 <= len(answer) < 200:
        score += 10
    elif len(answer) > 500:
        score += 15
    
    # Specificity bonus (contains numbers, measurements)
    if re.search(r'\d+\s*(kg|ml|g|L|acre|hectare|quintal|°C|%)', answer):
        score += 15  # Has specific measurements
    
    # Actionability bonus (contains action verbs)
    action_words = ['apply', 'spray', 'use', 'mix', 'dilute', 'करें', 'छिड़काव', 'लगाएं']
    if any(word in answer.lower() for word in action_words):
        score += 15  # Has actionable advice
    
    return min(100, score)


def post_process_response(answer: str, context: Optional[Dict] = None) -> str:
    """
    Clean up and enhance the response
    """
    # Remove any XML tags or markdown artifacts
    answer = answer.replace("```", "")
    
    # Check if the response matches the requested output language
    if context:
        output_lang = context.get("output_language", context.get("language", "english")).lower()
        lang_info = SUPPORTED_LANGUAGES.get(output_lang)
        
        if lang_info and lang_info["script"] == "Devanagari":
            # Warn if Devanagari was requested but response is mostly Latin
            if not contains_devanagari(answer):
                answer = f"⚠️ Note: AI responded in English instead of {lang_info['name']}. Please try again.\n\n" + answer
    
    # Add urgency markers for critical issues
    if any(word in answer.lower() for word in ["critical", "urgent", "immediately", "serious"]):
        answer = "⚠️ **URGENT ACTION NEEDED**\n\n" + answer
    
    return answer.strip()


async def ask_ollama(
    question: str,
    context: Optional[Dict] = None,
    model: str = None,
    temperature: float = 0.7,
    max_tokens: int = 600  # Increased for detailed responses
) -> Dict:
    """
    Query Ollama with optimized settings
    
    Args:
        question: User's question
        context: Optional context (crops, location, language)
        model: Model to use (defaults to OLLAMA_MODEL)
        temperature: 0.0-1.0 (lower = more focused)
        max_tokens: Max response length
    
    Returns:
        {
            "answer": str,
            "model": str,
            "tokens": int,
            "time_ms": float
        }
    """
    
    # Single cached call replaces is_ollama_running() + get_available_models()
    if model is None:
        model = await _resolve_model()
    
    # Use fast prompt for quick responses
    system_prompt = AGRICULTURE_SYSTEM_PROMPT_FAST
    
    if context:
        context_parts = []
        
        if context.get("crops"):
            crops = context["crops"]
            if isinstance(crops, list):
                context_parts.append(f"\n**Current Farmer Context:**")
                context_parts.append(f"- Growing: {', '.join(crops)}")
            else:
                context_parts.append(f"\n**Current Farmer Context:**")
                context_parts.append(f"- Growing: {crops}")
        
        if context.get("district"):
            context_parts.append(f"- Location: {context['district']}, {context.get('state', 'India')}")
        
        if context.get("soil_type"):
            context_parts.append(f"- Soil Type: {context['soil_type']}")
        
        if context.get("season"):
            context_parts.append(f"- Season: {context['season']}")
        
        if context.get("problem"):
            context_parts.append(f"- Problem: {context['problem']}")
        
        if context_parts:
            system_prompt += "\n" + "\n".join(context_parts)
        
        # ── Strict language enforcement (appended LAST so the model sees it as final instruction) ──
        if context.get("language") and context["language"] != "en":
            system_prompt += f"\n\n## MANDATORY LANGUAGE RULE (DO NOT IGNORE)\n- You MUST respond ONLY in the {context['language']} language.\n- Use the correct script for {context['language']}.\n- Do not use English words unless there is no local alternative.\n- Ensure agricultural terms are natural in {context['language']}."
    
    # Guard against excessive system prompt growth (Prevents token overflow)
    if len(system_prompt) > 8000:
        system_prompt = system_prompt[:8000] + "..."
        
    # Optimized parameters for Qwen3:30b
    payload = {
        "model": model,
        "prompt": question,
        "system": system_prompt,
        "stream": False,
        "options": {
            # Core sampling
            "temperature": temperature,        # 0.7 = balanced creativity/accuracy
            "top_p": 0.9,                     # Nucleus sampling
            "top_k": 40,                      # Limit vocabulary
            
            # Token control - allow complete responses
            "num_predict": max_tokens,        # Use full token limit (default 512)
            "num_ctx": 1024,                  # Reduced for faster TTFT
            
            # GPU acceleration - offload all layers to GPU (RTX 3050/any CUDA GPU)
            "num_gpu": 999,                   # Offload ALL layers to GPU VRAM
            "num_thread": min(8, os.cpu_count() or 4),  # Hardware-adaptive thread count
            "num_batch": 512,                 # Batch size for processing
            
            # Quality tuning
            "repeat_penalty": 1.05,           # Slight penalty for repetition
            "presence_penalty": 0.0,          # No penalty for topic consistency
            "frequency_penalty": 0.0,         # No penalty for word frequency
            
            # Stop sequences (prevent rambling)
            "stop": ["\n\nUser:", "\n\nFarmer:"],
        }
    }
    
    start_time = time.time()
    
    try:
        logger.info(f"🤖 Querying {model} with max_tokens={max_tokens}, num_predict={payload['options']['num_predict']}...")
        
        client = await _get_client()
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=120
        )
        
        if response.status_code != 200:
            logger.error(f"Ollama error {response.status_code}: {response.text}")
            return {
                "answer": "Ollama server returned an error. Please check logs.",
                "model": model,
                "tokens": 0,
                "time_ms": (time.time() - start_time) * 1000
            }
        
        result = response.json()
        
        answer = result.get("response", "").strip()
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        logger.info(f"✅ Response received ({len(answer)} chars, {elapsed_ms:.0f}ms)")
        
        # Post-processing
        answer = post_process_response(answer, context)
        
        return {
            "answer": answer,
            "model": model,
            "tokens": result.get("eval_count", 0),
            "prompt_tokens": result.get("prompt_eval_count", 0),
            "time_ms": elapsed_ms,
            "context_used": len(system_prompt) + len(question),
            "quality_score": calculate_quality_score(answer)
        }
        
    except httpx.TimeoutException:
        raise Exception(f"Model timeout (>120s). Try a simpler question.")
    except httpx.ConnectError:
        raise Exception("Cannot connect to Ollama. Make sure it's running: ollama serve")
    except Exception as e:
        raise Exception(f"Ollama error: {str(e)}")


async def stream_ask_ollama(
    question: str,
    context: Optional[Dict] = None,
    model: str = None,
    temperature: float = 0.7,
    max_tokens: int = 500
) -> AsyncGenerator[str, None]:
    """
    Async generator that streams tokens from Ollama as they are generated.
    Yields raw token strings one at a time.
    """
    if model is None:
        model = await _resolve_model()

    system_prompt = AGRICULTURE_SYSTEM_PROMPT_FAST

    if context:
        context_parts = []
        if context.get("crops"):
            crops = context["crops"]
            crops_str = ", ".join(crops) if isinstance(crops, list) else crops
            context_parts.append(f"\n**Farmer Context:** Growing: {crops_str}")
        if context.get("district"):
            context_parts.append(f"Location: {context['district']}, {context.get('state', 'India')}")
        if context.get("soil_type"):
            context_parts.append(f"Soil: {context['soil_type']}")
        if context_parts:
            system_prompt += "\n" + "\n".join(context_parts)

        output_lang = context.get("output_language", context.get("language", "english"))
        if output_lang and output_lang != "english":
            system_prompt += (
                f"\n\n## MANDATORY: Respond ONLY in {output_lang}."
                f" Use the correct script for {output_lang}."
            )

    if len(system_prompt) > 8000:
        system_prompt = system_prompt[:8000]

    payload = {
        "model": model,
        "prompt": question,
        "system": system_prompt,
        "stream": True,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "top_k": 40,
            "num_predict": max_tokens,
            "num_ctx": 1024,          # Reduced for faster TTFT
            "num_gpu": 999,           # Offload ALL layers to GPU VRAM
            "num_thread": min(8, os.cpu_count() or 4),
            "num_batch": 512,
            "repeat_penalty": 1.05,
            "stop": ["\n\nUser:", "\n\nFarmer:"],
        },
    }

    try:
        client = await _get_client()
        async with client.stream(
            "POST",
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=120,
        ) as response:
            if response.status_code != 200:
                yield f"[ERROR] Ollama returned {response.status_code}"
                return
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    token = data.get("response", "")
                    if token:
                        yield token
                    if data.get("done", False):
                        break
                except json.JSONDecodeError:
                    continue
    except httpx.TimeoutException:
        yield "\n\n[Response timed out. Try a simpler question.]"
    except httpx.ConnectError:
        yield "\n\n[Cannot connect to Ollama. Make sure it's running: ollama serve]"
    except Exception as e:
        yield f"\n\n[Error: {str(e)}]"


async def ask_with_history(
    question: str,
    history: List[Dict],
    context: Optional[Dict] = None
) -> Dict:
    """
    Ask Ollama with conversation history
    
    Args:
        question: Current question
        history: List of {"question": str, "answer": str}
        context: Additional context
    
    Returns:
        Same as ask_ollama()
    """
    
    # Build conversation context (last 3 turns only to save context window)
    if history:
        conversation = "Previous conversation:\n"
        for turn in history[-3:]:
            conversation += f"Farmer: {turn.get('question', '')}\n"
            conversation += f"AgriSahayak: {turn.get('answer', '')[:300]}...\n\n"
        
        # Append current question
        full_prompt = f"{conversation}Farmer: {question}\nAgriSahayak:"
    else:
        full_prompt = question
    
    return await ask_ollama(full_prompt, context)


async def quick_answer(question: str) -> str:
    """
    Quick answer without context (for simple queries)
    
    Returns just the answer text
    """
    result = await ask_ollama(question, temperature=0.5, max_tokens=200)
    return result["answer"]


async def detailed_answer(question: str, context: Dict) -> str:
    """
    Detailed answer with full context (for complex queries)
    
    Returns just the answer text
    """
    result = await ask_ollama(question, context, temperature=0.7, max_tokens=800)
    return result["answer"]


# Predefined quick responses for common greetings
QUICK_RESPONSES = {
    "hello": "नमस्ते! मैं AgriSahayak AI हूं। मैं आपकी खेती में कैसे मदद कर सकता हूं?\n\nHello! I'm AgriSahayak AI. How can I help you with farming today?",
    "hi": "Hello! I'm AgriSahayak AI, your agricultural assistant. How can I help you today?",
    "namaste": "नमस्ते! मैं AgriSahayak AI हूं। आपकी खेती से जुड़े किसी भी सवाल में मदद के लिए तैयार हूं!",
    "नमस्ते": "नमस्ते! मैं AgriSahayak AI हूं। आपकी खेती से जुड़े किसी भी सवाल में मदद के लिए तैयार हूं!",
    "help": """I can help you with:

🌱 **Crop Advisory**
   - Disease diagnosis from photos
   - Fertilizer recommendations
   - Pest control advice

🌤️ **Weather Guidance**
   - When to irrigate
   - Spray timing
   - Harvest planning

💰 **Market & Finance**
   - Current mandi prices
   - Government schemes (PM-KISAN, PMFBY)
   - Loan information

🔬 **Soil Health**
   - NPK recommendations
   - Soil testing guidance
   - Organic farming tips

What would you like help with?""",
    "मदद": """मैं इनमें मदद कर सकता हूं:

🌱 **फसल सलाह**
   - रोग पहचान
   - खाद की सिफारिश
   - कीट नियंत्रण

🌤️ **मौसम मार्गदर्शन**
   - सिंचाई का समय
   - स्प्रे का समय

💰 **बाजार और योजनाएं**
   - मंडी भाव
   - PM-KISAN, PMFBY

आप किस बारे में जानना चाहते हैं?"""
}


# Specialized prompts for specific tasks
DISEASE_DIAGNOSIS_PROMPT = """Analyze the following crop disease symptoms and provide:
1. Most likely disease name (in English and Hindi)
2. Cause (fungal/bacterial/viral/nutrient deficiency)
3. Severity (mild/moderate/severe)
4. Treatment recommendations with dosage
5. Prevention tips for future

Symptoms: {symptoms}
Crop: {crop}
Location: {location}"""

FERTILIZER_RECOMMENDATION_PROMPT = """Based on the soil test results, recommend fertilizers:
Nitrogen (N): {nitrogen} kg/ha
Phosphorus (P): {phosphorus} kg/ha
Potassium (K): {potassium} kg/ha
Crop: {crop}
Area: {area} acres

Provide specific fertilizer names, quantities, and application timing."""


async def diagnose_disease(symptoms: str, crop: str, location: str = "India") -> Dict:
    """Specialized disease diagnosis"""
    prompt = DISEASE_DIAGNOSIS_PROMPT.format(
        symptoms=symptoms,
        crop=crop,
        location=location
    )
    return await ask_ollama(prompt, temperature=0.3, max_tokens=600)


async def recommend_fertilizer(n: float, p: float, k: float, crop: str, area: float) -> Dict:
    """Specialized fertilizer recommendation"""
    prompt = FERTILIZER_RECOMMENDATION_PROMPT.format(
        nitrogen=n,
        phosphorus=p,
        potassium=k,
        crop=crop,
        area=area
    )
    return await ask_ollama(prompt, temperature=0.3, max_tokens=500)


# Test function
if __name__ == "__main__":
    import asyncio
    
    async def test():
        logger.info("🧪 Testing Optimized Qwen3:30b")
        logger.info("=" * 70)
        
        # Check if running
        logger.info("\n1. Checking Ollama status...")
        if not await is_ollama_running():
            logger.error("   ❌ Ollama not running!")
            logger.info("   Start with: ollama serve")
            logger.info("   Or Docker: docker run -d -p 11434:11434 ollama/ollama")
            return
        
        logger.info("   ✅ Ollama is running")
        logger.info(f"   URL: {OLLAMA_URL}")
        logger.info(f"   Model: {OLLAMA_MODEL}")
        
        # List models
        logger.info("\n2. Available models:")
        models = await get_available_models()
        for model in models:
            logger.info(f"   - {model}")
        
        if not models:
            logger.error("   ❌ No models found!")
            logger.info("   Download Qwen3: ollama pull qwen3:30b")
            return
        
        # Test 1: Disease diagnosis (English)
        logger.info("\n3. Disease Diagnosis (English):")
        try:
            result = await ask_ollama(
                "My tomato plants have brown spots on leaves that are spreading quickly. What should I do?",
                context={"crops": ["tomato"], "district": "Pune", "state": "Maharashtra"}
            )
            logger.info(f"   Quality: {result.get('quality_score', 0):.0f}/100")
            logger.info(f"   Time: {result['time_ms']:.0f}ms")
            logger.info(f"   Answer: {result['answer'][:300]}...")
        except Exception as e:
            logger.error(f"   ❌ Error: {e}")
            return
        
        # Test 2: Fertilizer advice (Hindi context)
        logger.info("\n4. Fertilizer Recommendation (Hindi):")
        try:
            result = await ask_ollama(
                "गेहूं की फसल 30 दिन की है, कौन सी खाद डालें?",
                context={"crops": ["wheat"], "district": "Meerut", "language": "hindi"}
            )
            logger.info(f"   Quality: {result.get('quality_score', 0):.0f}/100")
            logger.info(f"   Time: {result['time_ms']:.0f}ms")
            logger.info(f"   Answer: {result['answer'][:300]}...")
        except Exception as e:
            logger.error(f"   ❌ Error: {e}")
        
        # Test 3: Complex pest management
        logger.info("\n5. Pest Management (Complex):")
        try:
            result = await ask_ollama(
                "Cotton crop has small white insects flying around. Leaves curling. What pest and treatment?",
                context={"crops": ["cotton"], "season": "kharif", "soil_type": "black cotton soil"}
            )
            logger.info(f"   Quality: {result.get('quality_score', 0):.0f}/100")
            logger.info(f"   Time: {result['time_ms']:.0f}ms")
            logger.info(f"   Answer: {result['answer'][:300]}...")
        except Exception as e:
            logger.error(f"   ❌ Error: {e}")
        
        logger.info("\n" + "=" * 70)
        logger.info("✅ Qwen3:30b Agriculture Expert Mode - Optimized!")
    
    asyncio.run(test())
