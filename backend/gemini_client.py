"""
Azure OpenAI Client (GPT-4o)
Provides ask_gemini() (chat), ask_vision() (GPT-4o Vision), and ask_whisper() helpers.
ask_gemini() function name kept for backward compatibility — no changes needed in callers.
"""

import os
import sys
import logging
import httpx
from typing import Optional

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

logger = logging.getLogger(__name__)

_httpx_client: Optional[httpx.AsyncClient] = None


def _azure_cfg() -> dict:
    """Read Azure config at call time so load_dotenv() in main.py always wins."""
    return {
        "key":        os.getenv("AZURE_OPENAI_API_KEY", ""),
        "endpoint":   os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/"),
        "deployment": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o"),
        "version":    os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    }


def _strip_markdown(text: str) -> str:
    import re
    text = re.sub(r'\*{1,3}([^*\n]+?)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,2}([^_\n]+?)_{1,2}', r'\1', text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[\-\*]\s+', '• ', text, flags=re.MULTILINE)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


async def _get_client() -> httpx.AsyncClient:
    global _httpx_client
    if _httpx_client is None or _httpx_client.is_closed:
        _httpx_client = httpx.AsyncClient(timeout=None)
    return _httpx_client


async def ask_gemini(prompt: str, system: str = "", max_tokens: int = 512, timeout: float = 20.0, json_mode: bool = False) -> str:
    """
    Azure OpenAI GPT-4o — drop-in for the old ask_gemini().
    Set json_mode=True to force Azure to return valid JSON (adds response_format).
    Returns empty string on failure so callers fall back gracefully.
    """
    cfg = _azure_cfg()
    if not cfg["key"]:
        logger.warning("AZURE_OPENAI_API_KEY not set — skipping AI call")
        return ""

    url = (f"{cfg['endpoint']}/openai/deployments/{cfg['deployment']}"
           f"/chat/completions?api-version={cfg['version']}")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "messages":   messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
        "top_p":      0.9,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        client = await _get_client()
        resp = await client.post(
            url, json=payload,
            headers={"api-key": cfg["key"]},
            timeout=timeout,
        )
        if resp.status_code != 200:
            logger.error(f"Azure OpenAI error {resp.status_code}: {resp.text[:200]}")
            return ""
        text = resp.json()["choices"][0]["message"]["content"] or ""
        return text.strip() if json_mode else _strip_markdown(text)
    except Exception as e:
        logger.error(f"Azure OpenAI call failed: {e}")
        return ""


async def ask_vision(image_base64: str, prompt: str, timeout: float = 30.0) -> str:
    """
    Azure OpenAI GPT-4o vision — for TrayVision image analysis.
    Returns the raw response text (caller must parse JSON).
    Raises RuntimeError on failure (caller should catch and fall back to demo).
    """
    cfg = _azure_cfg()
    if not cfg["key"]:
        raise RuntimeError("AZURE_OPENAI_API_KEY not set")

    url = (f"{cfg['endpoint']}/openai/deployments/{cfg['deployment']}"
           f"/chat/completions?api-version={cfg['version']}")

    payload = {
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text",      "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
            ],
        }],
        "max_tokens":  1024,
        "temperature": 0.1,
    }

    client = await _get_client()
    resp = await client.post(
        url, json=payload,
        headers={"api-key": cfg["key"]},
        timeout=timeout,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Azure OpenAI vision error {resp.status_code}: {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]


async def get_market_advisory(
    commodity: str,
    commodity_hindi: str,
    national_avg: float,
    msp: Optional[float],
    trend: str,
    best_states: list,
    top_prices: list,   # list of {state, avg_price}
    lowest_prices: list,  # list of {state, avg_price}
    season: str,
) -> str:
    """
    Generate an intelligent market advisory for a commodity using Azure OpenAI GPT-4o.
    Falls back to a simple rule-based string if Azure OpenAI is unavailable.
    """
    msp_line = f"MSP: ₹{msp}/quintal. " if msp else "No MSP for this commodity. "
    top_str = ", ".join(f"{p['state']} (₹{p['avg_price']})" for p in top_prices[:3])
    low_str = ", ".join(f"{p['state']} (₹{p['avg_price']})" for p in lowest_prices[:3])

    prompt = f"""You are an expert Indian agricultural market analyst. Give a practical, concise selling advisory for a farmer.

Commodity: {commodity} ({commodity_hindi})
Season: {season}
National Average Price: ₹{national_avg}/quintal
{msp_line}
Price Trend: {trend}
Best Selling States: {top_str}
Cheapest States (avoid selling here): {low_str}

Write 2-3 sentences of actionable advice covering:
1. Whether to sell now or wait based on trend and current vs MSP
2. Which states offer the best price differential and why transport may/may not be worth it
3. Any seasonal price pattern the farmer should know

Be direct and practical. Use ₹ symbol. Keep it under 80 words."""

    result = await ask_gemini(prompt)
    if result:
        return result

    # Fallback static advisory
    if trend == "up":
        return "📈 Prices are rising. Hold stock 1-2 weeks for better returns if storage is available."
    elif trend == "down":
        return "📉 Prices declining. Consider selling soon to minimize losses."
    elif trend == "volatile":
        return "📊 Prices are fluctuating. Monitor daily and sell during price spikes."
    return "➡️ Prices are stable. Sell based on your cash flow needs."


async def get_weather_suggestions(
    location: str,
    crop: Optional[str],
    temperature: float,
    humidity: float,
    rainfall_24h: float,
    forecast_summary: str,
    risk_alerts: list,  # list of dicts with risk_type, severity, title
    irrigation_recommendation: str,
    harvest_recommendation: str,
    risk_score: int,
) -> str:
    """
    Generate intelligent farming suggestions based on weather data using Azure OpenAI GPT-4o.
    Returns an empty string on failure.
    """
    crop_line = f"Crop being grown: {crop}." if crop else "No specific crop mentioned."
    alerts_str = "; ".join(
        f"{a['title']} ({a['severity']})"
        for a in risk_alerts[:4]
    ) if risk_alerts else "No major alerts."

    prompt = f"""You are AgriSahayak, an expert Indian farming advisor. Based on the weather data below, give a farmer 3-4 specific, actionable farming suggestions for today and the next 3 days.

Location: {location}
{crop_line}
Current Temperature: {temperature}°C | Humidity: {humidity}% | Rainfall last 24h: {rainfall_24h}mm
7-Day Forecast Summary: {forecast_summary}
Active Risk Alerts: {alerts_str}
Irrigation Advisory: {irrigation_recommendation}
Harvest Advisory: {harvest_recommendation}
Overall Risk Score: {risk_score}/100

Instructions:
- Give exactly 3-4 bullet points in English
- Each point must mention a specific action (spray, irrigate, harvest, apply fertilizer, etc.)
- Mention timing (morning/evening/today/next 3 days) where relevant
- Keep each bullet under 20 words
- Use Indian farming context (mandi, kharif, rabi, acres)"""

    result = await ask_gemini(prompt, max_tokens=1024)
    return result
