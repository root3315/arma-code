import json
import os
import secrets
from pathlib import Path
from typing import List, Optional, Union

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve project paths so .env is loaded reliably regardless of CWD
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = _BACKEND_DIR.parent

# Load environment files into os.environ early so third-party libs (e.g., OpenAI)
# can pick them up even before Settings is instantiated.
for env_path in (
    _BACKEND_DIR / ".env",
    _BACKEND_DIR / ".env.local",
    _REPO_ROOT / ".env",
    _REPO_ROOT / ".env.local",
):
    load_dotenv(env_path, override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            _BACKEND_DIR / ".env",   # backend/.env
            _BACKEND_DIR / ".env.local",  # backend/.env.local (optional)
            _REPO_ROOT / ".env",     # project/.env
            _REPO_ROOT / ".env.local",  # project/.env.local (optional)
            ".env",                  # fallback to current working dir
        ),
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "EduPlatform API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))

    # Database
    # Security fix: Use environment variables for database credentials (Bug #1.1)
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "eduplatform")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5434")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "eduplatform_dev")
    
    # Construct DATABASE_URL from components, warn if no password set
    @property
    def DATABASE_URL(self) -> str:
        if not self.POSTGRES_PASSWORD:
            import warnings
            warnings.warn(
                "POSTGRES_PASSWORD not set! Using empty password. "
                "This is a security risk in production.",
                UserWarning,
                stacklevel=1
            )
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
    @property
    def DATABASE_URL_SYNC(self) -> str:
        if not self.POSTGRES_PASSWORD:
            import warnings
            warnings.warn(
                "POSTGRES_PASSWORD not set! Using empty password. "
                "This is a security risk in production.",
                UserWarning,
                stacklevel=1
            )
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # OpenAI
    OPENAI_API_KEY: str = ""

    # SlidesGPT (Presentation Generation)
    SLIDESGPT_API_KEY: str = ""

    # Tavily (Web Search)
    TAVILY_API_KEY: str = ""

    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
    ]
    BACKEND_CORS_ORIGIN_REGEX: str = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

    # Storage
    STORAGE_TYPE: str = "supabase"  # or 's3'
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # File Upload
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_FILE_TYPES: List[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # DOCX
        "application/msword",  # DOC
        "text/plain",  # TXT
        "application/rtf",  # RTF
        "text/rtf",  # RTF alternative
        "application/vnd.oasis.opendocument.text",  # ODT
        "application/epub+zip",  # EPUB
        "text/markdown",  # MD
        "text/html",  # HTML
        "application/x-markdown",  # MD alternative
    ]

    # AI Processing
    CHUNK_SIZE: int = 8000
    EMBEDDING_CHUNK_SIZE: int = 500
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    EMBEDDING_DIMENSIONS: int = 3072

    # LLM Models
    LLM_MODEL_MINI: str = "gpt-4o-mini"
    LLM_MODEL: str = "gpt-4o"

    # TTS Provider Configuration
    TTS_PROVIDER: str = "edge"  # "edge" (бесплатно) или "elevenlabs" (платно)

    # Edge TTS Voice Settings (можно кастомизировать)
    EDGE_TTS_VOICE_RU_FEMALE: str = "ru-RU-SvetlanaNeural"
    EDGE_TTS_VOICE_RU_MALE: str = "ru-RU-DmitryNeural"
    EDGE_TTS_VOICE_EN_FEMALE: str = "en-US-AriaNeural"
    EDGE_TTS_VOICE_EN_MALE: str = "en-US-GuyNeural"

    # Voice Chat Configuration (OpenAI Realtime API)
    VOICE_PROVIDER: str = "openai"  # "openai", "voicebox", или "personaplex"
    OPENAI_REALTIME_MODEL: str = "gpt-4o-realtime-preview"
    OPENAI_REALTIME_VOICE: str = "alloy"  # alloy, echo, fable, onyx, nova, shimmer

    # Voicebox TTS Configuration (локальный TTS на базе Qwen3-TTS)
    VOICEBOX_API_URL: str = "http://localhost:8001"  # Voicebox backend URL
    VOICEBOX_DEFAULT_PROFILE_ID: Optional[str] = None  # Default voice profile ID
    VOICEBOX_DEFAULT_LANGUAGE: str = "en"  # Default language: ru, en, de, fr, es, it, ja, ko, zh, pt
    VOICEBOX_MODEL_SIZE: str = "1.7B"  # Model size: 1.7B или 0.6B
    VOICEBOX_TIMEOUT_SECONDS: int = 60  # Timeout for TTS generation

    # NVIDIA PersonaPlex (опционально, для локального GPU)
    PERSONAPLEX_WS_URL: str = "wss://localhost:8998"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[str, List[str]]) -> List[str]:
        """
        Allow passing CORS origins as JSON array, comma separated string, or list,
        and normalize away trailing slashes/whitespace.
        """
        if value is None:
            return []

        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            if raw.startswith("["):
                try:
                    value = json.loads(raw)
                except json.JSONDecodeError:
                    # Fallback to comma-separated parsing if JSON is malformed
                    value = [item.strip() for item in raw.split(",") if item.strip()]
            else:
                value = [item.strip() for item in raw.split(",") if item.strip()]

        if isinstance(value, (list, tuple)):
            cleaned: List[str] = []
            for origin in value:
                if not origin:
                    continue
                normalized = str(origin).strip().rstrip("/")
                if normalized:
                    cleaned.append(normalized)
            return cleaned

        raise ValueError("BACKEND_CORS_ORIGINS must be a list or comma-separated string")


settings = Settings()
