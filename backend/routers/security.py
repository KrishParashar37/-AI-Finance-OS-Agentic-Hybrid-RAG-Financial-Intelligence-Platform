from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from deps import ensure_seeded
from models import Transaction
from analytics import _clamp

router = APIRouter(prefix="/api/security", tags=["security"])

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db

def _ser(t):
    return {"id": t.id, "type": t.type, "merchant": t.merchant, "category": t.category,
            "amount": t.amount, "date": t.date.isoformat(), "paymentMethod": t.payment_method,
            "risk": t.risk, "riskReason": t.risk_reason}

@router.get("")
async def security(db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    res = await db.execute(select(Transaction).order_by(desc(Transaction.date)))
    txns = res.scalars().all()
    expenses = [t for t in txns if t.type == "expense"]
    high   = [t for t in expenses if t.risk == "high"]
    medium = [t for t in expenses if t.risk == "medium"]
    dups   = [t for t in expenses if t.risk == "low" and t.risk_reason.startswith("Duplicate")]
    risk_score = round(_clamp(len(high)*8 + len(medium)*4 + len(dups)*1.5))
    flagged = sorted(high + medium + dups, key=lambda t: -t.amount)
    from datetime import datetime, timedelta
    cutoff = datetime.now() - timedelta(days=30)
    lows = sorted(
        [t for t in expenses if t.risk == "low" and not t.risk_reason.startswith("Duplicate") and t.date > cutoff],
        key=lambda t: -t.amount
    )[:max(0, 10 - len(flagged))]
    return {
        "riskScore": risk_score,
        "normal": len(expenses) - len(high) - len(medium) - len(dups),
        "suspicious": len(high) + len(medium),
        "duplicates": len(dups),
        "flagged": [_ser(t) for t in flagged + lows],
    }
