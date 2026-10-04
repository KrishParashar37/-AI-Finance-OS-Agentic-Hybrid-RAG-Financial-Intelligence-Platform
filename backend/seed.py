"""Demo data seeder — same 14-month dataset as JS seed.ts."""
from __future__ import annotations
import random
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    Account, Transaction, Budget, Subscription, Bill, Invoice,
    Goal, Group, SharedExpense, Settlement, Scan, Report,
    Notification, ActivityLog, Setting,
)

DEFAULT_SETTINGS = {
    "profile": {"name": "Krish", "email": "krish@example.com", "phone": "+91 98765 43210", "bio": "Building healthy money habits.", "monthlyIncomeTarget": 70000},
    "preferences": {"currency": "INR", "language": "en", "dateFormat": "DD MMM YYYY", "weekStart": "monday", "autoCategorize": True},
    "appearance": {"theme": "system", "accent": "indigo", "density": "comfortable", "animations": True},
    "notifications": {"email": True, "push": True, "budgetAlerts": True, "billReminders": True, "anomalyAlerts": True, "weeklyDigest": False, "aiInsights": True},
    "privacy": {"hideBalances": False, "analytics": True, "shareAnonymousData": False},
    "security": {"twoFactor": False, "loginAlerts": True},
    "connectedApps": {"gmail": True, "googleDrive": False, "hdfc": True, "paytm": False, "zerodha": False, "slack": False},
}

MERCHANTS = [
    {"m": "Amazon",        "c": "Shopping",       "min": 499,  "max": 4200, "pay": "Credit Card", "w": 3},
    {"m": "Flipkart",      "c": "Shopping",       "min": 399,  "max": 3500, "pay": "UPI",         "w": 2},
    {"m": "Myntra",        "c": "Shopping",       "min": 699,  "max": 3200, "pay": "Credit Card", "w": 1},
    {"m": "Zomato",        "c": "Food",           "min": 180,  "max": 720,  "pay": "UPI",         "w": 5},
    {"m": "Swiggy",        "c": "Food",           "min": 160,  "max": 680,  "pay": "UPI",         "w": 4},
    {"m": "Starbucks",     "c": "Food",           "min": 250,  "max": 620,  "pay": "Debit Card",  "w": 2},
    {"m": "Uber",          "c": "Transport",      "min": 120,  "max": 560,  "pay": "UPI",         "w": 4},
    {"m": "Ola",           "c": "Transport",      "min": 90,   "max": 420,  "pay": "UPI",         "w": 2},
    {"m": "HP Petrol Pump","c": "Transport",      "min": 800,  "max": 2200, "pay": "Debit Card",  "w": 1},
    {"m": "BigBasket",     "c": "Groceries",      "min": 450,  "max": 2400, "pay": "UPI",         "w": 3},
    {"m": "DMart",         "c": "Groceries",      "min": 600,  "max": 2800, "pay": "Debit Card",  "w": 2},
    {"m": "PVR Cinemas",   "c": "Entertainment",  "min": 380,  "max": 1300, "pay": "Credit Card", "w": 1.5},
    {"m": "BookMyShow",    "c": "Entertainment",  "min": 300,  "max": 1100, "pay": "UPI",         "w": 1},
    {"m": "Apollo Pharmacy","c":"Health",         "min": 150,  "max": 1400, "pay": "UPI",         "w": 1.5},
    {"m": "Udemy",         "c": "Education",      "min": 449,  "max": 1299, "pay": "Credit Card", "w": 0.4},
    {"m": "MakeMyTrip",    "c": "Travel",         "min": 2500, "max": 9000, "pay": "Credit Card", "w": 0.3},
]

TAX_RATE = {"Shopping": 0.18, "Entertainment": 0.18, "Bills": 0.18, "Food": 0.05, "Education": 0.18, "Travel": 0.05}

def _tax(cat: str, amt: float) -> float:
    rate = TAX_RATE.get(cat, 0)
    return round((amt * rate) / (1 + rate))

def _days_ago(n: int, h: int = 14) -> datetime:
    now = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return now - timedelta(days=n) + timedelta(hours=h)

def _in_days(n: int) -> datetime:
    return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=n)


# Tables truncated by clear_all — mirrors the JS clearAll() TABLES list.
ALL_TABLES = [
    "transactions", "accounts", "budgets", "subscriptions", "bills",
    "invoices", "goals", "groups", "shared_expenses", "settlements",
    "scans", "reports", "notifications", "activity_log",
]


