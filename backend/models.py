"""SQLAlchemy ORM models — mirrors the Drizzle/MySQL schema exactly."""
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON, BigInteger, Boolean, DateTime, Double, Integer,
    String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    institution: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last4: Mapped[str] = mapped_column(Text, nullable=False, default="")
    balance: Mapped[float] = mapped_column(Double, nullable=False, default=0)
    credit_limit: Mapped[float] = mapped_column(Double, nullable=False, default=0, name="credit_limit")
    color: Mapped[str] = mapped_column(Text, nullable=False, default="#6366f1")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(Text, nullable=False, default="expense")
    merchant: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False, default="Other")
    amount: Mapped[float] = mapped_column(Double, nullable=False)
    tax: Mapped[float] = mapped_column(Double, nullable=False, default=0)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    payment_method: Mapped[str] = mapped_column(Text, nullable=False, default="UPI", name="payment_method")
    account_id: Mapped[int | None] = mapped_column(Integer, nullable=True, name="account_id")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source: Mapped[str] = mapped_column(Text, nullable=False, default="manual")
    recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    risk: Mapped[str] = mapped_column(Text, nullable=False, default="low")
    risk_reason: Mapped[str] = mapped_column(Text, nullable=False, default="", name="risk_reason")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Budget(Base):
    __tablename__ = "budgets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    limit_amount: Mapped[float] = mapped_column(Double, nullable=False, name="limit_amount")
    period: Mapped[str] = mapped_column(Text, nullable=False, default="monthly")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    emoji: Mapped[str] = mapped_column(Text, nullable=False, default="🔄")
    amount: Mapped[float] = mapped_column(Double, nullable=False)
    cycle: Mapped[str] = mapped_column(Text, nullable=False, default="monthly")
    next_renewal: Mapped[datetime] = mapped_column(DateTime, nullable=False, name="next_renewal")
    category: Mapped[str] = mapped_column(Text, nullable=False, default="Subscriptions")
    last_used_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="last_used_days")
    price_change_pct: Mapped[float] = mapped_column(Double, nullable=False, default=0, name="price_change_pct")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Bill(Base):
    __tablename__ = "bills"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Double, nullable=False)
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, name="due_date")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="upcoming")
    category: Mapped[str] = mapped_column(Text, nullable=False, default="Bills")
    autopay: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    number: Mapped[str] = mapped_column(Text, nullable=False)
    party: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False, default="payable")
    amount: Mapped[float] = mapped_column(Double, nullable=False)
    tax: Mapped[float] = mapped_column(Double, nullable=False, default=0)
    issue_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="issue_date")
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="due_date")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    emoji: Mapped[str] = mapped_column(Text, nullable=False, default="🎯")
    target: Mapped[float] = mapped_column(Double, nullable=False)
    saved: Mapped[float] = mapped_column(Double, nullable=False, default=0)
    deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Group(Base):
    __tablename__ = "groups"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    emoji: Mapped[str] = mapped_column(Text, nullable=False, default="👥")
    members: Mapped[Any] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class SharedExpense(Base):
    __tablename__ = "shared_expenses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(Integer, nullable=False, name="group_id")
    title: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Double, nullable=False)
    paid_by: Mapped[str] = mapped_column(Text, nullable=False, name="paid_by")
    split_with: Mapped[Any] = mapped_column(JSON, nullable=False, default=list, name="split_with")
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Settlement(Base):
    __tablename__ = "settlements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(Integer, nullable=False, name="group_id")
    from_user: Mapped[str] = mapped_column(Text, nullable=False, name="from_user")
    to_user: Mapped[str] = mapped_column(Text, nullable=False, name="to_user")
    amount: Mapped[float] = mapped_column(Double, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="completed")
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Scan(Base):
    __tablename__ = "scans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_name: Mapped[str] = mapped_column(Text, nullable=False, name="file_name")
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="file_size")
    kind: Mapped[str] = mapped_column(Text, nullable=False, default="receipt")
    merchant: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    total: Mapped[float] = mapped_column(Double, nullable=False)
    tax: Mapped[float] = mapped_column(Double, nullable=False, default=0)
    category: Mapped[str] = mapped_column(Text, nullable=False, default="Other")
    payment_method: Mapped[str] = mapped_column(Text, nullable=False, default="UPI", name="payment_method")
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    items: Mapped[Any] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="processed")
    preview_url: Mapped[str] = mapped_column(Text, nullable=False, default="", name="preview_url")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    format: Mapped[str] = mapped_column(Text, nullable=False, default="pdf")
    range_start: Mapped[datetime] = mapped_column(DateTime, nullable=False, name="range_start")
    range_end: Mapped[datetime] = mapped_column(DateTime, nullable=False, name="range_end")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="ready")
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="row_count")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    type: Mapped[str] = mapped_column(Text, nullable=False, default="info")
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=False)


# ═══════════════════════════════════════════════════════════════════════════════
# RAG Tables
# ═══════════════════════════════════════════════════════════════════════════════

class RagDocument(Base):
    """Stores uploaded documents (PDF, images, etc.) with extracted text."""
    __tablename__ = "rag_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUID
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    doc_type: Mapped[str] = mapped_column(Text, nullable=False, default="receipt")
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True, name="source_id")
    raw_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    char_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="char_count")
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="chunk_count")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="processing")  # processing|indexed|error
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class RagChunk(Base):
    """Individual text chunks derived from documents."""
    __tablename__ = "rag_chunks"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)   # {doc_id}_chunk_{idx}
    document_id: Mapped[str] = mapped_column(String(36), nullable=False, name="document_id")
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="chunk_index")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    char_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="char_count")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")


class RagQuery(Base):
    """Log of all RAG queries for analytics and debugging."""
    __tablename__ = "rag_queries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(Text, nullable=False, default="hybrid")   # sql|vector|hybrid
    answer: Mapped[str] = mapped_column(Text, nullable=False, default="")
    chunks_retrieved: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="chunks_retrieved")
    sql_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, name="sql_used")
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0, name="latency_ms")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), name="created_at")
