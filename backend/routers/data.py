"""Data router — reset / demo / restore / export.

Mirrors the JS `/api/data` (POST actions) and `/api/data/export` (GET backup).
"""
from __future__ import annotations
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from deps import ensure_seeded
from models import (
    Account, Transaction, Budget, Subscription, Bill, Invoice,
    Goal, Group, SharedExpense, Settlement, Scan, Report,
    Notification, ActivityLog, Setting,
)
from .resources import _apply, _to_dict
from seed import clear_all, seed_all

router = APIRouter(prefix="/api/data", tags=["data"])

# snake_case backup keys → ORM model (matches JS TABLES map).
TABLES: dict[str, type] = {
    "transactions": Transaction,
    "accounts": Account,
    "budgets": Budget,
    "subscriptions": Subscription,
    "bills": Bill,
    "invoices": Invoice,
    "goals": Goal,
    "groups": Group,
    "shared_expenses": SharedExpense,
    "settlements": Settlement,
    "scans": Scan,
    "reports": Report,
    "notifications": Notification,
    "activity_log": ActivityLog,
}


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


@router.post("")
async def data_action(body: dict, db: AsyncSession = Depends(get_db)):
    """POST { action: "reset" | "demo" | "restore", data? }"""
    action = body.get("action")

    if action == "reset":
        await clear_all(db)
        return {"ok": True}

    if action == "demo":
        await clear_all(db)
        await seed_all(db)
        return {"ok": True}

    if action == "restore":
        data = body.get("data")
        if not isinstance(data, dict) or "tables" not in data:
            raise HTTPException(400, "Invalid backup file")
        tables = data.get("tables") or {}
        await clear_all(db)
        for name, model in TABLES.items():
            rows = tables.get(name)
            if not isinstance(rows, list) or not rows:
                continue
            for row in rows:
                obj = model()
                _apply(obj, row)
                db.add(obj)
        settings_data = data.get("settings")
        if isinstance(settings_data, dict):
            for key, value in settings_data.items():
                existing = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
                if existing:
                    existing.value = value
                else:
                    db.add(Setting(key=key, value=value))
        await db.commit()
        return {"ok": True}

    raise HTTPException(400, "Unknown action")


@router.get("/export")
async def export_data(db: AsyncSession = Depends(get_db)):
    """GET /api/data/export — returns a full JSON backup (download)."""
    await ensure_seeded(db)

    tables: dict[str, list[dict]] = {}
    for name, model in TABLES.items():
        rows = (await db.execute(select(model))).scalars().all()
        tables[name] = [_to_dict(r) for r in rows]

    # Never leak base64 preview blobs in backups.
    for row in tables["scans"]:
        row["previewUrl"] = ""

    settings_rows = (await db.execute(select(Setting))).scalars().all()
    payload = {
        "app": "AI Expense Scanner",
        "version": 1,
        "exportedAt": datetime.now().isoformat(),
        "tables": tables,
        "settings": {r.key: r.value for r in settings_rows},
    }
    return Response(
        json.dumps(payload, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="ai-expense-scanner-backup.json"'},
    )
