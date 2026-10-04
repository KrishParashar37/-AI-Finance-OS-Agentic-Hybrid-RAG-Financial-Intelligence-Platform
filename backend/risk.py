"""Risk assessment — same logic as JS assessRisk()."""
from __future__ import annotations
from datetime import datetime
from typing import NamedTuple


class RiskResult(NamedTuple):
    risk: str   # low | medium | high
    reason: str


def assess_risk(
    merchant: str,
    category: str,
    amount: float,
    date: datetime,
    txn_type: str,
    history: list,          # list of Transaction ORM rows
) -> RiskResult:
    if txn_type != "expense":
        return RiskResult("low", "")

    same_cat = [h for h in history if h.type == "expense" and h.category == category]
    risk = "low"
    reason = ""

    if len(same_cat) >= 5:
        avg = sum(h.amount for h in same_cat) / len(same_cat)
        ratio = amount / avg if avg else 0
        if ratio > 4:
            risk = "high"
            reason = f"Amount is {ratio:.1f}× your typical {category} purchase"
        elif ratio > 2.5:
            risk = "medium"
            reason = f"Amount is {ratio:.1f}× your typical {category} purchase"

    seen = any(h.merchant.lower() == merchant.lower() for h in history)
    if not seen and amount >= 5000 and risk == "low":
        risk = "medium"
        reason = "First-time merchant with a large amount"

    if amount >= 20000 and risk == "low":
        risk = "medium"
        reason = "Unusually large transaction"

    dup = any(
        h.merchant.lower() == merchant.lower()
        and h.amount == amount
        and abs((h.date - date).total_seconds()) < 86400
        for h in history
    )
    if dup:
        dup_msg = "Duplicate: same merchant & amount within 24h"
        reason = f"{reason}; {dup_msg}" if reason else dup_msg

    return RiskResult(risk, reason)
