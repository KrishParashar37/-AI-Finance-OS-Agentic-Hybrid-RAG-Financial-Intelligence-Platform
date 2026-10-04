"""Local rule-based chat fallback — same logic as JS chat.ts answer()."""
from __future__ import annotations
import re
from datetime import datetime
from analytics import category_stats, month_series, _mean_safe
from ai_engine import sub_monthly, get_insights


def _money(v: float) -> str:
    return f"₹{v:,.0f}"


def _fmt_date(d: datetime) -> str:
    return d.strftime("%d %b %Y")


CAT_META: dict[str, dict] = {
    "Food": {"emoji": "🍔", "color": "#f97316"},
    "Shopping": {"emoji": "🛍️", "color": "#8b5cf6"},
    "Transport": {"emoji": "🚗", "color": "#0ea5e9"},
    "Groceries": {"emoji": "🛒", "color": "#22c55e"},
    "Entertainment": {"emoji": "🎬", "color": "#ec4899"},
    "Health": {"emoji": "💊", "color": "#ef4444"},
    "Education": {"emoji": "📚", "color": "#3b82f6"},
    "Travel": {"emoji": "✈️", "color": "#14b8a6"},
    "Bills": {"emoji": "🧾", "color": "#f59e0b"},
    "Subscriptions": {"emoji": "🔄", "color": "#6366f1"},
    "Salary": {"emoji": "💼", "color": "#10b981"},
    "Freelance": {"emoji": "💻", "color": "#06b6d4"},
    "Investments": {"emoji": "📈", "color": "#84cc16"},
    "Other": {"emoji": "📦", "color": "#94a3b8"},
}


def _cat_meta(name: str) -> dict:
    return CAT_META.get(name, {"emoji": "📦", "color": "#94a3b8"})


def _bars(rows: list[dict], total: float, n: int = 5) -> list[dict]:
    return [
        {"label": r["name"], "emoji": _cat_meta(r["name"])["emoji"],
         "value": round(r["value"]), "pct": round(r["value"] / total * 100) if total else 0,
         "color": _cat_meta(r["name"])["color"]}
        for r in rows if r["value"] > 0
    ][:n]


