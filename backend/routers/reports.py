from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from deps import ensure_seeded
from models import ActivityLog, Budget, Notification, Report, Transaction
from report import build_report, to_csv, to_excel, to_pdf
from schemas import ReportGenerateRequest

router = APIRouter(prefix="/api/reports", tags=["reports"])

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db

def _ser(r: Report) -> dict:
    return {"id": r.id, "type": r.type, "format": r.format,
            "rangeStart": r.range_start.isoformat(), "rangeEnd": r.range_end.isoformat(),
            "status": r.status, "rowCount": r.row_count, "createdAt": r.created_at.isoformat()}

@router.post("/generate")
async def generate(body: ReportGenerateRequest, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    try:
        from_dt = datetime.fromisoformat(body.from_date)
        to_dt   = datetime.fromisoformat(body.to_date)
    except (ValueError, TypeError):
        raise HTTPException(400, "Valid date range required")
    if from_dt > to_dt:
        raise HTTPException(400, "Start date must be before end date")
    fmt = body.format if body.format in ("pdf","excel","csv") else "pdf"
    txns    = (await db.execute(select(Transaction))).scalars().all()
    budgets = (await db.execute(select(Budget))).scalars().all()
    data    = build_report(body.type, from_dt, to_dt, txns, budgets)
    r = Report(type=body.type, format=fmt, range_start=from_dt, range_end=to_dt, row_count=len(data["rows"]))
    db.add(r)
    db.add(ActivityLog(action="Report generated", detail=f"{data['title']} ({fmt.upper()})"))
    db.add(Notification(title="Report ready", body=f"{data['title']} is ready to download.", type="success"))
    await db.commit()
    await db.refresh(r)
    return _ser(r)

@router.get("/{id}")
async def get_report(id: int, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    res = await db.execute(select(Report).where(Report.id == id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Report not found")
    txns    = (await db.execute(select(Transaction))).scalars().all()
    budgets = (await db.execute(select(Budget))).scalars().all()
    data    = build_report(r.type, r.range_start, r.range_end, txns, budgets)
    return {**_ser(r), "title": data["title"], "summary": data["summary"],
            "headers": data["headers"], "previewRows": data["rows"][:25], "totalRows": len(data["rows"])}

@router.get("/{id}/download")
async def download_report(id: int, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    res = await db.execute(select(Report).where(Report.id == id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Report not found")
    txns    = (await db.execute(select(Transaction))).scalars().all()
    budgets = (await db.execute(select(Budget))).scalars().all()
    data    = build_report(r.type, r.range_start, r.range_end, txns, budgets)
    slug    = data["title"].lower().replace(" ", "-")
    fname   = f"{slug}-{r.id}"
    if r.format == "csv":
        return Response(to_csv(data).encode(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{fname}.csv"'})
    if r.format in ("excel","xlsx"):
        return Response(to_excel(data), media_type="application/vnd.ms-excel; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{fname}.xls"'})
    return Response(to_pdf(data), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}.pdf"'})

@router.delete("/{id}")
async def delete_report(id: int, db: AsyncSession = Depends(get_db)):
    await ensure_seeded(db)
    res = await db.execute(select(Report).where(Report.id == id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Not found")
    await db.delete(r)
    await db.commit()
    return {"ok": True}
