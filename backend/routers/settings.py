from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from deps import ensure_seeded
from models import ActivityLog, Setting

router = APIRouter(prefix="/api/settings", tags=["settings"])

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db

@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    rows = (await db.execute(select(Setting))).scalars().all()
    return {r.key: r.value for r in rows}

@router.put("")
async def put_setting(body: dict, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    key = body.get("key")
    value = body.get("value")
    if not key or value is None:
        raise HTTPException(400, "key and value required")
    res = await db.execute(select(Setting).where(Setting.key == key))
    existing = res.scalar_one_or_none()
    if existing:
        existing.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.add(ActivityLog(action="Settings updated", detail=key))
    await db.commit()
    return {"ok": True}
