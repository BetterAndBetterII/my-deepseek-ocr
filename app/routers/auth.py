from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
import anyio

from app.core.config import settings
from app.db import get_db
from app.models import User
from app.schemas import Token, UserCreate, UserOut
from app.security import create_access_token, verify_password, get_password_hash
from app.metrics import set_users_total


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
router = APIRouter(prefix="/auth", tags=["auth"])


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).filter_by(username=username))
    return result.scalar_one_or_none()


async def get_current_user(db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")  # type: ignore
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=UserOut)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    if await get_user_by_username(db, user_in.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    password_hash = await anyio.to_thread.run_sync(get_password_hash, user_in.password)
    user = User(username=user_in.username, password_hash=password_hash)
    db.add(user)
    await db.commit()
    # update users_total gauge best-effort
    result = await db.execute(select(User))
    set_users_total(len(result.scalars().all()))
    await db.refresh(user)
    return user


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):
    user = await get_user_by_username(db, form_data.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    ok = await anyio.to_thread.run_sync(verify_password, form_data.password, user.password_hash)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token = create_access_token(user.username, settings.access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}
