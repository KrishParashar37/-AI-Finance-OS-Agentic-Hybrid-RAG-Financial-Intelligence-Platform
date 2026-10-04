export const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  Shopping: { emoji: "🛍️", color: "#8b5cf6" },
  Food: { emoji: "🍔", color: "#f97316" },
  Transport: { emoji: "🚗", color: "#0ea5e9" },
  Groceries: { emoji: "🛒", color: "#22c55e" },
  Entertainment: { emoji: "🎬", color: "#ec4899" },
  Bills: { emoji: "⚡", color: "#eab308" },
  Health: { emoji: "💊", color: "#ef4444" },
  Travel: { emoji: "✈️", color: "#14b8a6" },
  Education: { emoji: "📚", color: "#6366f1" },
  Subscriptions: { emoji: "🔄", color: "#a855f7" },
  Other: { emoji: "📦", color: "#64748b" },
  Salary: { emoji: "💼", color: "#10b981" },
  Freelance: { emoji: "🧑‍💻", color: "#06b6d4" },
  Investments: { emoji: "📈", color: "#84cc16" },
  Business: { emoji: "🏢", color: "#f59e0b" },
  Gifts: { emoji: "🎁", color: "#f43f5e" },
  Refunds: { emoji: "↩️", color: "#64748b" },
  Overall: { emoji: "🎯", color: "#6366f1" },
};

export const EXPENSE_CATEGORIES = [
  "Shopping",
  "Food",
  "Transport",
  "Groceries",
  "Entertainment",
  "Bills",
  "Health",
  "Travel",
  "Education",
  "Subscriptions",
  "Other",
];

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Investments", "Business", "Gifts", "Refunds"];

export const PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Cash", "Net Banking", "Wallet"];

export function catMeta(name: string) {
  return CATEGORY_META[name] ?? CATEGORY_META.Other;
}

export const RANGES = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "custom", label: "Custom" },
];
