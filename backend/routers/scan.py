"""Scan router — file upload (demo extraction) + save as expense."""
from __future__ import annotations
import base64
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from deps import ensure_seeded
from models import ActivityLog, Notification, Scan, Transaction
from risk import assess_risk

router = APIRouter(prefix="/api/scan", tags=["scan"])

RECEIPT_MERCHANTS = [
    {"m": "Amazon",         "c": "Shopping",     "pay": "UPI",         "min": 499,  "max": 4800,  "items": ["Wireless Mouse","USB-C Cable","Phone Case","Bluetooth Speaker","Notebook Set"]},
    {"m": "Zomato",         "c": "Food",         "pay": "UPI",         "min": 220,  "max": 780,   "items": ["Paneer Tikka Bowl","Veg Biryani","Cold Coffee","Garlic Naan","Brownie"]},
    {"m": "Starbucks",      "c": "Food",         "pay": "Debit Card",  "min": 280,  "max": 840,   "items": ["Caffe Latte","Cappuccino","Blueberry Muffin","Cold Brew"]},
    {"m": "BigBasket",      "c": "Groceries",    "pay": "UPI",         "min": 650,  "max": 3200,  "items": ["Basmati Rice 5kg","Amul Milk 1L","Eggs (12)","Tomatoes 1kg","Olive Oil"]},
    {"m": "DMart",          "c": "Groceries",    "pay": "Debit Card",  "min": 900,  "max": 3600,  "items": ["Atta 10kg","Sugar 2kg","Detergent","Biscuits","Dal 1kg"]},
    {"m": "Uber",           "c": "Transport",    "pay": "UPI",         "min": 140,  "max": 680,   "items": ["Ride fare","Booking fee","Tip"]},
    {"m": "Apollo Pharmacy","c": "Health",       "pay": "UPI",         "min": 180,  "max": 1600,  "items": ["Paracetamol","Vitamin D3","Cough Syrup","Bandages"]},
    {"m": "PVR Cinemas",    "c": "Entertainment","pay": "Credit Card", "min": 420,  "max": 1500,  "items": ["Movie Ticket x2","Popcorn Combo","Cold Drink"]},
    {"m": "Reliance Digital","c":"Shopping",     "pay": "Credit Card", "min": 1500, "max": 9000,  "items": ["HDMI Cable","Power Bank","Earphones"]},
]
INVOICE_VENDORS = [
    {"m": "AWS India",       "c": "Bills",         "pay": "Net Banking", "min": 1800, "max": 9000,  "items": ["EC2 Compute", "S3 Storage", "Data Transfer"]},
    {"m": "Adobe Systems",   "c": "Subscriptions", "pay": "Credit Card", "min": 1500, "max": 2400,  "items": ["Creative Cloud (monthly)"]},
    {"m": "Tata Power",      "c": "Bills",         "pay": "UPI",         "min": 1200, "max": 3200,  "items": ["Electricity charges", "Fixed charges"]},
    {"m": "Urban Company",   "c": "Other",         "pay": "UPI",         "min": 600,  "max": 3200,  "items": ["Home cleaning", "AC service"]},
    {"m": "Apollo Hospitals","c": "Health",        "pay": "Credit Card", "min": 1500, "max": 12000, "items": ["Consultation", "Lab tests", "Medicines"]},
]
TAX = {"Shopping": 0.18, "Entertainment": 0.18, "Bills": 0.18, "Food": 0.05, "Groceries": 0.05, "Health": 0.05, "Subscriptions": 0.18, "Other": 0.18}

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


def _hash(s: str) -> int:
    h = 2166136261
    for c in s:
        h ^= ord(c)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _prng(seed: int):
    s = [seed or 1]
    def rand():
        s[0] = (s[0] * 1664525 + 1013904223) & 0xFFFFFFFF
        return s[0] / 4294967296
    return rand


def _extract(name: str, size: int, kind: str) -> dict:
    h = _hash(f"{name}:{size}")
    r = _prng(h)
    pool = INVOICE_VENDORS if kind == "invoice" else RECEIPT_MERCHANTS
    lower = name.lower()
    hinted = next((p for p in pool if p["m"].lower().split()[0] in lower), None)
    mer = hinted or pool[h % len(pool)]
    total = round(mer["min"] + r() * (mer["max"] - mer["min"]))
    rate = TAX.get(mer["c"], 0.18)
    tax = round((total * rate) / (1 + rate))
    n = min(len(mer["items"]), 2 + int(r() * 3))
    weights = [0.5 + r() for _ in range(n)]
    w_sum = sum(weights)
    sub = total - tax
    items, used = [], 0
    for i in range(n):
        price = sub - used if i == n - 1 else round(sub * weights[i] / w_sum)
        used += price
        qty = 1 + (int(r() * 2) if i == 0 else 0)  # first item may have qty 2
        items.append({"name": mer["items"][i], "qty": qty, "price": price})
    date = datetime.now().replace(hour=12, minute=0, second=0) - timedelta(days=h % 4)
    conf = 88 + (h % 11)
    inv_num = f"INV-{date.year}-{1000 + (h % 9000)}"
    return {"mer": mer, "total": total, "tax": tax, "items": items, "date": date, "confidence": conf, "invoiceNumber": inv_num}


