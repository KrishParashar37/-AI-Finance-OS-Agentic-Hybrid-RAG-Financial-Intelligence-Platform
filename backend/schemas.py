"""Pydantic v2 schemas."""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TransactionOut(OrmBase):
    pass  # we return plain dicts from routes, this is kept for compat


class TransactionCreate(BaseModel):
    type: str = "expense"
    merchant: str
    category: str = "Other"
    amount: float
    tax: float = 0
    date: Optional[str] = None
    payment_method: str = "UPI"
    account_id: Optional[int] = None
    notes: str = ""
    source: str = "manual"
    recurring: bool = False


class TransactionUpdate(BaseModel):
    merchant: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    tax: Optional[float] = None
    date: Optional[str] = None
    payment_method: Optional[str] = None
    account_id: Optional[int] = None
    notes: Optional[str] = None
    source: Optional[str] = None
    recurring: Optional[bool] = None
    risk: Optional[str] = None
    risk_reason: Optional[str] = None


class BudgetCreate(BaseModel):
    category: str
    limit_amount: float
    period: str = "monthly"


class ChatRequest(BaseModel):
    message: str


class ReportGenerateRequest(BaseModel):
    type: str = "monthly"
    format: str = "pdf"
    from_date: str
    to_date: str
