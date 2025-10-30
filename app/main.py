from fastapi import FastAPI
from contextlib import asynccontextmanager
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db import Base, engine, AsyncSessionLocal
from app.models import User
from app.routers import auth, ocr, users
from app.routers.metrics import router as metrics_router
from app.middleware import MetricsMiddleware
from app.metrics import set_users_total
from app.security import get_password_hash
from asgiref.sync import sync_to_async


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
            from sqlalchemy.exc import IntegrityError
            try:
                password_hash = await sync_to_async(get_password_hash, thread_sensitive=False)(settings.BOOTSTRAP_PASS)
                user = User(username=settings.BOOTSTRAP_USER, password_hash=password_hash)
                session.add(user)
                await session.commit()
            except IntegrityError:
                await session.rollback()
        # update users_total gauge
        from sqlalchemy import func
        count = await session.execute(select(func.count(User.id)))
        set_users_total(int(count.scalar_one() or 0))
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="My OCR API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(MetricsMiddleware)

    app.include_router(auth.router)
    app.include_router(ocr.router)
    app.include_router(users.router)
    app.include_router(metrics_router)

    return app


app = create_app()
