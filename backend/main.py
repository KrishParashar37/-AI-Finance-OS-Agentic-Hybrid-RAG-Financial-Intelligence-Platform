"""FastAPI application entrypoint — wires the routers, CORS, health and startup.

Run from the `backend/` directory:
    python main.py
    # or
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from database import AsyncSessionLocal, Base, engine
import models  # noqa: F401 — registers all ORM models on Base.metadata
from deps import ensure_seeded
from routers import (
    ai, budgets, data, reports, resources, scan, search,
    security, settings, stats, transactions, rag,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they don't exist yet, then seed demo data on first run.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await ensure_seeded(db)
    yield
    await engine.dispose()


app = FastAPI(
    title="AI Expense Scanner API",
    description="FastAPI mirror of the Next.js AI Expense Scanner backend.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for _router in (
    transactions, ai, budgets, reports, resources, scan,
    search, security, settings, stats, data, rag,
):
    app.include_router(_router.router)


@app.get("/api/health", tags=["health"])
async def health():
    """DB connectivity probe — mirrors the Next.js /api/health route."""
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception:
        return JSONResponse({"ok": False}, status_code=500)


@app.get("/", include_in_schema=False)
async def root():
    return {"name": "AI Expense Scanner API", "docs": "/docs", "health": "/api/health"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
