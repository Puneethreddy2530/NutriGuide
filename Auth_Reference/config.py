"""
Application Configuration
"""

import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AgriSahayak"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = ""
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT Auth
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v):
        if not v:
            raise ValueError("SECRET_KEY must be set in .env — app cannot start without it")
        return v

    # External APIs
    GEMINI_API_KEY: str = ""
    
    # ML Models
    MODEL_PATH: str = os.getenv("MODEL_PATH", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "..", "ml", "models"))
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
