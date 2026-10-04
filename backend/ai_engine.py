"""AI insights engine — health score, insights, predictions, advice."""
from __future__ import annotations
from datetime import datetime, timedelta
from analytics import month_series, category_stats, forecast_series, _mean_safe, _clamp


def _money(v: float) -> str:
    return f"₹{v:,.0f}"


def _delta(cur: float, prev: float):
    return ((cur - prev) / prev * 100) if prev > 0 else None


def sub_monthly(sub) -> float:
    if sub.cycle == "yearly":
        return sub.amount / 12
    if sub.cycle == "weekly":
        return sub.amount * 4.33
    return sub.amount


def get_insights(txns: list, budgets: list, subs: list, bills: list, goals: list, accs: list) -> dict:
    now = datetime.now()
    monthly = month_series(txns, 13)
    completed = monthly[:-1]
    cur = monthly[-1]
    avg_income = _mean_safe([m["income"] for m in completed[-3:]])
    avg_expense = _mean_safe([m["expense"] for m in completed[-3:]])
    cats = category_stats(txns)
    active_subs = [s for s in subs if s.status == "active"]
    sub_cost = sum(sub_monthly(s) for s in active_subs)

    # ── Health score ──────────────────────────────────────────────────────────
    savings_rate = (avg_income - avg_expense) / avg_income if avg_income > 0 else 0
    cat_budgets = [b for b in budgets if b.category != "Overall"]
    cat_map = {c["name"]: c["mtd"] for c in cats}
    budget_scores = []
    for b in cat_budgets:
        spent = cat_map.get(b.category, 0)
        r = spent / b.limit_amount if b.limit_amount else 0
        score = 100 - max(0, (r - 0.75) * 100) if r <= 1 else max(0, 60 - (r - 1) * 200)
        budget_scores.append(score)

    exps = [m["expense"] for m in completed[-6:]]
    m_val = _mean_safe(exps)
    cv = ((sum((x - m_val) ** 2 for x in exps) / len(exps)) ** 0.5 / m_val) if m_val and exps else 0
    sub_ratio = sub_cost / avg_income if avg_income > 0 else 0
    overdue_count = sum(1 for b in bills if b.status == "overdue")
    liquid = sum(a.balance for a in accs if a.type != "card")
    emergency_months = liquid / avg_expense if avg_expense > 0 else 0

    components = [
        {"key": "savings", "label": "Savings rate", "score": round(_clamp((savings_rate / 0.3) * 100)), "weight": 0.25, "detail": f"{savings_rate*100:.0f}% of income saved (target 30%)"},
        {"key": "budget", "label": "Budget adherence", "score": round(_clamp(_mean_safe(budget_scores) if budget_scores else 80)), "weight": 0.2, "detail": f"{sum(1 for s in budget_scores if s >= 60)}/{len(budget_scores)} budgets on track"},
        {"key": "stability", "label": "Spending stability", "score": round(_clamp(100 - cv * 250)), "weight": 0.15, "detail": f"Monthly spending varies {cv*100:.0f}%"},
        {"key": "subs", "label": "Subscription load", "score": round(_clamp(100 - (sub_ratio - 0.03) * 1000)), "weight": 0.1, "detail": f"{_money(sub_cost)}/mo · {sub_ratio*100:.1f}% of income"},
        {"key": "bills", "label": "Bill discipline", "score": round(_clamp(100 - overdue_count * 30)), "weight": 0.1, "detail": f"{overdue_count} overdue bill(s)" if overdue_count else "No overdue bills"},
        {"key": "emergency", "label": "Emergency fund", "score": round(_clamp((emergency_months / 6) * 100)), "weight": 0.2, "detail": f"{emergency_months:.1f} months of expenses in liquid cash"},
    ]
    score = round(sum(c["score"] * c["weight"] for c in components))
    label = "Excellent" if score >= 80 else "Good" if score >= 65 else "Fair" if score >= 50 else "Needs attention"

    # ── Insights ──────────────────────────────────────────────────────────────
    insights = []
    roll: dict[str, list] = {}
    for t in txns:
        if t.type != "expense":
            continue
        age = (now - t.date).days
        w = age // 30 if 0 <= age // 30 <= 2 else -1
        if w < 0:
            continue
        e = roll.setdefault(t.category, [0.0, 0.0, 0.0])
        e[w] += t.amount

    for name, windows in roll.items():
        cur_w, p1, p2 = windows[0], windows[1] if len(windows) > 1 else 0, windows[2] if len(windows) > 2 else 0
        base = (p1 + p2) / 2
        ch = _delta(cur_w, base)
        if ch and ch > 12 and cur_w > 1500:
            insights.append({"id": f"cat-{name}", "type": "warning", "title": f"{name} spending is up {ch:.0f}%", "body": f"Your {name.lower()} spending increased {ch:.0f}% over the last 30 days ({_money(cur_w)} vs {_money(base)}).", "href": "/analytics/categories"})
        if ch and ch < -20 and base > 1500:
            insights.append({"id": f"catdown-{name}", "type": "success", "title": f"{name} spending down {abs(ch):.0f}%", "body": f"Nice! You're spending less on {name.lower()} than usual.", "href": "/analytics/categories"})

    for b in cat_budgets:
        spent = cat_map.get(b.category, 0)
        if spent > b.limit_amount:
            insights.append({"id": f"bud-{b.id}", "type": "alert", "title": f"{b.category} budget exceeded", "body": f"You've spent {_money(spent)} against a {_money(b.limit_amount)} budget ({_money(spent - b.limit_amount)} over).", "href": "/budgets"})
        elif spent > b.limit_amount * 0.85:
            insights.append({"id": f"budw-{b.id}", "type": "warning", "title": f"{b.category} budget nearly used", "body": f"{spent/b.limit_amount*100:.0f}% of your {b.category} budget is gone.", "href": "/budgets"})

    unused = [s for s in active_subs if s.last_used_days >= 30]
    if unused:
        save = sum(sub_monthly(s) for s in unused) * 12
        insights.append({"id": "subs-unused", "type": "warning", "title": f"{len(unused)} subscription(s) may be unused", "body": f"{', '.join(s.name for s in unused)} — not used in 30+ days. Cancelling could save {_money(save)}/year.", "href": "/subscriptions"})

    for x in [s for s in active_subs if s.price_change_pct > 0]:
        insights.append({"id": f"price-{x.id}", "type": "info", "title": f"{x.name} price increased {x.price_change_pct:.0f}%", "body": f"Now {_money(x.amount)}/mo. Consider a cheaper plan.", "href": f"/subscriptions/{x.id}"})

    soon = [b for b in bills if b.status != "paid" and -1 <= (b.due_date - now).days <= 7]
    if soon:
        insights.append({"id": "bills-soon", "type": "info", "title": f"{len(soon)} bill(s) due this week", "body": ", ".join(f"{b.name} ({_money(b.amount)})" for b in soon) + ".", "href": "/bills"})
    if overdue_count:
        insights.append({"id": "bills-overdue", "type": "alert", "title": f"{overdue_count} overdue bill(s)", "body": "Pay soon to avoid late fees.", "href": "/bills"})

    risky = [t for t in txns if t.risk in ("high", "medium")]
    if risky:
        top = max(risky, key=lambda t: t.amount)
        insights.append({"id": "risk", "type": "alert", "title": f"{len(risky)} suspicious transaction(s) flagged", "body": f"Largest: {top.merchant} {_money(top.amount)}. Review in Security Center.", "href": "/ai/anomalies"})

    if savings_rate >= 0.3:
        insights.append({"id": "sr-good", "type": "success", "title": "Great savings rate", "body": f"You're saving {savings_rate*100:.0f}% of your income — above the 30% benchmark."})
    else:
        insights.append({"id": "sr-low", "type": "tip", "title": "Boost your savings rate", "body": f"You save {savings_rate*100:.0f}% of income. Trimming {_money(avg_income*0.3 - (avg_income-avg_expense))}/month would hit the 30% benchmark."})

    order = {"alert": 0, "warning": 1, "info": 2, "tip": 3, "success": 4}
    insights.sort(key=lambda x: order.get(x["type"], 5))
    insights = insights[:14]

    # ── Predictions ───────────────────────────────────────────────────────────
    f = forecast_series(monthly)
    raw = [{"name": c["name"], "average": c["avg3"], "predicted": max(0, c["avg3"] + (c["avg3"] - c["prev3"]) / 3)} for c in cats if c["avg3"] > 0]
    raw_sum = sum(r["predicted"] for r in raw) or 1
    factor = f["preds"][0] / raw_sum if f["preds"] else 1
    by_category = sorted([
        {"name": r["name"], "predicted": round(r["predicted"] * factor), "average": round(r["average"]),
         "change": _delta(round(r["predicted"] * factor), r["average"]) or 0}
        for r in raw
    ], key=lambda x: -x["predicted"])
    dim = (datetime(now.year, now.month % 12 + 1, 1) - timedelta(days=1)).day
    month_end = (cur["expense"] / max(1, now.day)) * dim

    # ── Advice ────────────────────────────────────────────────────────────────
    surplus = avg_income - avg_expense
    advice = [
        {"id": "5030", "title": "Follow the 50/30/20 rule", "body": f"With {_money(avg_income)} monthly income: {_money(avg_income*0.5)} needs, {_money(avg_income*0.3)} wants, {_money(avg_income*0.2)} savings.", "impact": "Framework", "icon": "📐"},
    ]
    if emergency_months < 6:
        monthly_contrib = max(2000, surplus * 0.4)
        advice.append({"id": "ef", "title": "Build your emergency fund", "body": f"You hold {emergency_months:.1f} months of expenses. Target 6 months ({_money(avg_expense*6)}). Auto-transfer {_money(monthly_contrib)}/month.", "impact": f"+{_money(monthly_contrib*12)}/yr", "icon": "🛟"})
    if surplus > 5000:
        sip = round(surplus * 0.5 / 500) * 500
        fv = sip * ((1.01 ** 120 - 1) / 0.01) * 1.01
        advice.append({"id": "sip", "title": "Put your surplus to work", "body": f"A SIP of {_money(sip)}/month could grow to ~{_money(round(fv/1000)*1000)} in 10 years at 12% p.a. (illustrative).", "impact": "Wealth", "icon": "📈"})
    if cats:
        top_cat = max(cats, key=lambda c: c["avg3"])
        advice.append({"id": "top", "title": f"Trim {top_cat['name']} by 10%", "body": f"{top_cat['name']} is your biggest category at ~{_money(top_cat['avg3'])}/month. A 10% cut saves {_money(top_cat['avg3']*0.1*12)}/year.", "impact": f"+{_money(top_cat['avg3']*0.1*12)}/yr", "icon": "✂️"})
    if unused:
        save = sum(sub_monthly(s) for s in unused) * 12
        advice.append({"id": "subs", "title": "Cancel unused subscriptions", "body": f"{' & '.join(s.name for s in unused)} haven't been used recently.", "impact": f"+{_money(save)}/yr", "icon": "🔄"})
    for g in goals[:2]:
        months_left = max(1, round((g.deadline - now).days / 30))
        needed = max(0, (g.target - g.saved) / months_left)
        pct = round(g.saved / g.target * 100) if g.target else 0
        advice.append({"id": f"goal-{g.id}", "title": f"{g.name}: save {_money(needed)}/month", "body": f"{_money(g.target - g.saved)} remaining with {months_left} months to go.", "impact": f"{pct}% done", "icon": g.emoji})

    return {
        "health": {"score": score, "label": label, "components": components},
        "insights": insights,
        "predictions": {
            "nextMonthTotal": f["preds"][0] if f["preds"] else 0,
            "monthEndProjection": round(month_end),
            "projectedSavings": round(avg_income - (f["preds"][0] if f["preds"] else 0)),
            "avgIncome": round(avg_income),
            "avgExpense": round(avg_expense),
            "byCategory": by_category,
            "series": f["series"],
        },
        "advice": advice,
    }
