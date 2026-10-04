"""Generic resource CRUD router — mirrors JS /api/resources/:resource/:id."""
from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from deps import ensure_seeded
from models import (Account, Budget, Subscription, Bill, Invoice, Goal,
                    Group, SharedExpense, Settlement, Scan, Report,
                    Notification, ActivityLog)

router = APIRouter(prefix="/api/resources", tags=["resources"])

RESOURCE_MAP = {
    "budgets": Budget, "subscriptions": Subscription, "bills": Bill,
    "invoices": Invoice, "goals": Goal, "accounts": Account, "groups": Group,
    "shared-expenses": SharedExpense, "settlements": Settlement,
    "reports": Report, "notifications": Notification, "scans": Scan,
    "activity": ActivityLog,
}


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


def _to_dict(obj) -> dict:
    d = {}
    for c in obj.__table__.columns:
        v = getattr(obj, c.name)
        if isinstance(v, datetime):
            v = v.isoformat()
        # camelCase mapping
        key = _camel(c.name)
        d[key] = v
    return d


def _camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


def _apply(obj, body: dict):
    for c in obj.__table__.columns:
        snake = c.name
        camel = _camel(snake)
        val = body.get(camel, body.get(snake))
        if val is None:
            continue
        if c.type.__class__.__name__ in ("DateTime", "TIMESTAMP") and isinstance(val, str):
            val = datetime.fromisoformat(val)
        setattr(obj, snake, val)


@router.get("/{resource}")
async def list_resource(resource: str, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    model = RESOURCE_MAP.get(resource)
    if not model:
        raise HTTPException(404, f"Unknown resource: {resource}")
    res = await db.execute(select(model).order_by(model.id.desc()))
    rows = res.scalars().all()
    result = [_to_dict(r) for r in rows]
    # Strip large preview URLs from scan list (flag only, never the base64 blob)
    if resource == "scans":
        for r in result:
            r["previewUrl"] = "yes" if r.get("previewUrl") else ""
    return result


@router.post("/{resource}")
async def create_resource(resource: str, body: dict, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    model = RESOURCE_MAP.get(resource)
    if not model:
        raise HTTPException(404, f"Unknown resource: {resource}")
    obj = model()
    _apply(obj, body)
    db.add(obj)
    if resource not in ("activity", "notifications"):
        name = getattr(obj, "name", None) or getattr(obj, "title", None) or getattr(obj, "category", None) or getattr(obj, "number", None) or ""
        db.add(ActivityLog(action=f"Created {resource.replace('-',' ')}", detail=str(name)))
    await db.commit()
    await db.refresh(obj)
    return _to_dict(obj)


@router.patch("/{resource}")
async def bulk_update(resource: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Bulk update all rows — e.g. mark all notifications read."""
    await ensure_seeded(db)
    model = RESOURCE_MAP.get(resource)
    if not model:
        raise HTTPException(404, f"Unknown resource: {resource}")
    set_data = body.get("set", {})
    if not set_data:
        raise HTTPException(400, "Nothing to update")
    res = await db.execute(select(model))
    rows = res.scalars().all()
    for obj in rows:
        _apply(obj, set_data)
    await db.commit()
    return {"ok": True}


@router.delete("/{resource}")
async def bulk_delete(resource: str, db: AsyncSession = Depends(get_db)):
    if resource not in ("notifications", "activity"):
        raise HTTPException(403, "Bulk delete not allowed")
    model = RESOURCE_MAP[resource]
    await db.execute(delete(model))
    await db.commit()
    return {"ok": True}


@router.get("/{resource}/{id}")
async def get_one(resource: str, id: int, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    model = RESOURCE_MAP.get(resource)
    if not model:
        raise HTTPException(404, f"Unknown resource: {resource}")
    res = await db.execute(select(model).where(model.id == id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Not found")
    return _to_dict(obj)


@router.patch("/{resource}/{id}")
async def update_one(resource: str, id: int, body: dict, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    model = RESOURCE_MAP.get(resource)
    if not model:
        raise HTTPException(404, f"Unknown resource: {resource}")
    res = await db.execute(select(model).where(model.id == id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Not found")
    _apply(obj, body)
    name = getattr(obj, "name", None) or getattr(obj, "title", None) or str(id)
    db.add(ActivityLog(action=f"Updated {resource.replace('-',' ')}", detail=str(name)))
    await db.commit()
    await db.refresh(obj)
    return _to_dict(obj)


@router.delete("/{resource}/{id}")
async def delete_one(resource: str, id: int, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    model = RESOURCE_MAP.get(resource)
    if not model:
        raise HTTPException(404, f"Unknown resource: {resource}")
    res = await db.execute(select(model).where(model.id == id))
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Not found")
    name = getattr(obj, "name", None) or getattr(obj, "title", None) or str(id)
    db.add(ActivityLog(action=f"Deleted {resource.replace('-',' ')}", detail=str(name)))
    await db.delete(obj)
    await db.commit()
    return {"ok": True}
