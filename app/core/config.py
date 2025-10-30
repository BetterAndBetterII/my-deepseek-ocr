from datetime import timedelta
from typing import Literal
from urllib.parse import urlparse

from pydantic import AnyUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # pydantic-settings config: read from .env
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    # Security
    SECRET_KEY: str = Field(default="change-me-in-prod", description="JWT secret key")
    ALGORITHM: Literal["HS256", "HS384", "HS512"] = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, ge=1, le=7 * 24 * 60)

    # Database
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./data.db")

    # LLM / OCR backend (OpenAI-compatible)
    LLM_BASE_URL: str = Field(default="http://localhost:8000/v1")
    LLM_API_KEY: str = Field(default="token-abc123")
    LLM_MODEL: str = Field(default="deepseek-ai/DeepSeek-OCR")
    LLM_PROMPT: str = Field(default="Free OCR, output markdown.")


    # Demo bootstrap user (for quick start)
    BOOTSTRAP_USER: str = Field(default="demo", min_length=1)
    BOOTSTRAP_PASS: str = Field(default="demo123")

    # Auth toggle
    AUTH_ENABLED: bool = Field(default=False)
    ANON_USERNAME: str = Field(default="anonymous", min_length=1)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret(cls, v: str) -> str:
        if not v or len(v) < 8:
            raise ValueError("SECRET_KEY must be at least 8 characters")
        return v

    @property
    def access_token_expires(self) -> timedelta:
        return timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)


settings = Settings()
