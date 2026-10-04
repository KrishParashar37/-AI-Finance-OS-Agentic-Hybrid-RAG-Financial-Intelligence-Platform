import { sql, count } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  profile: {
    name: "Krish",
    email: "krish@example.com",
    phone: "+91 98765 43210",
    bio: "Building healthy money habits.",
    monthlyIncomeTarget: 70000,
  },
  preferences: { currency: "INR", language: "en", dateFormat: "DD MMM YYYY", weekStart: "monday", autoCategorize: true },
  appearance: { theme: "system", accent: "indigo", density: "comfortable", animations: true },
  notifications: {
    email: true,
    push: true,
    budgetAlerts: true,
    billReminders: true,
    anomalyAlerts: true,
    weeklyDigest: false,
    aiInsights: true,
  },
  privacy: { hideBalances: false, analytics: true, shareAnonymousData: false },
  security: { twoFactor: false, loginAlerts: true },
  connectedApps: {
    gmail: true,
    googleDrive: false,
    hdfc: true,
    paytm: false,
    zerodha: false,
    slack: false,
  },
};

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERCHANTS = [
  { m: "Amazon", c: "Shopping", min: 499, max: 4200, pay: "Credit Card", w: 3 },
  { m: "Flipkart", c: "Shopping", min: 399, max: 3500, pay: "UPI", w: 2 },
  { m: "Myntra", c: "Shopping", min: 699, max: 3200, pay: "Credit Card", w: 1 },
  { m: "Zomato", c: "Food", min: 180, max: 720, pay: "UPI", w: 5 },
  { m: "Swiggy", c: "Food", min: 160, max: 680, pay: "UPI", w: 4 },
  { m: "Starbucks", c: "Food", min: 250, max: 620, pay: "Debit Card", w: 2 },
  { m: "Uber", c: "Transport", min: 120, max: 560, pay: "UPI", w: 4 },
  { m: "Ola", c: "Transport", min: 90, max: 420, pay: "UPI", w: 2 },
  { m: "HP Petrol Pump", c: "Transport", min: 800, max: 2200, pay: "Debit Card", w: 1 },
  { m: "BigBasket", c: "Groceries", min: 450, max: 2400, pay: "UPI", w: 3 },
  { m: "DMart", c: "Groceries", min: 600, max: 2800, pay: "Debit Card", w: 2 },
  { m: "PVR Cinemas", c: "Entertainment", min: 380, max: 1300, pay: "Credit Card", w: 1.5 },
  { m: "BookMyShow", c: "Entertainment", min: 300, max: 1100, pay: "UPI", w: 1 },
  { m: "Apollo Pharmacy", c: "Health", min: 150, max: 1400, pay: "UPI", w: 1.5 },
  { m: "Udemy", c: "Education", min: 449, max: 1299, pay: "Credit Card", w: 0.4 },
  { m: "MakeMyTrip", c: "Travel", min: 2500, max: 9000, pay: "Credit Card", w: 0.3 },
];

const TAX_RATE: Record<string, number> = { Shopping: 0.18, Entertainment: 0.18, Bills: 0.18, Food: 0.05, Education: 0.18, Travel: 0.05 };
const taxOf = (cat: string, amt: number) => Math.round((amt * (TAX_RATE[cat] ?? 0)) / (1 + (TAX_RATE[cat] ?? 0)));

const TABLES = [
  "transactions",
  "accounts",
  "budgets",
  "subscriptions",
  "bills",
  "invoices",
  "goals",
  "groups",
  "shared_expenses",
  "settlements",
  "scans",
  "reports",
  "notifications",
  "activity_log",
];

export async function clearAll(keepSettings = true) {
  await db.execute(sql.raw(`SET FOREIGN_KEY_CHECKS = 0;`));
  for (const table of TABLES) {
    await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\`;`));
  }
  await db.execute(sql.raw(`SET FOREIGN_KEY_CHECKS = 1;`));
  if (!keepSettings) await db.delete(s.settings);
}

