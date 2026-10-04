"""FastAPI dependencies — DB session + seeding gate."""
from __future__ import annotations
import asyncio
from typing import AsyncGenerator

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import Setting

_seeded = False
_seed_lock = asyncio.Lock()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def ensure_seeded(db: AsyncSession) -> None:
    """Auto-seed demo data on first run (checks settings table)."""
    global _seeded
    if _seeded:
        return
    async with _seed_lock:
        if _seeded:
            return
        result = await db.execute(select(func.count()).select_from(Setting))
        count = result.scalar_one()
        if count == 0:
            from seed import seed_all
            await seed_all(db)
        _seeded = True