async def clear_all(db: AsyncSession, keep_settings: bool = True) -> None:
    """Truncate every data table (settings preserved by default).

    Mirrors JS clearAll(): disables FK checks, truncates each table, re-enables.
    """
    await db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    for table in ALL_TABLES:
        await db.execute(text(f"TRUNCATE TABLE `{table}`"))
    await db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    if not keep_settings:
        await db.execute(text("DELETE FROM `settings`"))
    await db.commit()


async def seed_all(db: AsyncSession) -> None:
    rng = random.Random(42)
    now = datetime.now()
    today0 = now.replace(hour=0, minute=0, second=0, microsecond=0)

    def mk(year: int, month: int, day: int, hour: int = 14) -> datetime:
        try:
            return datetime(year, month, min(day, 28), hour, rng.randint(0, 59))
        except ValueError:
            return datetime(year, month, 1, hour, rng.randint(0, 59))

    # ── Accounts ──────────────────────────────────────────────────────────────
    acc_data = [
        Account(name="HDFC Savings",         type="bank",   institution="HDFC Bank",         last4="4821", balance=38450,  color="#1d4ed8"),
        Account(name="SBI Salary",            type="bank",   institution="State Bank of India",last4="7710", balance=6830,   color="#0ea5e9"),
        Account(name="HDFC Regalia Card",     type="card",   institution="HDFC Bank",         last4="9034", balance=-14200, credit_limit=150000, color="#7c3aed"),
        Account(name="Amazon Pay ICICI",      type="card",   institution="ICICI Bank",        last4="3356", balance=-6300,  credit_limit=100000, color="#f97316"),
        Account(name="Paytm Wallet",          type="wallet", institution="Paytm",             last4="",     balance=1250,   color="#0284c7"),
        Account(name="Amazon Pay Balance",    type="wallet", institution="Amazon",            last4="",     balance=780,    color="#f59e0b"),
    ]
    db.add_all(acc_data)
    await db.flush()
    bank_id = acc_data[0].id
    card_id = acc_data[2].id

    def acc_for(pay: str) -> int | None:
        return card_id if pay == "Credit Card" else (bank_id if pay != "Cash" else None)

    total_w = sum(m["w"] for m in MERCHANTS)

    def pick_merchant() -> dict:
        x = rng.random() * total_w
        for m in MERCHANTS:
            x -= m["w"]
            if x <= 0:
                return m
        return MERCHANTS[0]

    # ── Transactions (14 months) ───────────────────────────────────────────────
    rows: list[Transaction] = []
    for back in range(13, -1, -1):
        base_month = (now.month - back - 1) % 12 + 1
        base_year  = now.year - ((now.month - back - 1) // 12)
        import calendar
        dim = calendar.monthrange(base_year, base_month)[1]
        max_day = now.day if back == 0 else dim

        # Income
        rows.append(Transaction(type="income", merchant="Acme Technologies Pvt Ltd", category="Salary", amount=62000,
            date=mk(base_year, base_month, 1, 10), payment_method="Net Banking", recurring=True, source="import", account_id=bank_id))
        if rng.random() < 0.6:
            d = min(max_day, 5 + rng.randint(0, 18))
            rows.append(Transaction(type="income", merchant="Pixel Studio Client", category="Freelance",
                amount=8000 + round(rng.random() * 10) * 1000, date=mk(base_year, base_month, d),
                payment_method="UPI", source="manual", account_id=bank_id))
        if rng.random() < 0.35:
            d = min(max_day, 10 + rng.randint(0, 10))
            rows.append(Transaction(type="income", merchant="Zerodha Dividend", category="Investments",
                amount=800 + round(rng.random() * 17) * 100, date=mk(base_year, base_month, d),
                payment_method="Net Banking", source="import", account_id=bank_id))

        # Fixed monthly expenses
        fixed = [
            ("Netflix",              "Subscriptions", 12, 649,  "Credit Card", card_id),
            ("Spotify",              "Subscriptions",  5, 119,  "Credit Card", card_id),
            ("Adobe Creative Cloud", "Subscriptions", 18, 1675 if back == 0 else 1496, "Credit Card", card_id),
            ("ChatGPT Plus",         "Subscriptions", 25, 1999, "Credit Card", card_id),
            ("Airtel Broadband",     "Bills",         10, 999,  "UPI",         bank_id),
            ("Jio Mobile",           "Bills",          3, 349,  "UPI",         bank_id),
            ("Electricity Board",    "Bills",          8, 1500 + round(rng.random() * 9) * 100, "UPI", bank_id),
        ]
        for merchant, cat, day, amount, pay, acc_id in fixed:
            if day > max_day:
                continue
            rows.append(Transaction(type="expense", merchant=merchant, category=cat, amount=amount,
                tax=_tax(cat, amount), date=mk(base_year, base_month, day),
                payment_method=pay, recurring=True, source="import", account_id=acc_id))

        # Variable expenses
        n_base = 15 + rng.randint(0, 8)
        n = max(4, round(n_base * max_day / dim)) if back == 0 else n_base
        for _ in range(n):
            m = pick_merchant()
            amount = round(m["min"] + rng.random() * (m["max"] - m["min"]))
            d = min(max_day, 1 + rng.randint(0, max_day - 1))
            rows.append(Transaction(type="expense", merchant=m["m"], category=m["c"], amount=amount,
                tax=_tax(m["c"], amount), date=mk(base_year, base_month, d, 9 + rng.randint(0, 12)),
                payment_method=m["pay"], source="scan" if rng.random() < 0.25 else "manual",
                account_id=acc_for(m["pay"])))

    # Anomaly rows
    rows += [
        Transaction(type="expense", merchant="Amazon",       category="Shopping", amount=24999, tax=_tax("Shopping",24999), date=_days_ago(2,23), payment_method="Credit Card", account_id=card_id, risk="high",   risk_reason="Amount is 9.0× your typical Shopping purchase"),
        Transaction(type="expense", merchant="Unknown ATM",  category="Other",    amount=8000,  date=_days_ago(3, 2),       payment_method="Cash",                               risk="medium", risk_reason="Cash withdrawal at an unrecognised ATM at an unusual hour"),
        Transaction(type="expense", merchant="CryptoXchange",category="Other",    amount=5000,  date=_days_ago(4, 1),       payment_method="UPI", account_id=bank_id,           risk="medium", risk_reason="First-time merchant with a large amount"),
        Transaction(type="expense", merchant="Zomato",       category="Food",     amount=449,   tax=_tax("Food",449), date=_days_ago(1,20), payment_method="UPI", account_id=bank_id, risk_reason="Duplicate: same merchant & amount within 24h"),
        Transaction(type="expense", merchant="Zomato",       category="Food",     amount=449,   tax=_tax("Food",449), date=_days_ago(1,20), payment_method="UPI", account_id=bank_id, risk_reason="Duplicate: same merchant & amount within 24h"),
        Transaction(type="expense", merchant="Barbeque Nation",category="Food",   amount=1200,  tax=_tax("Food",1200), date=_days_ago(5,21), payment_method="Credit Card", account_id=card_id),
    ]

    # Insert transactions in batches
    for i in range(0, len(rows), 200):
        db.add_all(rows[i:i+200])
    await db.flush()

    # ── Budgets ───────────────────────────────────────────────────────────────
    db.add_all([
        Budget(category="Overall",       limit_amount=40000),
        Budget(category="Food",          limit_amount=5000),
        Budget(category="Shopping",      limit_amount=10000),
        Budget(category="Transport",     limit_amount=4000),
        Budget(category="Entertainment", limit_amount=3000),
        Budget(category="Groceries",     limit_amount=6000),
        Budget(category="Bills",         limit_amount=4000),
        Budget(category="Health",        limit_amount=2000),
    ])

    # ── Subscriptions ─────────────────────────────────────────────────────────
    def next_on(day: int) -> datetime:
        d = today0.replace(day=min(day, 28))
        if d >= today0:
            return d
        # Roll to next month, handling December -> January year rollover
        new_month = d.month + 1
        new_year = d.year
        if new_month > 12:
            new_month = 1
            new_year += 1
        return d.replace(year=new_year, month=new_month)

    db.add_all([
        Subscription(name="Netflix",              emoji="🎬", amount=649,  next_renewal=next_on(12), last_used_days=38),
        Subscription(name="Spotify",              emoji="🎧", amount=119,  next_renewal=next_on(5),  last_used_days=1),
        Subscription(name="Adobe Creative Cloud", emoji="🎨", amount=1675, next_renewal=next_on(18), last_used_days=47, price_change_pct=12),
        Subscription(name="ChatGPT Plus",         emoji="🤖", amount=1999, next_renewal=next_on(25), last_used_days=0),
        Subscription(name="YouTube Premium",      emoji="▶️", amount=149,  next_renewal=next_on(20), last_used_days=9, status="paused"),
    ])

    # ── Bills ─────────────────────────────────────────────────────────────────
    db.add_all([
        Bill(name="Electricity Bill",   amount=1840,  due_date=_in_days(4),   category="Bills",  autopay=False),
        Bill(name="HDFC Credit Card",   amount=14200, due_date=_in_days(6),   category="Bills",  autopay=False),
        Bill(name="Airtel Broadband",   amount=999,   due_date=_in_days(9),   category="Bills",  autopay=True),
        Bill(name="Jio Mobile",         amount=349,   due_date=_in_days(14),  category="Bills",  autopay=True),
        Bill(name="LIC Insurance Premium",amount=6200,due_date=_in_days(21),  category="Health", autopay=False),
        Bill(name="Water Bill",         amount=420,   due_date=_in_days(-3),  status="overdue",  category="Bills"),
        Bill(name="Society Maintenance",amount=2500,  due_date=_in_days(-10), status="paid",     category="Bills"),
    ])

    # ── Invoices ──────────────────────────────────────────────────────────────
    db.add_all([
        Invoice(number="INV-2026-0142", party="Adobe Systems",       kind="payable",    amount=1675,  tax=256,  issue_date=_days_ago(12), due_date=_in_days(6),  status="pending"),
        Invoice(number="INV-2026-0098", party="Pixel Studio Client", kind="receivable", amount=18000, tax=2746, issue_date=_days_ago(20), due_date=_in_days(10), status="pending"),
        Invoice(number="INV-2026-0075", party="Acme Design Studio",  kind="receivable", amount=12000, tax=1831, issue_date=_days_ago(45), due_date=_days_ago(15),status="overdue"),
        Invoice(number="INV-2026-0031", party="AWS India",           kind="payable",    amount=3240,  tax=494,  issue_date=_days_ago(60), due_date=_days_ago(30),status="paid"),
    ])

    # ── Goals ─────────────────────────────────────────────────────────────────
    db.add_all([
        Goal(name="Emergency Fund", emoji="🛟", target=150000, saved=62000,  deadline=_in_days(300)),
        Goal(name="Goa Trip",       emoji="🏖️", target=40000,  saved=18500,  deadline=_in_days(120)),
        Goal(name="New Laptop",     emoji="💻", target=90000,  saved=41000,  deadline=_in_days(200)),
        Goal(name="Bike Down Payment",emoji="🏍️",target=60000, saved=9000,   deadline=_in_days(400)),
    ])
    await db.flush()

    # ── Groups + shared expenses ───────────────────────────────────────────────
    g1 = Group(name="Goa Trip",    emoji="🏖️", members=["You","Aarav","Meera","Rohan"])
    g2 = Group(name="Flatmates",   emoji="🏠", members=["You","Karan","Ishaan"])
    g3 = Group(name="Office Lunch",emoji="🍱", members=["You","Neha","Vikram"])
    db.add_all([g1, g2, g3])
    await db.flush()

    db.add_all([
        SharedExpense(group_id=g1.id, title="Hotel booking",    amount=18000, paid_by="You",  split_with=["You","Aarav","Meera","Rohan"], date=_days_ago(14)),
        SharedExpense(group_id=g1.id, title="Flights",          amount=24000, paid_by="Aarav",split_with=["You","Aarav","Meera","Rohan"], date=_days_ago(20)),
        SharedExpense(group_id=g1.id, title="Scooter rental",   amount=3200,  paid_by="Meera",split_with=["You","Aarav","Meera","Rohan"], date=_days_ago(9)),
        SharedExpense(group_id=g1.id, title="Beach shack dinner",amount=4800, paid_by="Rohan",split_with=["You","Aarav","Meera","Rohan"], date=_days_ago(8)),
        SharedExpense(group_id=g2.id, title="Wi-Fi",            amount=1200,  paid_by="You",  split_with=["You","Karan","Ishaan"],        date=_days_ago(6)),
        SharedExpense(group_id=g2.id, title="Groceries",        amount=2400,  paid_by="Karan",split_with=["You","Karan","Ishaan"],        date=_days_ago(4)),
        SharedExpense(group_id=g2.id, title="Electricity",      amount=3600,  paid_by="Ishaan",split_with=["You","Karan","Ishaan"],       date=_days_ago(2)),
        SharedExpense(group_id=g3.id, title="Team lunch",       amount=1800,  paid_by="Neha", split_with=["You","Neha","Vikram"],         date=_days_ago(3)),
        SharedExpense(group_id=g3.id, title="Coffee run",       amount=540,   paid_by="You",  split_with=["You","Neha","Vikram"],         date=_days_ago(1)),
    ])
    db.add(Settlement(group_id=g1.id, from_user="Rohan", to_user="You", amount=1500, date=_days_ago(5)))

    # ── Scans ─────────────────────────────────────────────────────────────────
    db.add_all([
        Scan(file_name="amazon-order.jpg",  file_size=184000, merchant="Amazon", date=_days_ago(6), total=2499, tax=381, category="Shopping", payment_method="UPI",         confidence=97, status="saved",      items=[{"name":"Wireless Mouse","qty":1,"price":1299},{"name":"USB-C Cable","qty":2,"price":600}]),
        Scan(file_name="zomato-invoice.png",file_size=96000,  merchant="Zomato", date=_days_ago(3), total=480,  tax=23,  category="Food",     payment_method="UPI",         confidence=94, status="saved",      items=[{"name":"Paneer Tikka Bowl","qty":1,"price":320},{"name":"Cold Coffee","qty":1,"price":137}]),
        Scan(file_name="dmart-bill.pdf",    file_size=220000, merchant="DMart",  date=_days_ago(1), total=1860, tax=142, category="Groceries",payment_method="Debit Card",  confidence=91, status="processed",  items=[{"name":"Groceries","qty":12,"price":1718}]),
    ])

    # ── Reports ───────────────────────────────────────────────────────────────
    db.add_all([
        Report(type="monthly", format="pdf",  range_start=datetime(now.year if now.month > 1 else now.year - 1, now.month - 1 if now.month > 1 else 12, 1), range_end=today0 - timedelta(days=1), row_count=48, created_at=_days_ago(9)),
        Report(type="tax",     format="xlsx", range_start=datetime(now.year, 1, 1),                                  range_end=today0,                      row_count=210,created_at=_days_ago(20)),
    ])

    # ── Notifications ─────────────────────────────────────────────────────────
    db.add_all([
        Notification(title="High-risk transaction detected", body="Amazon ₹24,999 looks unusual.", type="alert",   created_at=_days_ago(2, 23)),
        Notification(title="Entertainment budget exceeded",  body="You've crossed your Entertainment budget.", type="warning", created_at=_days_ago(1, 10)),
        Notification(title="Bill due soon",                  body="Electricity Bill ₹1,840 due in 4 days.", type="info",    created_at=_days_ago(0, 8)),
        Notification(title="Adobe price increased 12%",      body="Adobe Creative Cloud now ₹1,675/month.", type="warning", read=True, created_at=_days_ago(5)),
        Notification(title="Goal milestone",                 body="Goa Trip fund is 46% complete!", type="success",created_at=_days_ago(7), read=True),
    ])

    # ── Activity log ──────────────────────────────────────────────────────────
    db.add_all([
        ActivityLog(action="Signed in",        detail="Chrome on Windows · Mumbai, IN", created_at=_days_ago(0, 8)),
        ActivityLog(action="Receipt scanned",  detail="dmart-bill.pdf → DMart ₹1,860",  created_at=_days_ago(1)),
        ActivityLog(action="Budget updated",   detail="Food budget set to ₹5,000",       created_at=_days_ago(4)),
        ActivityLog(action="Report generated", detail="Monthly report (PDF)",             created_at=_days_ago(9)),
        ActivityLog(action="Goal created",     detail="Bike Down Payment",                created_at=_days_ago(15)),
    ])

    # ── Settings ──────────────────────────────────────────────────────────────
    for k, v in DEFAULT_SETTINGS.items():
        db.add(Setting(key=k, value=v))
    db.add(Setting(key="seeded", value=True))

    await db.commit()
