"""
AgriSahayak AI Chatbot Module
Powered by Ollama (Local LLM) - Optimized for Qwen3:30b
"""

from .ollama_client import (
    is_ollama_running,
    get_available_models,
    ask_ollama,
    ask_with_history,
    quick_answer,
    detailed_answer,
    QUICK_RESPONSES,
    contains_devanagari,
    calculate_quality_score,
    post_process_response
)

from .rag_engine import (
    RAGEngine,
    get_rag_engine,
    ask_with_rag
)

__all__ = [
    # Ollama client
    "is_ollama_running",
    "get_available_models",
    "ask_ollama",
    "ask_with_history",
    "quick_answer",
    "detailed_answer",
    "QUICK_RESPONSES",
    "contains_devanagari",
    "calculate_quality_score",
    "post_process_response",
    # RAG engine
    "RAGEngine",
    "get_rag_engine",
    "ask_with_rag"
]
