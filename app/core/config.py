import os
from datetime import timedelta


class Settings:
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-prod")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data.db")

    # LLM / OCR backend (OpenAI-compatible)
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "http://localhost:8000/v1")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "token-abc123")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "deepseek-ai/DeepSeek-OCR")
    LLM_PROMPT: str = os.getenv("LLM_PROMPT", "Free OCR, output markdown.")

    # Demo bootstrap user (for quick start)
    BOOTSTRAP_USER: str = os.getenv("BOOTSTRAP_USER", "demo")
    BOOTSTRAP_PASS: str = os.getenv("BOOTSTRAP_PASS", "demo123")

    @property
    def access_token_expires(self) -> timedelta:
        return timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)


settings = Settings()
