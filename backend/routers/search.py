from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from deps import ensure_seeded
from models import Bill, Goal, Group, Invoice, Scan, Subscription, Transaction

router = APIRouter(prefix="/api/search", tags=["search"])

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db

def _fmt(d) -> str:
    return d.strftime("%d %b %Y") if d else ""

@router.get("")
async def search(q: str = Query(""), db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    if not q.strip():
        return {"results": []}
    like = f"%{q}%"

    tx   = (await db.execute(select(Transaction).where(or_(Transaction.merchant.ilike(like), Transaction.category.ilike(like), Transaction.notes.ilike(like))).order_by(desc(Transaction.date)).limit(8))).scalars().all()
    subs = (await db.execute(select(Subscription).where(Subscription.name.ilike(like)).limit(4))).scalars().all()
    bills= (await db.execute(select(Bill).where(Bill.name.ilike(like)).limit(4))).scalars().all()
    invs = (await db.execute(select(Invoice).where(or_(Invoice.party.ilike(like), Invoice.number.ilike(like))).limit(4))).scalars().all()
    goals= (await db.execute(select(Goal).where(Goal.name.ilike(like)).limit(4))).scalars().all()
    grps = (await db.execute(select(Group).where(Group.name.ilike(like)).limit(4))).scalars().all()
    scans= (await db.execute(select(Scan).where(or_(Scan.merchant.ilike(like), Scan.file_name.ilike(like))).order_by(desc(Scan.id)).limit(4))).scalars().all()

    results = (
        [{"type": "Income" if t.type=="income" else "Expense", "id": t.id, "title": t.merchant, "subtitle": f"{t.category} · {_fmt(t.date)}", "amount": t.amount if t.type=="income" else -t.amount, "href": f"/{'income' if t.type=='income' else 'expenses'}/{t.id}"} for t in tx]
      + [{"type": "Subscription", "id": s.id, "title": s.name, "subtitle": f"₹{s.amount:,.0f}/{s.cycle}", "href": f"/subscriptions/{s.id}"} for s in subs]
      + [{"type": "Bill", "id": b.id, "title": b.name, "subtitle": f"Due {_fmt(b.due_date)} · {b.status}", "href": f"/bills/{b.id}"} for b in bills]
      + [{"type": "Invoice", "id": i.id, "title": f"{i.number} · {i.party}", "subtitle": i.status, "href": f"/invoices/{i.id}"} for i in invs]
      + [{"type": "Goal", "id": g.id, "title": g.name, "subtitle": f"₹{g.saved:,.0f} / ₹{g.target:,.0f}", "href": f"/goals/{g.id}"} for g in goals]
      + [{"type": "Group", "id": g.id, "title": g.name, "subtitle": f"{len(g.members)} members", "href": "/shared/groups"} for g in grps]
      + [{"type": "Scan", "id": s.id, "title": f"{s.merchant} ({s.file_name})", "subtitle": f"₹{s.total:,.0f} · {s.confidence}% confidence", "href": f"/scanner/result/{s.id}"} for s in scans]
    )
    return {"results": results}
