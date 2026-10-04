import {
  mysqlTable as pgTable,
  serial,
  text,
  varchar,
  int as integer,
  double as doublePrecision,
  boolean,
  timestamp,
  json as jsonb,
} from "drizzle-orm/mysql-core";

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // bank | card | wallet
  institution: text("institution").notNull().default(""),
  last4: text("last4").notNull().default(""),
  balance: doublePrecision("balance").notNull().default(0),
  creditLimit: doublePrecision("credit_limit").notNull().default(0),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("expense"), // expense | income
  merchant: text("merchant").notNull(),
  category: text("category").notNull().default("Other"),
  amount: doublePrecision("amount").notNull(),
  tax: doublePrecision("tax").notNull().default(0),
  date: timestamp("date").notNull().defaultNow(),
  paymentMethod: text("payment_method").notNull().default("UPI"),
  accountId: integer("account_id"),
  notes: text("notes").notNull().default(""),
  source: text("source").notNull().default("manual"), // manual | scan | import
  recurring: boolean("recurring").notNull().default(false),
  risk: text("risk").notNull().default("low"), // low | medium | high
  riskReason: text("risk_reason").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // "Overall" or category name
  limitAmount: doublePrecision("limit_amount").notNull(),
  period: text("period").notNull().default("monthly"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🔄"),
  amount: doublePrecision("amount").notNull(),
  cycle: text("cycle").notNull().default("monthly"), // weekly | monthly | yearly
  nextRenewal: timestamp("next_renewal").notNull(),
  category: text("category").notNull().default("Subscriptions"),
  lastUsedDays: integer("last_used_days").notNull().default(0),
  priceChangePct: doublePrecision("price_change_pct").notNull().default(0),
  status: text("status").notNull().default("active"), // active | paused | cancelled
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: doublePrecision("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming | paid | overdue
  category: text("category").notNull().default("Bills"),
  autopay: boolean("autopay").notNull().default(false),
  recurring: boolean("recurring").notNull().default(true),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  party: text("party").notNull(),
  kind: text("kind").notNull().default("payable"), // payable | receivable
  amount: doublePrecision("amount").notNull(),
  tax: doublePrecision("tax").notNull().default(0),
  issueDate: timestamp("issue_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull().defaultNow(),
  status: text("status").notNull().default("pending"), // paid | pending | overdue
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🎯"),
  target: doublePrecision("target").notNull(),
  saved: doublePrecision("saved").notNull().default(0),
  deadline: timestamp("deadline").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("👥"),
  members: jsonb("members").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sharedExpenses = pgTable("shared_expenses", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  title: text("title").notNull(),
  amount: doublePrecision("amount").notNull(),
  paidBy: text("paid_by").notNull(),
  splitWith: jsonb("split_with").$type<string[]>().notNull().default([]),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settlements = pgTable("settlements", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  fromUser: text("from_user").notNull(),
  toUser: text("to_user").notNull(),
  amount: doublePrecision("amount").notNull(),
  status: text("status").notNull().default("completed"),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ScanItem = { name: string; qty: number; price: number };

export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  kind: text("kind").notNull().default("receipt"), // receipt | invoice
  merchant: text("merchant").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  total: doublePrecision("total").notNull(),
  tax: doublePrecision("tax").notNull().default(0),
  category: text("category").notNull().default("Other"),
  paymentMethod: text("payment_method").notNull().default("UPI"),
  confidence: integer("confidence").notNull().default(90),
  items: jsonb("items").$type<ScanItem[]>().notNull().default([]),
  status: text("status").notNull().default("processed"), // processed | saved | failed
  previewUrl: text("preview_url").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  format: text("format").notNull().default("pdf"),
  rangeStart: timestamp("range_start").notNull(),
  rangeEnd: timestamp("range_end").notNull(),
  status: text("status").notNull().default("ready"),
  rowCount: integer("row_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  type: text("type").notNull().default("info"), // info | warning | success | alert
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
});
