"""Transactions router — CRUD + bulk actions."""
from __future__ import annotations
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from deps import ensure_seeded
from models import Account, Transaction
from risk import assess_risk
from schemas import TransactionCreate, TransactionOut, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


async def _apply_balance(db: AsyncSession, account_id: int | None, txn_type: str, amount: float, sign: int):
    if account_id is None:
        return
    result = await db.execute(select(Account).where(Account.id == account_id))
    acc = result.scalar_one_or_none()
    if acc:
        acc.balance += sign * (amount if txn_type == "income" else -amount)


async def _log(db: AsyncSession, action: str, detail: str):
    from models import ActivityLog
    db.add(ActivityLog(action=action, detail=detail))


async def _notify(db: AsyncSession, title: str, body: str, ntype: str = "info"):
    from models import Notification
    db.add(Notification(title=title, body=body, type=ntype))


@router.get("")
async def list_transactions(
    type: Optional[str] = None, category: Optional[str] = None,
    payment: Optional[str] = None, risk: Optional[str] = None,
    source: Optional[str] = None,
    account_id: Optional[int] = Query(None, alias="accountId"),
    recurring: Optional[str] = None, q: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    min_amt: Optional[float] = Query(None, alias="min"),
    max_amt: Optional[float] = Query(None, alias="max"),
    sort: str = "date", dir: str = "desc",
    page: int = 1, limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    await ensure_seeded(db)
    conds = []
    if type: conds.append(Transaction.type == type)
    if category: conds.append(Transaction.category.in_(category.split(",")))
    if payment: conds.append(Transaction.payment_method.in_(payment.split(",")))
    if risk: conds.append(Transaction.risk.in_(risk.split(",")))
    if source: conds.append(Transaction.source == source)
    if account_id: conds.append(Transaction.account_id == account_id)
    if recurring == "1": conds.append(Transaction.recurring == True)
    if q:
        conds.append(or_(Transaction.merchant.ilike(f"%{q}%"), Transaction.notes.ilike(f"%{q}%"), Transaction.category.ilike(f"%{q}%")))
    if from_date: conds.append(Transaction.date >= datetime.fromisoformat(from_date))
    if to_date:
        td = datetime.fromisoformat(to_date).replace(hour=23, minute=59, second=59)
        conds.append(Transaction.date <= td)
    if min_amt: conds.append(Transaction.amount >= min_amt)
    if max_amt: conds.append(Transaction.amount <= max_amt)

    sort_map = {"date": Transaction.date, "amount": Transaction.amount, "merchant": Transaction.merchant, "category": Transaction.category}
    col = sort_map.get(sort, Transaction.date)
    order = asc(col) if dir == "asc" else desc(col)
    where = and_(*conds) if conds else None

    page = max(1, page)
    limit = min(200, max(1, limit))

    stmt = select(Transaction)
    if where is not None:
        stmt = stmt.where(where)
    stmt = stmt.order_by(order, desc(Transaction.id)).limit(limit).offset((page - 1) * limit)

    count_stmt = select(func.count(), func.coalesce(func.sum(Transaction.amount), 0))
    if where is not None:
        count_stmt = count_stmt.where(where)

    items_res = await db.execute(stmt)
    items = items_res.scalars().all()

    agg_res = await db.execute(count_stmt.select_from(Transaction))
    total, total_sum = agg_res.one()
    return {"items": [_ser(t) for t in items], "total": total, "page": page, "limit": limit, "sum": float(total_sum)}


@router.post("")
async def create_transaction(body: TransactionCreate, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    merchant = (body.merchant or "").strip()
    if not merchant:
        raise HTTPException(400, "Merchant / source is required")
    if not body.amount or body.amount <= 0:
        raise HTTPException(400, "Amount must be greater than 0")
    txn_type = "income" if body.type == "income" else "expense"
    if body.date:
        date = datetime.fromisoformat(body.date)
        if len(body.date) == 10:  # YYYY-MM-DD → midday, avoids timezone day-shift
            date = date.replace(hour=12, minute=0, second=0, microsecond=0)
    else:
        date = datetime.now()
    category = body.category or ("Salary" if txn_type == "income" else "Other")
    history_res = await db.execute(select(Transaction))
    history = history_res.scalars().all()
    risk_result = assess_risk(merchant, category, body.amount, date, txn_type, history)
    t = Transaction(
        type=txn_type, merchant=merchant, category=category,
        amount=body.amount, tax=body.tax, date=date, payment_method=body.payment_method,
        account_id=body.account_id, notes=body.notes, source=body.source,
        recurring=body.recurring, risk=risk_result.risk, risk_reason=risk_result.reason,
    )
    db.add(t)
    await db.flush()
    await _apply_balance(db, t.account_id, t.type, t.amount, 1)
    await _log(db, "Income added" if t.type == "income" else "Expense added", f"{t.merchant} ₹{t.amount:,.0f}")
    if risk_result.risk != "low":
        await _notify(db, f"{'High-risk' if risk_result.risk=='high' else 'Suspicious'} transaction flagged", f"{t.merchant} ₹{t.amount:,.0f}: {risk_result.reason}", "alert")
    await db.commit()
    await db.refresh(t)
    return _ser(t)


@router.get("/{id}")
async def get_transaction(id: int, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    t = await _get_or_404(db, id)
    return _ser(t)


@router.patch("/{id}")
async def update_transaction(id: int, body: TransactionUpdate, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    t = await _get_or_404(db, id)
    old_amount, old_account, old_type = t.amount, t.account_id, t.type
    for k, v in body.model_dump(exclude_none=True).items():
        if k == "date" and isinstance(v, str):
            v = datetime.fromisoformat(v)
        setattr(t, k, v)
    if old_amount != t.amount or old_account != t.account_id or old_type != t.type:
        await _apply_balance(db, old_account, old_type, old_amount, -1)
        await _apply_balance(db, t.account_id, t.type, t.amount, 1)
    await _log(db, "Transaction updated", t.merchant)
    await db.commit()
    await db.refresh(t)
    return _ser(t)


@router.delete("/{id}")
async def delete_transaction(id: int, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    t = await _get_or_404(db, id)
    await _apply_balance(db, t.account_id, t.type, t.amount, -1)
    await _log(db, "Transaction deleted", t.merchant)
    await db.delete(t)
    await db.commit()
    return {"ok": True}


@router.post("/bulk")
async def bulk_action(body: dict, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    ids: list[int] = body.get("ids", [])
    action: str = body.get("action", "")
    category: str | None = body.get("category")
    if not ids:
        raise HTTPException(400, "No items selected")
    res = await db.execute(select(Transaction).where(Transaction.id.in_(ids)))
    txns = res.scalars().all()
    if action == "delete":
        for t in txns:
            await _apply_balance(db, t.account_id, t.type, t.amount, -1)
            await db.delete(t)
    elif action == "category" and category:
        for t in txns:
            t.category = category
    elif action == "recurring":
        for t in txns:
            t.recurring = True
    elif action == "safe":
        for t in txns:
            t.risk = "low"
            t.risk_reason = "Reviewed: marked safe"
    else:
        raise HTTPException(400, "Unknown action")
    await _log(db, "Bulk action", f"{action} on {len(txns)} transactions")
    await db.commit()
    return {"ok": True, "count": len(txns)}


async def _get_or_404(db: AsyncSession, id: int) -> Transaction:
    res = await db.execute(select(Transaction).where(Transaction.id == id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Transaction not found")
    return t


def _ser(t: Transaction) -> dict:
    return {
        "id": t.id, "type": t.type, "merchant": t.merchant, "category": t.category,
        "amount": t.amount, "tax": t.tax, "date": t.date.isoformat(),
        "paymentMethod": t.payment_method, "accountId": t.account_id,
        "notes": t.notes, "source": t.source, "recurring": t.recurring,
        "risk": t.risk, "riskReason": t.risk_reason, "createdAt": t.created_at.isoformat(),
    }
