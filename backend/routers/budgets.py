from fastapi import APIRouter, Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from deps import ensure_seeded
from models import Budget, Transaction, ActivityLog
from analytics import category_stats

router = APIRouter(prefix="/api/budgets", tags=["budgets"])

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db

@router.post("/smart")
async def smart_budget(db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    txns = (await db.execute(select(Transaction))).scalars().all()
    cats = [c for c in category_stats(txns) if c["avg3"] > 300]
    rows = [{"category": c["name"], "limitAmount": max(500, round(c["avg3"] * 0.95 / 100) * 100)} for c in cats]
    overall = round(sum(r["limitAmount"] for r in rows) * 1.05 / 500) * 500
    await db.execute(delete(Budget))
    new_budgets = [{"category": "Overall", "limitAmount": overall}] + rows
    for b in new_budgets:
        db.add(Budget(category=b["category"], limit_amount=b["limitAmount"]))
    db.add(ActivityLog(action="Smart budget generated", detail=f"{len(new_budgets)} budgets from 3-month averages"))
    await db.commit()
    return {"budgets": new_budgets}
