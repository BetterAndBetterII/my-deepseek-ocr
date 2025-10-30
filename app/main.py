from fastapi import FastAPI
from contextlib import asynccontextmanager
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db import Base, engine, AsyncSessionLocal
from app.models import User
from app.routers import auth, ocr, users
from app.security import get_password_hash
import anyio


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Bootstrap demo user
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        result = await session.execute(select(User).filter_by(username=settings.BOOTSTRAP_USER))
        user = result.scalar_one_or_none()
        if not user:
            password_hash = await anyio.to_thread.run_sync(get_password_hash, settings.BOOTSTRAP_PASS)
            user = User(username=settings.BOOTSTRAP_USER, password_hash=password_hash)
            session.add(user)
            await session.commit()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="My OCR API", version="0.1.0", lifespan=lifespan)

    app.include_router(auth.router)
    app.include_router(ocr.router)
    app.include_router(users.router)

    return app


app = create_app()
