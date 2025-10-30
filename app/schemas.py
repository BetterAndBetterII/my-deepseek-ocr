from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    exp: int


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UsageEventOut(BaseModel):
    id: int
    kind: str
    prompt_chars: int
    completion_chars: int
    prompt_tokens: int
    completion_tokens: int
    input_bytes: int
    meta: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UsageSummary(BaseModel):
    total_events: int
    total_input_bytes: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_prompt_chars: int
    total_completion_chars: int

