"""
Voice-to-Text Agricultural Assistant API
Speech recognition for farmers who can speak but can't type

Features:
- Voice transcription (Whisper AI)
- Multi-language support (Hindi/English)
- Integration with Ollama chatbot
- Text-to-Speech response

Technology:
- OpenAI Whisper (local or API)
- Web Speech API fallback (frontend)
- TTS using gTTS/edge-tts
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
import tempfile
import os
import base64
import logging
import time
import io

logger = logging.getLogger(__name__)
router = APIRouter()

# Rate limiting
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMIT_AVAILABLE = True
except ImportError:
    limiter = None
    RATE_LIMIT_AVAILABLE = False

# Audio validation constants
ALLOWED_AUDIO_FORMATS = {
    'audio/wav': '.wav',
    'audio/mpeg': '.mp3',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'application/octet-stream': '.webm'  # Allow binary for browser recordings
}
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10MB

# Rate limit decorator wrapper
def rate_limit(limit_string):
    def decorator(func):
        if RATE_LIMIT_AVAILABLE and limiter:
            return limiter.limit(limit_string)(func)
        return func
    return decorator

# Whisper model (lazy loaded)
_whisper_model = None

# Try to import whisper for local transcription
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    logger.warning("Whisper not installed. Install with: pip install openai-whisper")

# Try edge-tts for text-to-speech
try:
    import edge_tts
    import asyncio
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    logger.warning("edge-tts not installed. Install with: pip install edge-tts")

# Import chatbot for integration
from app.chatbot.ollama_client import ask_ollama, is_ollama_running


# ==================================================
# MODELS
# ==================================================

class TranscriptionResponse(BaseModel):
    """Response for voice transcription"""
    success: bool
    text: str
    language: str
    confidence: float
    duration_seconds: float
    processing_time_ms: float


class VoiceChatRequest(BaseModel):
    """Request for voice-based chat"""
    audio_base64: str = Field(..., description="Base64 encoded audio data")
    language: Optional[str] = Field("auto", description="Source language: auto, hi, en")
    farmer_id: Optional[str] = Field(None, description="Farmer ID for context")
    context: Optional[dict] = Field(None, description="Additional context")


class VoiceChatResponse(BaseModel):
    """Response for voice chat"""
    success: bool
    transcribed_text: str
    detected_language: str
    ai_response: str
    audio_response_base64: Optional[str] = None
    processing_time_ms: float


class TTSRequest(BaseModel):
    """Text-to-speech request"""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to convert to speech")
    language: str = Field("hi", description="Language code: hi (Hindi), en (English)")
    voice: Optional[str] = Field(None, description="Voice name (optional)")


# ==================================================
# HELPER FUNCTIONS
# ==================================================

def get_whisper_model():
    """Lazy load Whisper model"""
    global _whisper_model
    
    if not WHISPER_AVAILABLE:
        return None
    
    if _whisper_model is None:
        logger.info("Loading Whisper model (base)...")
        # Use 'base' for speed, 'medium' for better accuracy
        _whisper_model = whisper.load_model("base")
        logger.info("Whisper model loaded successfully")
    
    return _whisper_model


async def transcribe_audio(audio_file_path: str, language: str = None) -> dict:
    """
    Transcribe audio file using Whisper
    
    Args:
        audio_file_path: Path to audio file
        language: Language code (None for auto-detect)
    
    Returns:
        Transcription result dict
    """
    model = get_whisper_model()
    
    if model is None:
        raise ValueError("Whisper model not available")
    
    start_time = time.time()
    
    # Transcribe with language detection
    options = {
        "fp16": False,  # Use FP32 for CPU
    }
    
    if language and language != "auto":
        options["language"] = language
    
    result = model.transcribe(audio_file_path, **options)
    
    processing_time = (time.time() - start_time) * 1000
    
    return {
        "text": result["text"].strip(),
        "language": result.get("language", "unknown"),
        "segments": result.get("segments", []),
        "processing_time_ms": processing_time
    }


async def text_to_speech(text: str, language: str = "hi") -> bytes:
    """
    Convert text to speech using edge-tts

    Returns MP3 audio bytes
    """
    if not EDGE_TTS_AVAILABLE:
        raise ValueError("edge-tts not installed")

    # Microsoft Edge TTS neural voices — all 9 supported Indian languages
    voices = {
        "hi":      "hi-IN-SwaraNeural",    # Hindi female
        "hi-m":    "hi-IN-MadhurNeural",   # Hindi male
        "mr":      "mr-IN-AarohiNeural",   # Marathi female
        "mr-m":    "mr-IN-ManoharNeural",  # Marathi male
        "te":      "te-IN-ShrutiNeural",   # Telugu female
        "te-m":    "te-IN-MohanNeural",    # Telugu male
        "ta":      "ta-IN-PallaviNeural",  # Tamil female
        "ta-m":    "ta-IN-ValluvarNeural", # Tamil male
        "kn":      "kn-IN-SapnaNeural",    # Kannada female
        "kn-m":    "kn-IN-GaganNeural",    # Kannada male
        "bn":      "bn-IN-TanishaaNeural", # Bengali female
        "bn-m":    "bn-IN-BashkarNeural",  # Bengali male
        "gu":      "gu-IN-DhwaniNeural",   # Gujarati female
        "gu-m":    "gu-IN-NiranjanNeural", # Gujarati male
        "ml":      "ml-IN-SobhanaNeural",  # Malayalam female
        "ml-m":    "ml-IN-MidhunNeural",   # Malayalam male
        # pa-IN (Punjabi) and or-IN (Odia) are NOT available in edge-tts;
        # requests for those codes fall back to Hindi via the default below.
        "en":      "en-IN-NeerjaNeural",   # English-India female
        "en-m":    "en-IN-PrabhatNeural",  # English-India male
    }

    voice = voices.get(language, voices["hi"])
    
    # Create TTS
    communicate = edge_tts.Communicate(text, voice)
    
    # Collect audio bytes
    audio_bytes = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_bytes += chunk["data"]
    
    return audio_bytes


# ==================================================
# ENDPOINTS
# ==================================================

@router.get("/health")
async def voice_health():
    """Check voice services health"""
    return {
        "whisper_available": WHISPER_AVAILABLE,
        "tts_available": EDGE_TTS_AVAILABLE,
        "ollama_running": await is_ollama_running(),
        "supported_languages": ["hi", "en", "mr", "te", "ta", "bn", "gu", "kn", "pa"],
        "whisper_model": "base" if WHISPER_AVAILABLE else None,
        "tts_engine": "edge-tts (Microsoft)" if EDGE_TTS_AVAILABLE else None
    }


@router.post("/transcribe", response_model=TranscriptionResponse)
@rate_limit("10/minute")  # Max 10 transcriptions per minute per IP
async def transcribe_voice(
    request: Request,  # Required for rate limiting
    audio: UploadFile = File(..., description="Audio file (WAV, MP3, WEBM)"),
    language: str = Query("auto", description="Language: auto, hi, en")
):
    """
    Transcribe voice to text using Whisper AI
    
    Supports:
    - Hindi (hi)
    - English (en)
    - Auto-detection (auto)
    
    Audio formats: WAV, MP3, WEBM, OGG
    Max file size: 10MB
    """
    if not WHISPER_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Whisper not installed. Use Web Speech API on frontend or install: pip install openai-whisper"
        )
    
    # ✅ Validate content type
    if audio.content_type not in ALLOWED_AUDIO_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{audio.content_type}'. Allowed: {list(ALLOWED_AUDIO_FORMATS.keys())}"
        )
    
    start_time = time.time()
    
    # Read and validate file size
    content = await audio.read()
    if len(content) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file too large ({len(content) // 1024 // 1024}MB). Max size: {MAX_AUDIO_SIZE // 1024 // 1024}MB"
        )
    
    # Save uploaded file temporarily (content already read for validation)
    suffix = os.path.splitext(audio.filename)[1] or ".webm"
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        # Get audio duration (approximate from file size)
        file_size = len(content)
        # Rough estimate: 16kb/s for compressed audio
        duration = file_size / (16 * 1024)
        
        # Transcribe
        result = await transcribe_audio(
            tmp_path,
            language if language != "auto" else None
        )
        
        return TranscriptionResponse(
            success=True,
            text=result["text"],
            language=result["language"],
            confidence=0.95,  # Whisper doesn't give per-phrase confidence
            duration_seconds=round(duration, 2),
            processing_time_ms=round(result["processing_time_ms"], 2)
        )
    
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/chat", response_model=VoiceChatResponse)
@rate_limit("5/minute")  # Max 5 voice chats per minute per IP (expensive operation)
async def voice_chat(voice_request: VoiceChatRequest, request: Request = None):
    """
    Complete voice chat workflow:
    1. Transcribe voice input
    2. Send to AI chatbot
    3. Convert response to speech
    
    Input: Base64 audio
    Output: Text + Audio response
    Rate limited: 5 requests per minute
    """
    start_time = time.time()
    
    # Decode base64 audio
    try:
        audio_bytes = base64.b64decode(voice_request.audio_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio: {e}")
    
    # Validate audio size
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Audio too large ({len(audio_bytes) // 1024 // 1024}MB). Max: {MAX_AUDIO_SIZE // 1024 // 1024}MB"
        )
    
    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
        tmp_file.write(audio_bytes)
        tmp_path = tmp_file.name
    
    try:
        # Step 1: Transcribe
        if WHISPER_AVAILABLE:
            transcription = await transcribe_audio(
                tmp_path,
                voice_request.language if voice_request.language != "auto" else None
            )
            user_text = transcription["text"]
            detected_lang = transcription["language"]
        else:
            raise HTTPException(
                status_code=503,
                detail="Whisper not available. Use /chat/text endpoint with frontend transcription."
            )
        
        # Step 2: Get AI response
        if not await is_ollama_running():
            ai_response = "Ollama server is not running. Please start Ollama."
        else:
            # Build context
            context = voice_request.context or {}
            context["language"] = detected_lang
            
            result = await ask_ollama(
                question=user_text,
                context=context,
                temperature=0.7,
                max_tokens=300
            )
            ai_response = result.get("answer", "I could not generate a response.")
        
        # Step 3: Convert response to speech (optional)
        audio_response_b64 = None
        if EDGE_TTS_AVAILABLE:
            try:
                tts_lang = "hi" if detected_lang == "hi" else "en"
                audio_bytes = await text_to_speech(ai_response, tts_lang)
                audio_response_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            except Exception as e:
                logger.warning(f"TTS failed: {e}")
        
        processing_time = (time.time() - start_time) * 1000
        
        return VoiceChatResponse(
            success=True,
            transcribed_text=user_text,
            detected_language=detected_lang,
            ai_response=ai_response,
            audio_response_base64=audio_response_b64,
            processing_time_ms=round(processing_time, 2)
        )
    
    finally:
        # Cleanup
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/chat/text")
async def voice_chat_text_fallback(
    text: str = Query(..., min_length=1, description="Transcribed text from Web Speech API"),
    language: str = Query("hi", description="Language: hi, en"),
    farmer_id: Optional[str] = Query(None),
    include_audio: bool = Query(True, description="Include TTS audio in response")
):
    """
    Text-based chat with TTS response (Web Speech API fallback)
    
    Use this when Whisper is not available.
    Frontend uses Web Speech API for transcription, sends text here.
    """
    start_time = time.time()
    
    # Get AI response
    # Get AI response
    if not await is_ollama_running():
        ai_response = "AI assistant is currently offline. Please try again later."
    else:
        context = {"language": language}
        if farmer_id:
            context["farmer_id"] = farmer_id
        
        result = await ask_ollama(
            question=text,
            context=context,
            temperature=0.7,
            max_tokens=400
        )
        ai_response = result.get("answer", "मुझे जवाब नहीं मिला।" if language == "hi" else "I could not get an answer.")
    
    # Generate TTS
    audio_response_b64 = None
    if include_audio and EDGE_TTS_AVAILABLE:
        try:
            audio_bytes = await text_to_speech(ai_response, language)
            audio_response_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        except Exception as e:
            logger.warning(f"TTS failed: {e}")
    
    processing_time = (time.time() - start_time) * 1000
    
    return {
        "success": True,
        "input_text": text,
        "language": language,
        "ai_response": ai_response,
        "audio_response_base64": audio_response_b64,
        "processing_time_ms": round(processing_time, 2),
        "tts_available": EDGE_TTS_AVAILABLE
    }


@router.post("/tts")
async def text_to_speech_endpoint(request: TTSRequest):
    """
    Convert text to speech (standalone TTS)
    
    Returns MP3 audio as base64 or streaming response
    """
    if not EDGE_TTS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Text-to-speech not available. Install: pip install edge-tts"
        )
    
    try:
        audio_bytes = await text_to_speech(request.text, request.language)
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        
        return {
            "success": True,
            "audio_base64": audio_b64,
            "format": "mp3",
            "language": request.language,
            "text_length": len(request.text)
        }
    
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tts/stream")
async def text_to_speech_stream(
    text: str = Query(..., min_length=1, max_length=5000),
    language: str = Query("hi")
):
    """
    Stream TTS audio (for real-time playback)

    Returns audio/mpeg stream
    """
    if not EDGE_TTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="TTS not available")

    voices = {
        "hi": "hi-IN-SwaraNeural",
        "mr": "mr-IN-AarohiNeural",
        "te": "te-IN-ShrutiNeural",
        "ta": "ta-IN-PallaviNeural",
        "kn": "kn-IN-SapnaNeural",
        "bn": "bn-IN-TanishaaNeural",
        "gu": "gu-IN-DhwaniNeural",
        # pa-IN (Punjabi) and or-IN (Odia) not available — fall back to Hindi
        "ml": "ml-IN-SobhanaNeural",
        "en": "en-IN-NeerjaNeural",
    }
    voice = voices.get(language, voices["hi"])
    
    async def audio_stream():
        communicate = edge_tts.Communicate(text, voice)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
    
    return StreamingResponse(
        audio_stream(),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=response.mp3"}
    )


@router.get("/voices")
async def list_available_voices():
    """List available TTS voices for Indian languages"""
    return {
        "voices": [
            {"code": "hi",   "name": "Hindi Female (Swara)",        "voice_id": "hi-IN-SwaraNeural"},
            {"code": "hi-m", "name": "Hindi Male (Madhur)",          "voice_id": "hi-IN-MadhurNeural"},
            {"code": "mr",   "name": "Marathi Female (Aarohi)",      "voice_id": "mr-IN-AarohiNeural"},
            {"code": "mr-m", "name": "Marathi Male (Manohar)",       "voice_id": "mr-IN-ManoharNeural"},
            {"code": "te",   "name": "Telugu Female (Shruti)",       "voice_id": "te-IN-ShrutiNeural"},
            {"code": "te-m", "name": "Telugu Male (Mohan)",          "voice_id": "te-IN-MohanNeural"},
            {"code": "ta",   "name": "Tamil Female (Pallavi)",       "voice_id": "ta-IN-PallaviNeural"},
            {"code": "ta-m", "name": "Tamil Male (Valluvar)",        "voice_id": "ta-IN-ValluvarNeural"},
            {"code": "kn",   "name": "Kannada Female (Sapna)",       "voice_id": "kn-IN-SapnaNeural"},
            {"code": "kn-m", "name": "Kannada Male (Gagan)",         "voice_id": "kn-IN-GaganNeural"},
            {"code": "bn",   "name": "Bengali Female (Tanishaa)",    "voice_id": "bn-IN-TanishaaNeural"},
            {"code": "bn-m", "name": "Bengali Male (Bashkar)",       "voice_id": "bn-IN-BashkarNeural"},
            {"code": "gu",   "name": "Gujarati Female (Dhwani)",     "voice_id": "gu-IN-DhwaniNeural"},
            {"code": "gu-m", "name": "Gujarati Male (Niranjan)",     "voice_id": "gu-IN-NiranjanNeural"},
            {"code": "pa",   "name": "Punjabi (Hindi fallback)",       "voice_id": "hi-IN-SwaraNeural"},
            {"code": "ml",   "name": "Malayalam Female (Sobhana)",      "voice_id": "ml-IN-SobhanaNeural"},
            {"code": "ml-m", "name": "Malayalam Male (Midhun)",         "voice_id": "ml-IN-MidhunNeural"},
            {"code": "en",   "name": "English-India Female (Neerja)",   "voice_id": "en-IN-NeerjaNeural"},
            {"code": "en-m", "name": "English-India Male (Prabhat)", "voice_id": "en-IN-PrabhatNeural"},
        ],
        "tts_available": EDGE_TTS_AVAILABLE
    }