def answer(message: str, txns: list, budgets: list, subs: list, bills: list, goals: list, accs: list) -> dict:
    q = message.lower().strip()
    monthly = month_series(txns, 7)
    cur = monthly[-1]
    completed = monthly[:-1]
    avg_income = _mean_safe([m["income"] for m in completed[-3:]])
    avg_expense = _mean_safe([m["expense"] for m in completed[-3:]])
    cats = sorted(category_stats(txns), key=lambda c: -c["mtd"])
    total_mtd = sum(c["mtd"] for c in cats)

    # Greeting / help
    if re.search(r'^(hi|hello|hey|namaste|hii+)\b|help\b|what can you', q):
        return {"text": "Hi! 👋 I'm your AI finance assistant.\n\n• 💸 Spending by category\n• 📊 Budget usage\n• 🔮 Predictions\n• 📋 Subscriptions\n• 🧾 Bills\n• 🎯 Goals\n• 🚨 Anomalies\n• 💰 Balance & income\n\nJust ask anything!"}

    # Save specific amount
    m = re.search(r'sav\w*\s*(?:₹|rs\.?|inr)?\s*([\d,]+)', q)
    if m:
        goal_amt = float(m.group(1).replace(",", ""))
        surplus = avg_income - avg_expense
        ok = surplus >= goal_amt
        disc = [c for c in cats if c["name"] in ("Shopping", "Food", "Entertainment", "Travel")][:3]
        text = (f"{'Yes — you can.' if ok else 'Tight, but possible.'} "
                f"Avg surplus {_money(surplus)} (income {_money(avg_income)} − expenses {_money(avg_expense)}). "
                + (f"Saving {_money(goal_amt)} leaves {_money(surplus - goal_amt)}." if ok
                   else f"Need to cut {_money(goal_amt - surplus)} from discretionary."))
        return {"text": text + "\n\nBiggest places to trim:", "bars": _bars([{"name": c["name"], "value": c["mtd"]} for c in disc], total_mtd, 3)}

    # General savings
    if re.search(r'\bsav(e|ing|ings|ed)?\b|am i saving|my savings|surplus', q):
        surplus = avg_income - avg_expense
        rate = round(surplus / avg_income * 100) if avg_income else 0
        return {"text": f"Avg monthly savings: {_money(surplus)} ({rate}% savings rate).\n\nIncome avg: {_money(avg_income)}\nExpense avg: {_money(avg_expense)}\n\nThis month: earned {_money(cur['income'])}, spent {_money(cur['expense'])}, net {_money(cur['income'] - cur['expense'])}."}

    # Anomalies
    if re.search(r'unusual|anomal|suspicious|fraud|risk|flagged|duplicate|scam', q):
        risky = sorted([t for t in txns if t.risk != "low" or t.risk_reason.startswith("Duplicate")], key=lambda t: -t.date.timestamp())[:5]
        if not risky:
            return {"text": "All clear — no unusual transactions found. 🎉"}
        lines = "\n".join(f"• {t.merchant} {_money(t.amount)} on {_fmt_date(t.date)} — {t.risk.upper()}: {t.risk_reason or 'flagged'}" for t in risky)
        return {"text": f"Found {len(risky)} transactions to review:\n\n{lines}\n\nOpen Security Center to review."}

    # Predictions
    if re.search(r'predict|forecast|next month|project|how much will i spend', q):
        ins = get_insights(txns, budgets, subs, bills, goals, accs)
        p = ins["predictions"]
        return {"text": f"Expected spend next month: {_money(p['nextMonthTotal'])}. This month on track for {_money(p['monthEndProjection'])}, projected savings {_money(p['projectedSavings'])}.\n\nPredicted categories:",
                "bars": _bars([{"name": c["name"], "value": c["predicted"]} for c in p["byCategory"]], p["nextMonthTotal"], 4)}

    # Subscriptions
    if re.search(r'subscri|netflix|spotify|amazon prime|renew|recurring payment', q):
        active = [s for s in subs if s.status == "active"]
        unused = [s for s in active if s.last_used_days >= 30]
        total = sum(sub_monthly(s) for s in active)
        lines = "\n".join(f"• {s.name} — {_money(s.amount)} (renews {_fmt_date(s.next_renewal)})" for s in active)
        note = f"\n\n⚠️ {', '.join(s.name for s in unused)} look unused — cancelling saves {_money(sum(sub_monthly(s) for s in unused)*12)}/year." if unused else "\n\nAll subscriptions actively used."
        return {"text": f"{len(active)} active subscriptions costing {_money(total)}/month.\n\n{lines}{note}"}

    # Budgets
    if re.search(r'budget|over.*limit|spending limit|am i within', q):
        rows = [{"name": b.category, "spent": next((c["mtd"] for c in cats if c["name"] == b.category), 0), "limit": b.limit_amount} for b in budgets if b.category != "Overall"]
        over = [r for r in rows if r["spent"] > r["limit"]]
        text = f"⚠️ Over budget in: {', '.join(r['name'] for r in over)}." if over else "✅ Within all budgets."
        return {"text": text + " Budget usage:",
                "bars": [{"label": f"{r['name']} ({_money(r['spent'])} / {_money(r['limit'])})", "emoji": _cat_meta(r["name"])["emoji"], "value": round(r["spent"]), "pct": round(r["spent"]/r["limit"]*100) if r["limit"] else 0, "color": "#ef4444" if r["spent"] > r["limit"] else _cat_meta(r["name"])["color"]} for r in rows[:6]]}

    # Bills
    if re.search(r'bill|due|overdue|upcoming payment|when.*pay', q):
        pending = sorted([b for b in bills if b.status != "paid"], key=lambda b: b.due_date)
        if not pending:
            return {"text": "No pending bills. 🎉"}
        lines = "\n".join(f"• {b.name} {_money(b.amount)} — due {_fmt_date(b.due_date)}{'  ⚠️ OVERDUE' if b.status == 'overdue' else ''}" for b in pending)
        return {"text": f"{len(pending)} unpaid bills totalling {_money(sum(b.amount for b in pending))}:\n\n{lines}"}

    # Goals
    if re.search(r'goal|target|saving for|milestone|how close am i', q):
        if not goals:
            return {"text": "No savings goals set yet. Go to Goals to create one!"}
        lines = "\n".join(f"{g.emoji} {g.name}: {_money(g.saved)} / {_money(g.target)} ({round(g.saved/g.target*100) if g.target else 0}%)" for g in goals)
        return {"text": f"Your savings goals:\n\n{lines}"}

    # Income
    if re.search(r'income|salary|earn|paycheck|total.*income', q):
        return {"text": f"This month earned {_money(cur['income'])}. 3-month avg income {_money(avg_income)}, avg savings {_money(avg_income - avg_expense)}/month."}

    # Balance
    if re.search(r'balance|net worth|how much.*have|account|\bcash\b|wallet|bank', q):
        total = sum(a.balance for a in accs)
        lines = "\n".join(f"• {a.name}: {_money(a.balance)}" for a in accs)
        return {"text": f"Net balance across {len(accs)} accounts: {_money(total)}.\n\n{lines}"}

    # Recent transactions
    if re.search(r'recent|latest|last.*transaction|what did i buy|show.*transaction', q):
        recent = sorted([t for t in txns if t.type == "expense"], key=lambda t: -t.date.timestamp())[:8]
        if not recent:
            return {"text": "No recent transactions found."}
        lines = "\n".join(f"• {t.merchant} — {_money(t.amount)} on {_fmt_date(t.date)} ({t.category})" for t in recent)
        return {"text": f"8 most recent expenses:\n\n{lines}"}

    # Spending / categories
    if re.search(r'spend|spent|expens|categor|most|highest|breakdown', q):
        if not cats:
            return {"text": "No expenses recorded this month yet."}
        top = cats[0]
        return {"text": f"Highest spending: {top['name']} with {_money(top['mtd'])} ({round(top['mtd']/total_mtd*100) if total_mtd else 0}% of total).\nTotal spent this month: {_money(total_mtd)}",
                "bars": _bars([{"name": c["name"], "value": c["mtd"]} for c in cats], total_mtd, 5)}

    # Health / summary
    if re.search(r'health|score|how am i doing|summary|overview|am i.*ok', q):
        ins = get_insights(txns, budgets, subs, bills, goals, accs)
        h = ins["health"]
        rate = round((avg_income - avg_expense) / avg_income * 100) if avg_income else 0
        return {"text": f"Financial health score: {h['score']}/100 ({h['label']}).\n\nThis month:\n• Earned: {_money(cur['income'])}\n• Spent: {_money(cur['expense'])}\n• Net: {_money(cur['income'] - cur['expense'])}\n\nAvg savings rate: {rate}%"}

    # Catch-all snapshot
    ins = get_insights(txns, budgets, subs, bills, goals, accs)
    return {
        "text": f"Here's your financial snapshot:\n\n💰 Earned: {_money(cur['income'])}\n💸 Spent: {_money(total_mtd)}\n🏦 Balance: {_money(sum(a.balance for a in accs))}\n📊 Health: {ins['health']['score']}/100\n\nAsk about spending, budgets, bills, goals, subscriptions, or predictions.",
        "bars": _bars([{"name": c["name"], "value": c["mtd"]} for c in cats], total_mtd, 5),
    }