export async function seedAll() {
  await clearAll();
  const r = rng(42);
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n: number, h = 14) => new Date(today0.getTime() - n * 86400000 + h * 3600000);
  const inDays = (n: number) => new Date(today0.getTime() + n * 86400000);

  const accData = [
      { name: "HDFC Savings", type: "bank", institution: "HDFC Bank", last4: "4821", balance: 38450, color: "#1d4ed8" },
      { name: "SBI Salary", type: "bank", institution: "State Bank of India", last4: "7710", balance: 6830, color: "#0ea5e9" },
      { name: "HDFC Regalia Card", type: "card", institution: "HDFC Bank", last4: "9034", balance: -14200, creditLimit: 150000, color: "#7c3aed" },
      { name: "Amazon Pay ICICI", type: "card", institution: "ICICI Bank", last4: "3356", balance: -6300, creditLimit: 100000, color: "#f97316" },
      { name: "Paytm Wallet", type: "wallet", institution: "Paytm", last4: "", balance: 1250, color: "#0284c7" },
      { name: "Amazon Pay Balance", type: "wallet", institution: "Amazon", last4: "", balance: 780, color: "#f59e0b" },
  ];
  await db.insert(s.accounts).values(accData);
  const accs = await db.select().from(s.accounts);
  const [bank, , card] = accs;

  const rows: (typeof s.transactions.$inferInsert)[] = [];
  const totalW = MERCHANTS.reduce((a, b) => a + b.w, 0);
  const pick = () => {
    let x = r() * totalW;
    for (const m of MERCHANTS) {
      x -= m.w;
      if (x <= 0) return m;
    }
    return MERCHANTS[0];
  };
  const acctFor = (pay: string) => (pay === "Credit Card" ? card.id : pay === "Cash" ? null : bank.id);

  for (let back = 13; back >= 0; back--) {
    const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const maxDay = back === 0 ? now.getDate() : dim;
    const mk = (day: number, hour = 9 + Math.floor(r() * 12)) =>
      new Date(base.getFullYear(), base.getMonth(), day, hour, Math.floor(r() * 60));

    rows.push({ type: "income", merchant: "Acme Technologies Pvt Ltd", category: "Salary", amount: 62000, date: mk(1, 10), paymentMethod: "Net Banking", recurring: true, source: "import", accountId: bank.id });
    if (r() < 0.6) {
      const d = Math.min(maxDay, 5 + Math.floor(r() * 18));
      rows.push({ type: "income", merchant: "Pixel Studio Client", category: "Freelance", amount: 8000 + Math.round(r() * 10) * 1000, date: mk(d), paymentMethod: "UPI", source: "manual", accountId: bank.id });
    }
    if (r() < 0.35) {
      const d = Math.min(maxDay, 10 + Math.floor(r() * 10));
      rows.push({ type: "income", merchant: "Zerodha Dividend", category: "Investments", amount: 800 + Math.round(r() * 17) * 100, date: mk(d), paymentMethod: "Net Banking", source: "import", accountId: bank.id });
    }

    const fixed = [
      { m: "Netflix", c: "Subscriptions", day: 12, a: 649 },
      { m: "Spotify", c: "Subscriptions", day: 5, a: 119 },
      { m: "Adobe Creative Cloud", c: "Subscriptions", day: 18, a: back === 0 ? 1675 : 1496 },
      { m: "ChatGPT Plus", c: "Subscriptions", day: 25, a: 1999 },
      { m: "Airtel Broadband", c: "Bills", day: 10, a: 999 },
      { m: "Jio Mobile", c: "Bills", day: 3, a: 349 },
      { m: "Electricity Board", c: "Bills", day: 8, a: 1500 + Math.round(r() * 9) * 100 },
    ];
    for (const f of fixed) {
      if (f.day > maxDay) continue;
      rows.push({ type: "expense", merchant: f.m, category: f.c, amount: f.a, tax: taxOf(f.c, f.a), date: mk(f.day), paymentMethod: f.c === "Subscriptions" ? "Credit Card" : "UPI", recurring: true, source: "import", accountId: f.c === "Subscriptions" ? card.id : bank.id });
    }

    const n0 = 15 + Math.floor(r() * 8);
    const n = back === 0 ? Math.max(4, Math.round((n0 * maxDay) / dim)) : n0;
    for (let i = 0; i < n; i++) {
      const m = pick();
      const amount = Math.round(m.min + r() * (m.max - m.min));
      rows.push({
        type: "expense",
        merchant: m.m,
        category: m.c,
        amount,
        tax: taxOf(m.c, amount),
        date: mk(1 + Math.floor(r() * maxDay)),
        paymentMethod: m.pay,
        source: r() < 0.25 ? "scan" : "manual",
        accountId: acctFor(m.pay),
      });
    }
  }

  // Anomalies / duplicates for the security centre
  rows.push(
    { type: "expense", merchant: "Amazon", category: "Shopping", amount: 24999, tax: taxOf("Shopping", 24999), date: daysAgo(2, 23), paymentMethod: "Credit Card", accountId: card.id, risk: "high", riskReason: "Amount is 9.0× your typical Shopping purchase" },
    { type: "expense", merchant: "Unknown ATM", category: "Other", amount: 8000, date: daysAgo(3, 2), paymentMethod: "Cash", risk: "medium", riskReason: "Cash withdrawal at an unrecognised ATM at an unusual hour" },
    { type: "expense", merchant: "CryptoXchange", category: "Other", amount: 5000, date: daysAgo(4, 1), paymentMethod: "UPI", accountId: bank.id, risk: "medium", riskReason: "First-time merchant with a large amount" },
    { type: "expense", merchant: "Zomato", category: "Food", amount: 449, tax: taxOf("Food", 449), date: daysAgo(1, 20), paymentMethod: "UPI", accountId: bank.id, riskReason: "Duplicate: same merchant & amount within 24h" },
    { type: "expense", merchant: "Zomato", category: "Food", amount: 449, tax: taxOf("Food", 449), date: daysAgo(1, 20), paymentMethod: "UPI", accountId: bank.id, riskReason: "Duplicate: same merchant & amount within 24h" },
    { type: "expense", merchant: "Barbeque Nation", category: "Food", amount: 1200, tax: taxOf("Food", 1200), date: daysAgo(5, 21), paymentMethod: "Credit Card", accountId: card.id, riskReason: "" },
  );

  for (let i = 0; i < rows.length; i += 200) await db.insert(s.transactions).values(rows.slice(i, i + 200));

  await db.insert(s.budgets).values([
    { category: "Overall", limitAmount: 40000 },
    { category: "Food", limitAmount: 5000 },
    { category: "Shopping", limitAmount: 10000 },
    { category: "Transport", limitAmount: 4000 },
    { category: "Entertainment", limitAmount: 3000 },
    { category: "Groceries", limitAmount: 6000 },
    { category: "Bills", limitAmount: 4000 },
    { category: "Health", limitAmount: 2000 },
  ]);

  const nextOn = (day: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), day);
    return d < today0 ? new Date(now.getFullYear(), now.getMonth() + 1, day) : d;
  };
  await db.insert(s.subscriptions).values([
    { name: "Netflix", emoji: "🎬", amount: 649, nextRenewal: nextOn(12), lastUsedDays: 38 },
    { name: "Spotify", emoji: "🎧", amount: 119, nextRenewal: nextOn(5), lastUsedDays: 1 },
    { name: "Adobe Creative Cloud", emoji: "🎨", amount: 1675, nextRenewal: nextOn(18), lastUsedDays: 47, priceChangePct: 12 },
    { name: "ChatGPT Plus", emoji: "🤖", amount: 1999, nextRenewal: nextOn(25), lastUsedDays: 0 },
    { name: "YouTube Premium", emoji: "▶️", amount: 149, nextRenewal: nextOn(20), lastUsedDays: 9, status: "paused" },
  ]);

  await db.insert(s.bills).values([
    { name: "Electricity Bill", amount: 1840, dueDate: inDays(4), category: "Bills", autopay: false },
    { name: "HDFC Credit Card", amount: 14200, dueDate: inDays(6), category: "Bills", autopay: false },
    { name: "Airtel Broadband", amount: 999, dueDate: inDays(9), category: "Bills", autopay: true },
    { name: "Jio Mobile", amount: 349, dueDate: inDays(14), category: "Bills", autopay: true },
    { name: "LIC Insurance Premium", amount: 6200, dueDate: inDays(21), category: "Health", autopay: false },
    { name: "Water Bill", amount: 420, dueDate: inDays(-3), status: "overdue", category: "Bills" },
    { name: "Society Maintenance", amount: 2500, dueDate: inDays(-10), status: "paid", category: "Bills" },
  ]);

  await db.insert(s.invoices).values([
    { number: "INV-2026-0142", party: "Adobe Systems", kind: "payable", amount: 1675, tax: 256, issueDate: daysAgo(12), dueDate: inDays(6), status: "pending" },
    { number: "INV-2026-0098", party: "Pixel Studio Client", kind: "receivable", amount: 18000, tax: 2746, issueDate: daysAgo(20), dueDate: inDays(10), status: "pending" },
    { number: "INV-2026-0075", party: "Acme Design Studio", kind: "receivable", amount: 12000, tax: 1831, issueDate: daysAgo(45), dueDate: daysAgo(15), status: "overdue" },
    { number: "INV-2026-0031", party: "AWS India", kind: "payable", amount: 3240, tax: 494, issueDate: daysAgo(60), dueDate: daysAgo(30), status: "paid" },
  ]);

  await db.insert(s.goals).values([
    { name: "Emergency Fund", emoji: "🛟", target: 150000, saved: 62000, deadline: inDays(300) },
    { name: "Goa Trip", emoji: "🏖️", target: 40000, saved: 18500, deadline: inDays(120) },
    { name: "New Laptop", emoji: "💻", target: 90000, saved: 41000, deadline: inDays(200) },
    { name: "Bike Down Payment", emoji: "🏍️", target: 60000, saved: 9000, deadline: inDays(400) },
  ]);

  const groupData = [
      { name: "Goa Trip", emoji: "🏖️", members: ["You", "Aarav", "Meera", "Rohan"] },
      { name: "Flatmates", emoji: "🏠", members: ["You", "Karan", "Ishaan"] },
      { name: "Office Lunch", emoji: "🍱", members: ["You", "Neha", "Vikram"] },
  ];
  await db.insert(s.groups).values(groupData);
  const grps = await db.select().from(s.groups);
  const [g1, g2, g3] = grps;
  await db.insert(s.sharedExpenses).values([
    { groupId: g1.id, title: "Hotel booking", amount: 18000, paidBy: "You", splitWith: g1.members, date: daysAgo(14) },
    { groupId: g1.id, title: "Flights", amount: 24000, paidBy: "Aarav", splitWith: g1.members, date: daysAgo(20) },
    { groupId: g1.id, title: "Scooter rental", amount: 3200, paidBy: "Meera", splitWith: g1.members, date: daysAgo(9) },
    { groupId: g1.id, title: "Beach shack dinner", amount: 4800, paidBy: "Rohan", splitWith: g1.members, date: daysAgo(8) },
    { groupId: g2.id, title: "Wi-Fi", amount: 1200, paidBy: "You", splitWith: g2.members, date: daysAgo(6) },
    { groupId: g2.id, title: "Groceries", amount: 2400, paidBy: "Karan", splitWith: g2.members, date: daysAgo(4) },
    { groupId: g2.id, title: "Electricity", amount: 3600, paidBy: "Ishaan", splitWith: g2.members, date: daysAgo(2) },
    { groupId: g3.id, title: "Team lunch", amount: 1800, paidBy: "Neha", splitWith: g3.members, date: daysAgo(3) },
    { groupId: g3.id, title: "Coffee run", amount: 540, paidBy: "You", splitWith: g3.members, date: daysAgo(1) },
  ]);
  await db.insert(s.settlements).values([{ groupId: g1.id, fromUser: "Rohan", toUser: "You", amount: 1500, date: daysAgo(5) }]);

  await db.insert(s.scans).values([
    { fileName: "amazon-order.jpg", fileSize: 184000, merchant: "Amazon", date: daysAgo(6), total: 2499, tax: 381, category: "Shopping", paymentMethod: "UPI", confidence: 97, status: "saved", items: [{ name: "Wireless Mouse", qty: 1, price: 1299 }, { name: "USB-C Cable", qty: 2, price: 600 }], createdAt: daysAgo(6) },
    { fileName: "zomato-invoice.png", fileSize: 96000, merchant: "Zomato", date: daysAgo(3), total: 480, tax: 23, category: "Food", paymentMethod: "UPI", confidence: 94, status: "saved", items: [{ name: "Paneer Tikka Bowl", qty: 1, price: 320 }, { name: "Cold Coffee", qty: 1, price: 137 }], createdAt: daysAgo(3) },
    { fileName: "dmart-bill.pdf", fileSize: 220000, merchant: "DMart", date: daysAgo(1), total: 1860, tax: 142, category: "Groceries", paymentMethod: "Debit Card", confidence: 91, status: "processed", items: [{ name: "Groceries", qty: 12, price: 1718 }], createdAt: daysAgo(1) },
  ]);

  await db.insert(s.reports).values([
    { type: "monthly", format: "pdf", rangeStart: new Date(now.getFullYear(), now.getMonth() - 1, 1), rangeEnd: new Date(now.getFullYear(), now.getMonth(), 0), rowCount: 48, createdAt: daysAgo(9) },
    { type: "tax", format: "xlsx", rangeStart: new Date(now.getFullYear(), 0, 1), rangeEnd: today0, rowCount: 210, createdAt: daysAgo(20) },
  ]);

  await db.insert(s.notifications).values([
    { title: "High-risk transaction detected", body: "Amazon ₹24,999 looks unusual compared to your Shopping history.", type: "alert", createdAt: daysAgo(2, 23) },
    { title: "Entertainment budget exceeded", body: "You've crossed your monthly Entertainment budget.", type: "warning", createdAt: daysAgo(1, 10) },
    { title: "Bill due soon", body: "Electricity Bill of ₹1,840 is due in 4 days.", type: "info", createdAt: daysAgo(0, 8) },
    { title: "Adobe price increased 12%", body: "Adobe Creative Cloud now costs ₹1,675/month.", type: "warning", read: true, createdAt: daysAgo(5) },
    { title: "Goal milestone", body: "Goa Trip fund is 46% complete. Keep going!", type: "success", read: true, createdAt: daysAgo(7) },
  ]);

  await db.insert(s.activityLog).values([
    { action: "Signed in", detail: "Chrome on Windows · Mumbai, IN", createdAt: daysAgo(0, 8) },
    { action: "Receipt scanned", detail: "dmart-bill.pdf → DMart ₹1,860", createdAt: daysAgo(1) },
    { action: "Budget updated", detail: "Food budget set to ₹5,000", createdAt: daysAgo(4) },
    { action: "Report generated", detail: "Monthly report (PDF)", createdAt: daysAgo(9) },
    { action: "Goal created", detail: "Bike Down Payment", createdAt: daysAgo(15) },
  ]);

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(s.settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  }
  await db.insert(s.settings).values({ key: "seeded", value: true }).onDuplicateKeyUpdate({ set: { value: true } });
}

let seeding: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seeding) {
    seeding = (async () => {
      const [{ n }] = await db.select({ n: count() }).from(s.settings);
      if (n === 0) await seedAll();
    })().catch((e) => {
      seeding = null;
      throw e;
    });
  }
  return seeding;
}
