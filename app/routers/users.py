from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import UsageEvent, User
from app.routers.auth import get_current_user
from app.schemas import UserOut, UsageEventOut, UsageSummary


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/usage", response_model=list[UsageEventOut])
async def my_usage(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = (
        select(UsageEvent)
        .where(UsageEvent.user_id == current_user.id)
        .order_by(UsageEvent.created_at.desc())
        .limit(200)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return rows


@router.get("/me/usage/summary", response_model=UsageSummary)
async def my_usage_summary(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            func.count(UsageEvent.id),
            func.coalesce(func.sum(UsageEvent.input_bytes), 0),
            func.coalesce(func.sum(UsageEvent.prompt_tokens), 0),
            func.coalesce(func.sum(UsageEvent.completion_tokens), 0),
            func.coalesce(func.sum(UsageEvent.prompt_chars), 0),
            func.coalesce(func.sum(UsageEvent.completion_chars), 0),
        )
        .where(UsageEvent.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    agg = result.one()
    return UsageSummary(
        total_events=int(agg[0] or 0),
        total_input_bytes=int(agg[1] or 0),
        total_prompt_tokens=int(agg[2] or 0),
        total_completion_tokens=int(agg[3] or 0),
        total_prompt_chars=int(agg[4] or 0),
        total_completion_chars=int(agg[5] or 0),
    )
