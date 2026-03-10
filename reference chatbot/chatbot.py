"""
AI Chatbot API Endpoints - Pure Ollama
No external API dependencies - runs locally

Endpoints:
- POST /ask - Ask the chatbot
- GET /health - Check Ollama status
- GET /models - List available models
- POST /test - Quick test
- GET /history/{farmer_id} - Get chat history
"""

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
import logging
import time
import json
from collections import defaultdict

from app.api.v1.endpoints.auth import optional_auth, get_current_user, UserInfo, Depends

from app.chatbot.ollama_client import (
    ask_ollama,
    ask_with_history,
    is_ollama_running,
    get_available_models,
    get_model_info,
    diagnose_disease,
    recommend_fertilizer,
    warm_model,
    stream_ask_ollama,
    QUICK_RESPONSES,
    OLLAMA_MODEL,
    SUPPORTED_LANGUAGES
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple In-Memory Rate Limiting
REQUEST_LOG = defaultdict(list)
RATE_LIMIT_PER_MIN = 10


# ==================================================
# REQUEST/RESPONSE MODELS
# ==================================================

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000, description="User's question")
    language: Optional[str] = Field("english", description="Input language hint: english, hindi, etc.")
    output_language: Optional[str] = Field(None, description="Output language for AI response. If not set, defaults to 'language' value. Options: english, hindi, marathi, telugu, tamil, kannada, bengali, gujarati, punjabi")
    context: Optional[Dict] = Field(None, description="Additional context (crops, district, soil_type)")
    use_history: bool = Field(False, description="Include conversation history")
    max_tokens: int = Field(600, ge=50, le=2000, description="Maximum response tokens")
    
    class Config:
        json_schema_extra = {
            "example": {
                "question": "My tomato leaves are turning yellow. What should I do?",
                "language": "english",
                "output_language": "english",
                "context": {
                    "crops": ["tomato"],
                    "district": "Pune",
                    "state": "Maharashtra"
                },
                "use_history": False
            }
        }


class ChatResponse(BaseModel):
    question: str
    answer: str
    source: str = "ollama-local"
    model: str
    language: str
    tokens: int = 0
    time_ms: float
    timestamp: str


class DiseaseRequest(BaseModel):
    symptoms: str = Field(..., description="Description of disease symptoms")
    crop: str = Field(..., description="Affected crop name")
    location: Optional[str] = Field("India", description="Location/state")


class FertilizerRequest(BaseModel):
    nitrogen: float = Field(..., ge=0, le=500, description="Nitrogen in kg/ha")
    phosphorus: float = Field(..., ge=0, le=500, description="Phosphorus in kg/ha")
    potassium: float = Field(..., ge=0, le=500, description="Potassium in kg/ha")
    crop: str = Field(..., description="Target crop")
    area: float = Field(..., gt=0, description="Area in acres")


# ==================================================
# MAIN ENDPOINTS
# ==================================================

@router.post("/ask", response_model=ChatResponse)
async def ask_chatbot(
    request: ChatRequest,
    req: Request,
    user: Optional[UserInfo] = Depends(optional_auth)
):
    """
    Ask AgriSahayak AI Chatbot
    
    Features:
    - Agriculture-specific responses
    - Multi-language (English, Hindi)
    - Conversation history support
    - Context-aware (crops, location, soil)
    
    Example questions:
    - "What causes yellow leaves in tomato plants?"
    - "Which fertilizer is best for wheat crop?"
    - "टमाटर की खेती के लिए सबसे अच्छा समय क्या है?"
    """
    # 0. Strip whitespace and check for empty questions
    question = request.question.strip()
    if not question:
        raise HTTPException(400, "Question cannot be empty.")
    
    # 1. Rate Limiting
    now = time.time()
    user_key = user.phone if user else getattr(getattr(req, 'client', None), 'host', 'anonymous')
    REQUEST_LOG[user_key] = [t for t in REQUEST_LOG[user_key] if now - t < 60]
    
    if len(REQUEST_LOG[user_key]) >= RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute.")
    
    REQUEST_LOG[user_key].append(now)

    # 2. Input Validation
    if request.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {request.language}")
    
    if request.output_language and request.output_language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported output language: {request.output_language}")

    # 3. Check for quick responses (greetings) before hitting Ollama
    question_lower = question.lower()
    if question_lower in QUICK_RESPONSES:
        return ChatResponse(
            question=request.question,
            answer=QUICK_RESPONSES[question_lower],
            model="rule-based",
            language=request.language,
            tokens=0,
            time_ms=0,
            timestamp=datetime.now().isoformat()
        )
    
    try:
        # 3.5 Protect against context injection
        allowed_context_keys = {"crops", "district", "state", "soil_type"}
        clean_context = {k: v for k, v in (request.context or {}).items() if k in allowed_context_keys}
        
        # Build context with explicit language controls
        context = clean_context
        context["language"] = request.language
        # output_language defaults to the input language if not explicitly set
        context["output_language"] = request.output_language or request.language
        
        logger.info(f"Chat request: user={user.farmer_id if user else 'anonymous'}, input_lang={request.language}, output_lang={context['output_language']}")
        
        # Get conversation history if requested
        if request.use_history:
            # TODO: Integrate with Supabase to fetch history
            history = []  # Placeholder - implement get_chat_history
            result = await ask_with_history(
                request.question,
                history,
                context
            )
        else:
            result = await ask_ollama(
                request.question,
                context,
                max_tokens=request.max_tokens
            )
        
        # TODO: Save to Supabase for history tracking
        # await save_chat(user.farmer_id, request.question, result["answer"])
        
        return ChatResponse(
            question=question,
            answer=result["answer"],
            model=result["model"],
            language=request.language,
            tokens=result.get("tokens", 0),
            time_ms=result["time_ms"],
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Ollama error: {str(e)}"
        )