def _ser_txn(t: Transaction) -> dict:
    return {"id": t.id, "type": t.type, "merchant": t.merchant, "category": t.category,
            "amount": t.amount, "tax": t.tax, "date": t.date.isoformat(),
            "paymentMethod": t.payment_method, "accountId": t.account_id, "notes": t.notes,
            "source": t.source, "recurring": t.recurring, "risk": t.risk,
            "riskReason": t.risk_reason, "createdAt": t.created_at.isoformat()}


def _ser(s: Scan) -> dict:
    return {"id": s.id, "fileName": s.file_name, "fileSize": s.file_size, "kind": s.kind,
            "merchant": s.merchant, "date": s.date.isoformat(), "total": s.total, "tax": s.tax,
            "category": s.category, "paymentMethod": s.payment_method, "confidence": s.confidence,
            "items": s.items, "status": s.status, "previewUrl": s.preview_url, "createdAt": s.created_at.isoformat()}


@router.post("")
async def upload_scan(
    files: list[UploadFile] = File(...),
    kind: str = "receipt",
    db: AsyncSession = Depends(get_db),
):
    await ensure_seeded(db)
    kind = "invoice" if kind == "invoice" else "receipt"
    if not files:
        raise HTTPException(400, "Please attach at least one file")
    out = []
    for file in files:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(400, f"{file.filename}: larger than 10MB")
        ct = file.content_type or ""
        ok_type = ct.startswith("image/") or ct == "application/pdf" or any(file.filename.lower().endswith(e) for e in (".jpg", ".jpeg", ".png", ".pdf", ".webp"))
        if not ok_type:
            raise HTTPException(400, f"{file.filename}: unsupported file type")
        x = _extract(file.filename, len(content), kind)
        preview = ""
        if ct.startswith("image/") and len(content) <= 2.5 * 1024 * 1024:
            preview = f"data:{ct};base64,{base64.b64encode(content).decode()}"
        scan = Scan(file_name=file.filename, file_size=len(content), kind=kind,
                    merchant=x["mer"]["m"], date=x["date"], total=x["total"], tax=x["tax"],
                    category=x["mer"]["c"], payment_method=x["mer"]["pay"],
                    confidence=x["confidence"], items=x["items"], preview_url=preview)
        db.add(scan)
        await db.flush()
        await db.refresh(scan)  # load server-default createdAt before serialising
        out.append({**_ser(scan), "invoiceNumber": x["invoiceNumber"]})
    db.add(ActivityLog(action="Receipt scanned", detail="; ".join(f"{o['fileName']} → {o['merchant']} ₹{o['total']:,.0f}" for o in out)[:200]))
    await db.commit()
    return {"scans": out}


@router.post("/{id}/save")
async def save_scan(id: int, body: dict = {}, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    res = await db.execute(select(Scan).where(Scan.id == id))
    scan = res.scalar_one_or_none()
    if not scan:
        raise HTTPException(404, "Scan not found")
    if scan.status == "saved":
        raise HTTPException(400, "Already saved")

    merchant = str(body.get("merchant", scan.merchant)).strip()
    total    = float(body.get("total", scan.total))
    tax      = float(body.get("tax", scan.tax))
    category = str(body.get("category", scan.category))
    pay_method = str(body.get("paymentMethod", scan.payment_method))
    date     = datetime.fromisoformat(body["date"]) if "date" in body else scan.date

    history = (await db.execute(select(Transaction))).scalars().all()
    risk_r  = assess_risk(merchant, category, total, date, "expense", history)

    t = Transaction(type="expense", merchant=merchant, category=category, amount=total,
                    tax=tax, date=date, payment_method=pay_method,
                    notes=f"Scanned from {scan.file_name}", source="scan",
                    risk=risk_r.risk, risk_reason=risk_r.reason)
    db.add(t)
    scan.status = "saved"
    db.add(ActivityLog(action="Receipt saved as expense", detail=f"{merchant} ₹{total:,.0f} (from {scan.file_name})"))
    if risk_r.risk != "low":
        db.add(Notification(title=f"{'High-risk' if risk_r.risk=='high' else 'Suspicious'} transaction flagged", body=f"{merchant} ₹{total:,.0f}: {risk_r.reason}", type="alert"))
    await db.commit()
    await db.refresh(t)
    await db.refresh(scan)
    return {"transaction": _ser_txn(t), "scan": _ser(scan)}
