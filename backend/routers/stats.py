from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from database import AsyncSessionLocal
from deps import ensure_seeded
from models import Transaction, Account
from analytics import get_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db

@router.get("")
async def stats(
    range: str = "30d",
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    await ensure_seeded(db)
    txns = (await db.execute(select(Transaction))).scalars().all()
    accs = (await db.execute(select(Account))).scalars().all()
    return get_stats(txns, accs, range, from_date, to_date)
