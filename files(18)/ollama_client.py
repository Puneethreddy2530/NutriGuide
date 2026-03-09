"""
ollama_client.py
══════════════════════════════════════════════════════════════════
NeoPulse Ollama Client — zero changes except docstring
Used for: RAG dietitian AI (primary LLM), Gemini is fallback.

Model: qwen2.5:7b (good instruction-following, Hindi/multilingual support)
Endpoint: http://localhost:11434 (standard Ollama port)

If Ollama is not running: all calls raise OllamaUnavailableError,
which main.py catches and falls back to Gemini automatically.
══════════════════════════════════════════════════════════════════
"""

import os
import logging
import httpx
from typing import Optional, AsyncIterator

logger = logging.getLogger(__name__)

OLLAMA_BASE = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "30"))

_client: Optional[httpx.AsyncClient] = None


class OllamaUnavailableError(RuntimeError):
    """Raised when Ollama is not reachable — triggers Gemini fallback."""
    pass


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=None)
    return _client


async def quick_response(
    prompt: str,
    system: str = "You are a helpful clinical dietitian AI assistant.",
    model: str = "",
    max_tokens: int = 1024,
    timeout: float = 0,
) -> str:
    """
    Send a prompt to Ollama and return the full response text.

    Raises OllamaUnavailableError if Ollama is not running so callers
    can fall back to Gemini cleanly.
    """
    _model = model or OLLAMA_MODEL
    _timeout = timeout or OLLAMA_TIMEOUT

    payload = {
        "model": _model,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {
            "num_predict": max_tokens,
            "temperature": 0.7,
            "top_p": 0.9,
        },
    }

    try:
        client = await _get_client()
        resp = await client.post(
            f"{OLLAMA_BASE}/api/generate",
            json=payload,
            timeout=_timeout,
        )
        if resp.status_code != 200:
            raise OllamaUnavailableError(
                f"Ollama returned HTTP {resp.status_code}: {resp.text[:200]}"
            )
        data = resp.json()
        return data.get("response", "").strip()

    except httpx.ConnectError:
        raise OllamaUnavailableError(
            f"Cannot connect to Ollama at {OLLAMA_BASE}. "
            "Is Ollama running? Run: ollama serve"
        )
    except httpx.TimeoutException:
        raise OllamaUnavailableError(
            f"Ollama timed out after {_timeout}s for model {_model}"
        )
    except OllamaUnavailableError:
        raise
    except Exception as e:
        raise OllamaUnavailableError(f"Ollama error: {e}") from e


async def stream_response(
    prompt: str,
    system: str = "You are a helpful clinical dietitian AI assistant.",
    model: str = "",
    max_tokens: int = 1024,
) -> AsyncIterator[str]:
    """
    Stream tokens from Ollama.
    Yields individual token strings as they arrive.
    Raises OllamaUnavailableError if not reachable.
    """
    _model = model or OLLAMA_MODEL

    payload = {
        "model": _model,
        "prompt": prompt,
        "system": system,
        "stream": True,
        "options": {"num_predict": max_tokens, "temperature": 0.7},
    }

    try:
        client = await _get_client()
        async with client.stream(
            "POST",
            f"{OLLAMA_BASE}/api/generate",
            json=payload,
            timeout=OLLAMA_TIMEOUT,
        ) as resp:
            if resp.status_code != 200:
                raise OllamaUnavailableError(f"Ollama HTTP {resp.status_code}")
            import json as _json
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = _json.loads(line)
                    token = chunk.get("response", "")
                    if token:
                        yield token
                    if chunk.get("done"):
                        break
                except _json.JSONDecodeError:
                    continue
    except httpx.ConnectError:
        raise OllamaUnavailableError(f"Cannot connect to Ollama at {OLLAMA_BASE}")
    except OllamaUnavailableError:
        raise


async def list_models() -> list:
    """List available Ollama models. Returns empty list if Ollama is down."""
    try:
        client = await _get_client()
        resp = await client.get(f"{OLLAMA_BASE}/api/tags", timeout=5.0)
        if resp.status_code == 200:
            return resp.json().get("models", [])
    except Exception:
        pass
    return []


async def health_check() -> dict:
    """Check if Ollama is reachable and the configured model is available."""
    try:
        models = await list_models()
        model_names = [m.get("name", "") for m in models]
        model_ready = any(OLLAMA_MODEL in name for name in model_names)
        return {
            "status": "reachable",
            "url": OLLAMA_BASE,
            "configured_model": OLLAMA_MODEL,
            "model_available": model_ready,
            "available_models": model_names[:5],
            "install_tip": None if model_ready else f"Run: ollama pull {OLLAMA_MODEL}",
        }
    except Exception as e:
        return {
            "status": "unreachable",
            "url": OLLAMA_BASE,
            "error": str(e),
            "install_tip": "Install Ollama from https://ollama.ai then run: ollama pull qwen2.5:7b",
        }
