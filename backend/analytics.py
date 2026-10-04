"""Analytics engine — stats, month series, forecast, category stats."""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean as _mean
from typing import Any


MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def _mean_safe(lst: list[float]) -> float:
    return _mean(lst) if lst else 0.0


def _clamp(v: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, v))


def _ym(d: datetime) -> str:
    return f"{d.year}-{d.month:02d}"


def _dk(d: datetime) -> str:
    return f"{_ym(d)}-{d.day:02d}"


def month_series(txns: list, n: int) -> list[dict]:
    now = datetime.now()
    out = []
    for i in range(n - 1, -1, -1):
        month = (now.month - i - 1) % 12 + 1
        year = now.year - ((now.month - i - 1) // 12)
        out.append({"key": f"{year}-{month:02d}", "label": f"{MONTHS[month-1]} {str(year)[2:]}", "income": 0.0, "expense": 0.0, "net": 0.0})
    idx = {o["key"]: o for o in out}
    for t in txns:
        o = idx.get(_ym(t.date))
        if not o:
            continue
        if t.type == "income":
            o["income"] += t.amount
        else:
            o["expense"] += t.amount
    for o in out:
        o["net"] = o["income"] - o["expense"]
        o["income"] = round(o["income"])
        o["expense"] = round(o["expense"])
        o["net"] = round(o["net"])
    return out


def category_stats(txns: list) -> list[dict]:
    now = datetime.now()
    day = now.day
    cur_key = now.year * 12 + now.month
    data: dict[str, dict] = {}
    for t in txns:
        if t.type != "expense":
            continue
        diff = cur_key - (t.date.year * 12 + t.date.month)
        if diff < 0 or diff > 6:
            continue
        e = data.setdefault(t.category, {"mtd": 0.0, "prior": 0.0, "full": [0.0]*6})
        if diff == 0:
            e["mtd"] += t.amount
        else:
            e["full"][diff - 1] += t.amount
            if diff <= 3 and t.date.day <= day:
                e["prior"] += t.amount
    result = []
    for name, e in data.items():
        avg3 = sum(e["full"][:3]) / 3
        prev3 = sum(e["full"][3:6]) / 3
        result.append({"name": name, "mtd": e["mtd"], "prior_avg": e["prior"] / 3, "avg3": avg3, "prev3": prev3})
    return result


def forecast_series(monthly: list[dict]) -> dict:
    completed = monthly[:-1]
    last3 = [m["expense"] for m in completed[-3:]]
    prev3 = [m["expense"] for m in completed[-6:-3]]
    avg3 = _mean_safe(last3)
    slope = (avg3 - _mean_safe(prev3)) / 3 if prev3 else 0
    now = datetime.now()
    series = [{"label": m["label"], "actual": m["expense"]} for m in monthly[-7:-1]]
    if series:
        series[-1]["forecast"] = series[-1]["actual"]
    preds = []
    for i in range(1, 4):
        month = (now.month + i - 1) % 12 + 1
        year = now.year + (now.month + i - 1) // 12
        v = max(0, round(avg3 + slope * i))
        preds.append(v)
        series.append({"label": f"{MONTHS[month-1]} {str(year)[2:]}", "forecast": v})
    return {"series": series, "preds": preds, "avg3": avg3}


def get_stats(txns: list, accs: list, range_str: str = "30d", from_d: str | None = None, to_d: str | None = None) -> dict:
    now = datetime.now()
    now_end = now.replace(hour=23, minute=59, second=59, microsecond=999000)

    if range_str == "custom" and from_d and to_d:
        start = datetime.fromisoformat(from_d).replace(hour=0, minute=0, second=0, microsecond=0)
        end = datetime.fromisoformat(to_d).replace(hour=23, minute=59, second=59, microsecond=999000)
    else:
        days_map = {"7d": 7, "30d": 30, "3m": 90, "6m": 182, "1y": 365}
        span = days_map.get(range_str, 30)
        end = now_end
        start = (end - timedelta(days=span - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    days_count = max(1, round((end - start).total_seconds() / 86400))
    prev_end = start - timedelta(milliseconds=1)
    prev_start = start - timedelta(days=days_count)

    in_r = [t for t in txns if start <= t.date <= end]
    in_p = [t for t in txns if prev_start <= t.date <= prev_end]
    exp = [t for t in in_r if t.type == "expense"]
    inc = [t for t in in_r if t.type == "income"]
    income = sum(t.amount for t in inc)
    expense = sum(t.amount for t in exp)
    prev_inc = sum(t.amount for t in in_p if t.type == "income")
    prev_exp = sum(t.amount for t in in_p if t.type == "expense")
    net = income - expense
    prev_net = prev_inc - prev_exp

    def delta(cur: float, prev: float) -> float | None:
        return ((cur - prev) / prev * 100) if prev > 0 else None

    largest = max(exp, key=lambda t: t.amount, default=None)

    # Trend buckets
    if days_count <= 31:
        mode = "day"
    elif days_count <= 100:
        mode = "week"
    else:
        mode = "month"

    buckets: dict[str, dict] = {}
    d = start
    while d <= end:
        if mode == "day":
            key = _dk(d)
            label = f"{d.day} {MONTHS[d.month-1]}"
        elif mode == "week":
            week_start = d - timedelta(days=(d.weekday()))
            key = _dk(week_start)
            label = f"{week_start.day} {MONTHS[week_start.month-1]}"
        else:
            key = _ym(d)
            label = f"{MONTHS[d.month-1]} {str(d.year)[2:]}"
        if key not in buckets:
            buckets[key] = {"label": label, "date": d.isoformat(), "expense": 0.0, "income": 0.0}
        d += timedelta(days=1)

    for t in in_r:
        if mode == "day":
            key = _dk(t.date)
        elif mode == "week":
            ws = t.date - timedelta(days=t.date.weekday())
            key = _dk(ws)
        else:
            key = _ym(t.date)
        if key in buckets:
            if t.type == "expense":
                buckets[key]["expense"] += t.amount
            else:
                buckets[key]["income"] += t.amount

    trend = [{"label": v["label"], "date": v["date"], "expense": round(v["expense"]), "income": round(v["income"])} for v in buckets.values()]

    # Categories
    cat: dict[str, dict] = {}
    for t in exp:
        c = cat.setdefault(t.category, {"value": 0.0, "count": 0, "prev": 0.0})
        c["value"] += t.amount
        c["count"] += 1
    for t in [x for x in in_p if x.type == "expense"]:
        c = cat.setdefault(t.category, {"value": 0.0, "count": 0, "prev": 0.0})
        c["prev"] += t.amount
    categories = sorted([
        {"name": n, "value": round(v["value"]), "count": v["count"], "prev": round(v["prev"]),
         "pct": v["value"] / expense * 100 if expense else 0}
        for n, v in cat.items() if v["value"] > 0
    ], key=lambda x: -x["value"])

    # Merchants
    mer: dict[str, dict] = {}
    for t in exp:
        m = mer.setdefault(t.merchant, {"total": 0.0, "count": 0, "cats": defaultdict(int)})
        m["total"] += t.amount
        m["count"] += 1
        m["cats"][t.category] += 1
    merchants = sorted([
        {"name": n, "total": round(m["total"]), "count": m["count"],
         "avg": round(m["total"] / m["count"]),
         "category": max(m["cats"], key=lambda k: m["cats"][k])}
        for n, m in mer.items()
    ], key=lambda x: -x["total"])[:15]

    # Weekday
    wd = [{"day": d, "total": 0.0} for d in ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]]
    for t in exp:
        wd[t.date.weekday()]["total"] += t.amount
    weeks = max(1, -(-days_count // 7))  # ceil, mirrors JS Math.ceil(days / 7)
    weekday = [{"day": w["day"], "total": round(w["total"]), "avg": round(w["total"] / weeks)} for w in wd]

    # Heatmap
    today = now.date()
    mon = today - timedelta(days=today.weekday())
    h_start = mon - timedelta(weeks=11)
    hm: dict[str, float] = {}
    for t in txns:
        if t.type == "expense" and t.date.date() >= h_start:
            hm[_dk(t.date)] = hm.get(_dk(t.date), 0) + t.amount
    heatmap = []
    for i in range(84):
        d = datetime.combine(h_start + timedelta(days=i), datetime.min.time())
        heatmap.append({"date": d.isoformat(), "amount": -1 if d.date() > today else round(hm.get(_dk(d), 0))})

    monthly = month_series(txns, 12)
    yr: dict[str, dict] = {}
    for t in txns:
        y = str(t.date.year)
        o = yr.setdefault(y, {"income": 0.0, "expense": 0.0})
        if t.type == "income":
            o["income"] += t.amount
        else:
            o["expense"] += t.amount
    yearly = [{"year": y, "income": round(v["income"]), "expense": round(v["expense"]), "net": round(v["income"] - v["expense"])} for y, v in sorted(yr.items())]

    cur = monthly[-1]
    last = monthly[-2] if len(monthly) >= 2 else {"expense": 0}
    dim = (datetime(now.year, now.month % 12 + 1, 1) - timedelta(days=1)).day
    per_day = cur["expense"] / max(1, now.day)
    velocity = {
        "spentMtd": round(cur["expense"]),
        "perDay": round(per_day),
        "projected": round(per_day * dim),
        "daysLeft": dim - now.day,
        "lastMonth": round(last["expense"]),
        "vsLastMonth": delta(per_day * dim, last["expense"]),
    }

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat(), "days": days_count},
        "balance": round(sum(a.balance for a in accs)),
        "totals": {
            "income": round(income), "expense": round(expense), "net": round(net),
            "savingsRate": (net / income * 100) if income else 0,
            "count": len(in_r), "avg": round(expense / len(exp)) if exp else 0,
            "largest": {"merchant": largest.merchant, "amount": largest.amount, "date": largest.date.isoformat()} if largest else None,
            "prevIncome": round(prev_inc), "prevExpense": round(prev_exp),
            "incomeDelta": delta(income, prev_inc), "expenseDelta": delta(expense, prev_exp),
            "netDelta": ((net - prev_net) / abs(prev_net) * 100) if prev_net else None,
        },
        "trend": trend, "categories": categories, "merchants": merchants,
        "weekday": weekday, "heatmap": heatmap,
        "monthly": monthly, "yearly": yearly, "velocity": velocity,
        "forecast": forecast_series(monthly)["series"],
    }