@router.post("/ask/stream")
async def ask_chatbot_stream(
    request: ChatRequest,
    req: Request,
    user: Optional[UserInfo] = Depends(optional_auth)
):
    """
    Streaming version of the chatbot — tokens appear as they are generated.
    Returns Server-Sent Events (text/event-stream).
    Each event: data: {"token": "..."}\n\n
    Final event: data: {"done": true, "time_ms": ...}\n\n
    """
    question = request.question.strip()
    if not question:
        raise HTTPException(400, "Question cannot be empty.")

    # Rate Limiting
    now = time.time()
    user_key = user.phone if user else getattr(getattr(req, 'client', None), 'host', 'anonymous')
    REQUEST_LOG[user_key] = [t for t in REQUEST_LOG[user_key] if now - t < 60]
    if len(REQUEST_LOG[user_key]) >= RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute.")
    REQUEST_LOG[user_key].append(now)

    if request.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {request.language}")
    if request.output_language and request.output_language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported output language: {request.output_language}")

    # Quick responses bypass the LLM entirely
    question_lower = question.lower()
    if question_lower in QUICK_RESPONSES:
        async def _quick():
            yield f"data: {json.dumps({'token': QUICK_RESPONSES[question_lower]})}\n\n"
            yield f"data: {json.dumps({'done': True, 'model': 'rule-based', 'time_ms': 0})}\n\n"
        return StreamingResponse(_quick(), media_type="text/event-stream")

    allowed_context_keys = {"crops", "district", "state", "soil_type"}
    context = {k: v for k, v in (request.context or {}).items() if k in allowed_context_keys}
    context["language"] = request.language
    context["output_language"] = request.output_language or request.language

    logger.info(f"Stream request: user={user.farmer_id if user else 'anonymous'}, lang={context['output_language']}")

    async def _generate():
        start_time = time.time()
        try:
            async for token in stream_ask_ollama(
                question,
                context=context,
                max_tokens=request.max_tokens,
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            elapsed_ms = round((time.time() - start_time) * 1000, 0)
            yield f"data: {json.dumps({'done': True, 'time_ms': elapsed_ms})}\n\n"
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/health")
async def chatbot_health():
    """
    Check Ollama health and available models
    
    Returns server status, available models, and configuration
    """
    
    running = await is_ollama_running()
    models = await get_available_models() if running else []
    
    # Get current model info
    model_info = {}
    if running and OLLAMA_MODEL in models:
        model_info = await get_model_info(OLLAMA_MODEL)
    
    # Select fastest available model
    active_model = OLLAMA_MODEL
    for fast_model in ["qwen2.5:1.5b", "phi3:mini", "gemma2:2b", "llama3.2:latest"]:
        if fast_model in models:
            active_model = fast_model
            break
    
    return {
        "status": "healthy" if running else "offline",
        "ollama_running": running,
        "server_url": "http://localhost:11434",
        "configured_model": active_model,
        "available_models": models,
        "model_loaded": active_model in models,
        "recommended_model": "qwen2.5:1.5b",
        "model_info": {
            "family": model_info.get("details", {}).get("family", "unknown"),
            "parameters": model_info.get("details", {}).get("parameter_size", "unknown"),
            "quantization": model_info.get("details", {}).get("quantization_level", "unknown")
        } if model_info else None
    }


@router.post("/warm")
async def warm_chatbot():
    """
    Pre-warm the Ollama model into GPU VRAM.
    Call this when the chatbot UI tab is opened to eliminate cold-start delay.
    """
    try:
        success = await warm_model()
        return {
            "status": "warm" if success else "failed",
            "message": "Model loaded into GPU VRAM" if success else "Warm-up failed"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.get("/models")
async def list_models():
    """
    List all downloaded Ollama models
    
    Use this to check which models are available
    """
    
    if not await is_ollama_running():
        raise HTTPException(
            status_code=503,
            detail="Ollama not running. Start with: ollama serve"
        )
    
    models = await get_available_models()
    
    # Model recommendations
    recommendations = {
        "llama3.2:3b": "⭐ RECOMMENDED - Good balance of speed and quality",
        "phi3:mini": "⚡ Fastest - Best for quick responses",
        "mistral": "🎯 Best quality - Slower but more accurate",
        "gemma2:2b": "💾 Smallest - Best for low memory systems"
    }
    
    model_list = []
    for model in models:
        model_list.append({
            "name": model,
            "recommendation": recommendations.get(model, ""),
            "info": (await get_model_info(model)).get("details", {})
        })
    
    return {
        "count": len(models),
        "current_model": OLLAMA_MODEL,
        "models": model_list
    }


@router.post("/test")
async def test_chatbot():
    """
    Quick test of Ollama chatbot
    
    Runs a simple test query to verify everything works
    """
    
    if not await is_ollama_running():
        return {
            "status": "error",
            "message": "Ollama is not running",
            "fix": "Run: ollama serve",
            "docker_fix": "docker run -d -p 11434:11434 ollama/ollama"
        }
    
    models = await get_available_models()
    if not models:
        return {
            "status": "error",
            "message": "No models downloaded",
            "fix": f"Run: ollama pull {OLLAMA_MODEL}"
        }
    
    try:
        result = await ask_ollama(
            "What is the best time to plant tomatoes in India? Answer in one sentence.",
            context={"crops": ["tomato"]},
            max_tokens=100
        )
        
        return {
            "status": "success",
            "test_question": "What is the best time to plant tomatoes in India?",
            "model": result["model"],
            "answer": result["answer"],
            "time_ms": round(result["time_ms"], 0),
            "tokens": result.get("tokens", 0)
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


# ==================================================
# SPECIALIZED ENDPOINTS
# ==================================================

@router.post("/diagnose")
async def diagnose_crop_disease(
    request: DiseaseRequest,
    user: UserInfo = Depends(get_current_user)
):
    """
    Diagnose crop disease from symptoms
    
    Provides:
    - Disease name (English + Hindi)
    - Cause and severity
    - Treatment recommendations
    - Prevention tips
    """
    
    if not await is_ollama_running():
        raise HTTPException(status_code=503, detail="Ollama not running")
    
    try:
        result = await diagnose_disease(
            symptoms=request.symptoms,
            crop=request.crop,
            location=request.location
        )
        
        return {
            "crop": request.crop,
            "symptoms": request.symptoms,
            "diagnosis": result["answer"],
            "model": result["model"],
            "time_ms": result["time_ms"]
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/fertilizer")
async def get_fertilizer_recommendation(
    request: FertilizerRequest,
    user: UserInfo = Depends(get_current_user)
):
    """
    Get fertilizer recommendations based on NPK values
    
    Provides:
    - Specific fertilizer names
    - Quantities per acre
    - Application timing
    """
    
    if not await is_ollama_running():
        raise HTTPException(status_code=503, detail="Ollama not running")
    
    try:
        result = await recommend_fertilizer(
            n=request.nitrogen,
            p=request.phosphorus,
            k=request.potassium,
            crop=request.crop,
            area=request.area
        )
        
        return {
            "crop": request.crop,
            "area_acres": request.area,
            "soil_npk": {
                "nitrogen": request.nitrogen,
                "phosphorus": request.phosphorus,
                "potassium": request.potassium
            },
            "recommendation": result["answer"],
            "model": result["model"],
            "time_ms": result["time_ms"]
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# ==================================================
# HISTORY ENDPOINTS
# ==================================================

@router.get("/history/{farmer_id}")
async def get_farmer_history(
    farmer_id: str,
    limit: int = Query(10, ge=1, le=50),
    user: UserInfo = Depends(get_current_user)
):
    """
    Get farmer's chat history
    
    Returns previous conversations for context
    """
    if farmer_id != user.farmer_id:
        raise HTTPException(status_code=403, detail="Access denied: Cannot fetch another farmer's history")
    
    # TODO: Implement Supabase history retrieval
    # For now, return empty placeholder
    
    return {
        "farmer_id": farmer_id,
        "total": 0,
        "conversations": [],
        "note": "History storage coming soon"
    }


@router.delete("/history/{farmer_id}")
async def clear_farmer_history(
    farmer_id: str,
    user: UserInfo = Depends(get_current_user)
):
    """
    Clear farmer's chat history
    """
    if farmer_id != user.farmer_id:
        raise HTTPException(status_code=403, detail="Access denied: Cannot clear another farmer's history")
    
    # TODO: Implement Supabase history deletion
    
    return {
        "farmer_id": farmer_id,
        "message": "History cleared",
        "note": "History storage coming soon"
    }


# ==================================================
# QUICK RESPONSES
# ==================================================

@router.get("/quick-responses")
async def get_quick_responses():
    """
    Get list of quick response triggers
    
    These are predefined responses for common greetings
    """
    
    return {
        "triggers": list(QUICK_RESPONSES.keys()),
        "count": len(QUICK_RESPONSES),
        "note": "These keywords trigger instant responses without LLM"
    }
