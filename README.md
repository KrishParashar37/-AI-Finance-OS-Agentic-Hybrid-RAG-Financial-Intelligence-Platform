# 💰 AI Finance OS — Agentic Hybrid RAG Financial Intelligence Platform

> **Next.js · FastAPI · MySQL · RAG · LangGraph · Groq LLM · Firebase Auth**

A complete AI-powered personal finance management system that understands your money using RAG (Retrieval-Augmented Generation) technology.

---

## ⚡ Quick Start

Double-click **`run.bat`** in the project folder. That's it.

```
✓ Checks MySQL is running
✓ Starts Python backend  →  http://localhost:8000
✓ Starts Next.js frontend →  http://localhost:3000
✓ Opens browser automatically
```

**Manual start:**
```bash
# Terminal 1 — Backend
cd backend
.\venv\Scripts\python main.py

# Terminal 2 — Frontend
npm run dev
```

---

## 🔧 Requirements

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| Python | 3.12 |
| MySQL | 8.0+ (running locally) |
| Groq API Key | Free — https://console.groq.com |

**`.env` configuration:**
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ai_finance_db

GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=qwen/qwen3.8-27b
```

> Demo data is seeded automatically on first run — 14 months of transactions, accounts, budgets, goals, and more.

---

## 🔑 How to Log In

1. Open `http://localhost:3000/login`
2. Click **"Continue with Google"**
3. Select your Google account
4. You're in — the dashboard loads with demo data

---

## 📱 Complete Feature Guide

### 🏠 Dashboard (`/overview`)
Your complete financial snapshot in one place.
- Net balance, monthly income, total expenses
- Spending trend chart (7d / 30d / 3m / 6m / 1y)
- Top spending categories with pie chart
- Quick stats — savings rate, biggest expense, daily average
- Upcoming bills and goal progress widgets

**How to use:** Change the date range at the top — all charts update instantly.

---

### 💸 Expenses (`/expenses`)
Track and manage all your spending.

**Features:**
- Filter by category, payment method, date range, amount
- Search by merchant name
- Click any expense to view details and edit
- Mark expenses as recurring (EMI, rent)
- Bulk actions — select multiple → delete, recategorize, or mark safe

**3 ways to add expenses:**
1. **Manual** → Fill the form at `/expenses/new`
2. **Receipt scan** → Take a photo, AI extracts everything
3. **Import** → Upload a bank statement

---

### 💵 Income (`/income`)
Track all income sources.
- Add salary, freelance, investment income
- Filter by source type
- View monthly income trend

---

### 📊 Analytics (`/analytics`)
Deep analysis of your financial data — 5 pages.

| Page | What It Shows |
|---|---|
| `/analytics` | Income vs expense bar chart, category breakdown |
| `/analytics/spending` | Daily heatmap, spending velocity, month projections |
| `/analytics/categories` | Per-category trend, month-over-month change |
| `/analytics/merchants` | Top merchants by spend, visit frequency |
| `/analytics/cash-flow` | Monthly cash flow, yearly comparison |

**Pro tip:** Hover over the heatmap to see exact spend for any day.

---

### 🤖 AI Assistant (`/ai`)
A ChatGPT-like assistant that knows your actual financial data.

**How to use:**
1. Go to `/ai`
2. Ask anything in plain English
3. AI reads your real transactions, budgets, and bills to answer

**Example questions:**
```
"How much did I spend on food in October?"
"Can I save ₹5,000 this month?"
"When does my Netflix subscription renew?"
"What will my expenses be next month?"
"Which bills are due this week?"
"What is my savings rate?"
"Show my top 5 merchants"
"Find any unusual transactions"
```

> **Multi-turn conversation:** The AI remembers the full conversation. Ask follow-up questions — context is maintained.

---

### 🧠 AI Insights (`/ai/insights`)
Automated analysis of your financial health.

- **Financial Health Score** — 0–100 with 6 components:
  - Savings rate, Budget adherence, Spending stability
  - Subscription load, Bill discipline, Emergency fund
- **Alerts** — "Entertainment budget exceeded"
- **Warnings** — "Netflix unused for 30+ days"
- **Tips** — "Trim Groceries by 10%, save ₹8,000/year"
- **Wins** — "Shopping spending down 23% this month"

---

### 🔮 Predictions (`/ai/predictions`)
AI-powered forecast for next month.
- Predicted total expense (based on last 6 months)
- This month end projection at current pace
- Category-by-category predictions
- Forecast chart — solid line (actual) + dashed line (predicted)

---

### 🚨 Security Center (`/ai/anomalies`)
Detect fraud, duplicates, and suspicious activity.

**AI flags:**
- **High risk** — Amount 4x above your typical spend in a category
- **Medium risk** — First-time merchant with a large amount
- **Duplicates** — Same merchant, same amount, within 24 hours
- **Unusual** — Large cash withdrawals at odd hours

**Actions on flagged transactions:**
- "This was me" → Mark as safe
- "Report" → Flag as fraud

---

### 💡 Financial Advisor (`/ai/advisor`)
Personalized advice and what-if simulators.

- **Savings Simulator** — "If I reduce Food by 15%, how much do I save?"
- **SIP Calculator** — ₹5,000/month × 10 years × 12% = projected wealth
- **AI Advice Cards** — 50/30/20 rule, emergency fund, investment tips

---

### 📋 Budgets (`/budgets`)
Set monthly spending limits per category.

- Live progress bars — Green (safe) → Orange (85%+) → Red (over limit)
- **Smart Budget** — AI auto-generates budgets from your last 3 months
- Budget calendar view at `/budgets/calendar`

---

### 🔄 Subscriptions (`/subscriptions`)
Track all recurring services.

- Total monthly subscription cost
- **Unused detection** — 30+ days inactive → AI alert
- Price change notifications — "Adobe increased 12%"
- Renewal calendar at `/subscriptions/calendar`

---

### 🧾 Bills (`/bills`)
Never miss a payment.

- Due date countdown for each bill
- Status — Upcoming / Overdue / Paid
- Autopay indicator
- Calendar view at `/bills/calendar`
- Overdue bills highlighted in red

---

### 📄 Invoices (`/invoices`)
Manage business invoices.

- **Payable** — You owe (Adobe, AWS)
- **Receivable** — You're owed (clients)
- Invoice scanner — extract from photo
- Status tracking — Pending / Paid / Overdue

---

### 🏦 Accounts (`/accounts`)
Track all your bank accounts, cards, and wallets.

- Balance updates automatically when you add transactions
- Credit card — available limit vs used
- Net worth calculation across all accounts

Sub-pages:
- `/accounts/cards` — Credit and debit cards
- `/accounts/wallets` — Paytm, Amazon Pay, etc.

---

### 👥 Shared Expenses (`/shared`)
Split expenses with friends and family.

- Create groups (Goa Trip, Flatmates, Office Lunch)
- Add expenses — who paid, who shares
- Track settlements — who owes whom
- Auto-calculation of balances

---

### 📷 Receipt Scanner (`/scanner`)
Scan a receipt and add an expense automatically.

**Steps:**
1. Go to `/scanner`
2. Click **"Use Camera"** → Camera opens → Take photo
   — or — **"Upload Receipt"** → Choose a file
3. AI extracts the data automatically
4. Review and edit if needed
5. Click **"Save Expense"** → Done

**What AI extracts:**
- Merchant name
- Total amount + Tax (GST)
- Category (auto-predicted)
- Line items (e.g., Paneer Tikka ₹320, Cold Coffee ₹137)
- Confidence score (90–99%)

**Batch Scanner** (`/scanner/batch`) — Upload up to 20 receipts at once.

---

### 📈 Reports (`/reports`)
Generate and download financial reports.

**Report types:**
| Type | Content |
|---|---|
| Monthly | Day-by-day income and expenses |
| Annual | Month-by-month yearly summary |
| Expense | All expenses with categories |
| Income | All income sources |
| Tax | GST paid on purchases |
| Budget | Budget vs actual spending |
| AI Financial | Groq-powered deep analysis |

**Download formats:** PDF, CSV, Excel

**Steps:** Go to `/reports/generate` → Select date range and type → Generate → Download.

---

### 🎯 Goals (`/goals`)
Set and track savings goals.

- Set target amount and deadline (e.g., Goa Trip ₹40,000 in 4 months)
- Track progress with a visual bar
- AI calculates how much to save per month to reach the goal on time

---

### 🔔 Notifications (`/notifications`)
AI-generated in-app alerts.
- Budget exceeded
- Bill due reminders
- High-risk transaction flags
- Goal milestone reached
- Subscription price changes

---

### 🔍 Global Search (`/search`)
Search everything from one place.
- Transactions by merchant, category, or notes
- Subscriptions, bills, goals, invoices, groups, scans

---

### ⚙️ Settings (`/settings`)

| Page | What You Can Change |
|---|---|
| `/settings/profile` | Name, email, income target |
| `/settings/preferences` | Currency, date format, language |
| `/settings/appearance` | Dark/light/system theme, accent color |
| `/settings/notifications` | Which alerts to receive |
| `/settings/security` | 2FA, login alerts |
| `/settings/connected-apps` | Google, HDFC, Paytm integrations |
| `/settings/data` | Export backup, restore, reset demo data |

---

## 🆕 RAG Knowledge Base (`/rag`)

Upload your financial documents and ask questions about them. The AI searches both your MySQL database and uploaded documents to give grounded answers with citations.

### How It Works

```
Your Question
      ↓
Query Router  ──→  SQL    (exact questions)
              ──→  Vector (document search)
              ──→  Both   (complex analysis)
      ↓
LangGraph 5-step Pipeline
      ↓
Groq LLM
      ↓
Answer + Source Citations
```

### Step-by-Step Usage

**Step 1 — Upload documents** (`/rag/documents`)
1. Go to `/rag/documents`
2. Select document type (Receipt, Invoice, Bank Statement, Salary Slip, etc.)
3. Drag and drop a PDF, JPG, or PNG
4. The system automatically: extracts text → chunks → embeds → stores

**Step 2 — Ask in RAG Chat** (`/ai/rag`)
1. Go to `/ai/rag`
2. Ask a question — the AI searches both MySQL and your documents
3. The answer includes **citations** showing exactly which documents were used

**Example:**
```
Question:
"How much did I spend on food from August to October,
 and which receipts support this spending?"

AI Answer:
Total Food Spending: ₹18,420 (27 transactions)

Sources:
📄 Swiggy Receipt — 14 Aug     (similarity: 0.91)
📄 Zomato Receipt — 22 Sep     (similarity: 0.87)
📄 Restaurant Receipt — 03 Oct (similarity: 0.84)
📊 MySQL — Food transactions   (27 rows)
```

**Step 3 — Semantic Search** (`/rag/search`)
- Search documents using natural language
- "Find expensive electronics purchases"
- "Show receipts similar to my laptop purchase"
- Results ranked by similarity score

**Step 4 — Debug Retrieval** (`/rag/retrieval`)
- Inspect any past query
- See exactly which chunks were retrieved and their scores
- Understand how SQL and vector results were combined

### RAG Dashboard (`/rag`)
- Documents indexed, chunks stored, total queries
- Pipeline architecture diagram
- Daily query volume chart
- Document type breakdown

---

## 📊 Feature Summary

| Section | Features |
|---|---|
| Dashboard | 8 |
| Expenses | 12 |
| Income | 4 |
| Analytics (5 pages) | 15 |
| AI Chat | 6 |
| AI Insights | 10 |
| Predictions | 4 |
| Security Center | 5 |
| Financial Advisor | 5 |
| Budgets | 8 |
| Subscriptions | 6 |
| Bills | 5 |
| Invoices | 5 |
| Accounts | 6 |
| Shared Expenses | 5 |
| Receipt Scanner | 8 |
| Reports | 7 |
| Goals | 4 |
| Notifications | 3 |
| Global Search | 3 |
| Settings | 12 |
| RAG Knowledge Base | 10 |
| **Total** | **~156 features** |

---

## ⌨️ Keyboard Shortcuts

| Keys | Action |
|---|---|
| `Ctrl / ⌘ + K` | Open command palette |
| `/` | Global search |
| `N` | New expense |
| `S` | Scan a receipt |
| `T` | Toggle dark / light mode |
| `G → D` | Go to Dashboard |
| `G → E` | Go to Expenses |
| `G → A` | Go to Analytics |
| `G → I` | Go to AI Assistant |
| `G → R` | Go to Reports |
| `Esc` | Close any dialog |

---

## 🌐 All Pages (60+)

```
Authentication
  /login               Sign in (Google or Email/Password)
  /signup              Create a new account
  /forgot-password     Request a password reset
  /verify-email        Email verification

Dashboard
  /overview            Main dashboard
  /financial-health    Health score breakdown

Expenses
  /expenses            Expense list with filters
  /expenses/new        Add a new expense
  /expenses/[id]       View / edit expense
  /expenses/recurring  Recurring expenses
  /expenses/categories Category analytics

Income
  /income              Income list
  /income/new          Add income
  /income/[id]         View / edit income

Analytics
  /analytics           Overview charts
  /analytics/spending  Heatmap + velocity
  /analytics/categories  Category trends
  /analytics/merchants   Merchant analysis
  /analytics/cash-flow   Cash flow

AI
  /ai                  AI chat assistant
  /ai/insights         AI insights dashboard
  /ai/predictions      Spending forecast
  /ai/anomalies        Security center
  /ai/advisor          Financial advisor
  /ai/rag              Hybrid RAG chat  ← NEW

RAG
  /rag                 RAG dashboard     ← NEW
  /rag/documents       Document list + upload  ← NEW
  /rag/documents/[id]  Document detail + chunks  ← NEW
  /rag/search          Semantic search   ← NEW
  /rag/retrieval       Retrieval debugger  ← NEW

Finance
  /budgets             Budget list
  /budgets/new         Create budget
  /budgets/[id]        Budget detail
  /budgets/calendar    Budget calendar
  /subscriptions       Subscription list
  /subscriptions/[id]  Subscription detail
  /subscriptions/calendar  Renewal calendar
  /bills               Bill list
  /bills/[id]          Bill detail
  /bills/calendar      Bill calendar
  /invoices            Invoice list
  /invoices/[id]       Invoice detail
  /invoices/scanner    Invoice scanner
  /accounts            Account list
  /accounts/[id]       Account detail
  /accounts/cards      Cards
  /accounts/wallets    Wallets

Shared
  /shared              Shared expenses
  /shared/groups       Groups
  /shared/settlements  Settlements

Scanner
  /scanner             Single receipt
  /scanner/batch       Batch scan (up to 20)
  /scanner/history     Scan history
  /scanner/result/[id] Review + save

Reports & Goals
  /reports             Report list
  /reports/generate    Generate report
  /reports/[id]        Report detail + download
  /goals               Goal list
  /goals/new           Create goal
  /goals/[id]          Goal detail

Other
  /notifications       Notifications
  /search              Global search
  /settings            Settings
  /settings/profile    Profile
  /settings/preferences  Preferences
  /settings/appearance   Theme
  /settings/notifications  Alerts
  /settings/security     Security
  /settings/connected-apps  Integrations
  /settings/data         Data management
```

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | UI framework |
| Styling | Tailwind CSS 4, Framer Motion | Design & animations |
| Backend | FastAPI, Python 3.12 | API server |
| Database | MySQL 8.0 | Structured data storage |
| Auth | Firebase Authentication | Google Sign-In |
| AI / LLM | Groq (`qwen/qwen3.8-27b`) | Free, fast, unlimited |
| RAG | Custom: hash embeddings + NumPy | Document retrieval |
| Agent | LangGraph-style pipeline | 5-step query processing |
| PDF | pypdf | PDF text extraction |
| Charts | Recharts | Data visualization |
| ORM | Drizzle (JS) + SQLAlchemy (Python) | Database queries |

---

## 🗄️ Database Tables (18 total)

| Table | Purpose |
|---|---|
| `transactions` | All income and expenses |
| `accounts` | Bank accounts, cards, wallets |
| `budgets` | Monthly spending limits |
| `subscriptions` | Recurring services |
| `bills` | Upcoming payments |
| `invoices` | Business invoices |
| `goals` | Savings targets |
| `groups` | Shared expense groups |
| `shared_expenses` | Split expenses |
| `settlements` | Group debt settlements |
| `scans` | Receipt scan records |
| `reports` | Generated report metadata |
| `notifications` | In-app alerts |
| `activity_log` | Action history |
| `settings` | User preferences |
| `rag_documents` | Uploaded documents (RAG) |
| `rag_chunks` | Text chunks for vector search (RAG) |
| `rag_queries` | Query history and metrics (RAG) |

---

## 🔌 API Reference

### Core APIs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Database health check |
| GET | `/api/stats` | Full analytics stats |
| GET | `/api/transactions` | List transactions (filterable) |
| POST | `/api/transactions` | Create transaction |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| POST | `/api/transactions/bulk` | Bulk actions |
| GET | `/api/ai/insights` | Health score + predictions |
| POST | `/api/ai/chat` | Groq streaming chat |
| GET | `/api/security` | Fraud and anomaly detection |
| POST | `/api/budgets/smart` | AI-generated budgets |

### RAG APIs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rag/stats` | Pipeline metrics |
| POST | `/api/rag/documents/upload` | Upload and index a document |
| GET | `/api/rag/documents` | List all documents |
| GET | `/api/rag/documents/:id` | Document details + chunks |
| DELETE | `/api/rag/documents/:id` | Delete a document |
| POST | `/api/rag/query` | Hybrid RAG query |
| POST | `/api/rag/query/stream` | Streaming RAG query |
| GET | `/api/rag/search?q=` | Semantic vector search |
| POST | `/api/rag/reindex` | Re-embed all chunks |
| GET | `/api/rag/retrieval/:id` | Debug a past query |

Full interactive documentation: **http://localhost:8000/docs**

---

## ❓ Troubleshooting

**Backend not starting?**
```bash
cd backend
.\venv\Scripts\python -c "import main; print('OK')"
```

**MySQL connection error?**
```
Check .env:
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ai_finance_db
```

**AI chat not responding?**
- Make sure `GROQ_API_KEY` is set in `.env`
- The model `qwen/qwen3.8-27b` is free on Groq

**Camera not opening on scanner?**
- Allow camera permission in the browser
- In Edge: address bar → Camera icon → Allow

**Dependencies not installed?**
```bash
cd backend
py -3.12 -m venv venv
.\venv\Scripts\pip install -r requirements.txt
```

---

## 📝 Resume Description

> "Built an **Agentic Hybrid RAG Financial Intelligence Platform** where structured financial data is retrieved from MySQL via SQL agents and unstructured receipts, invoices, and financial documents are retrieved from a vector store using semantic search. LangGraph orchestrates a 5-step pipeline — query classification, SQL retrieval, vector retrieval, context fusion, and Groq LLM generation — with source citations in the final response. The system handles 18 MySQL tables, a NumPy-based in-memory vector store with hash embeddings, a Next.js frontend with Firebase Google Auth, and a FastAPI Python backend."

**Tech:** Next.js · FastAPI · Python · MySQL · RAG · LangGraph · Groq · Firebase · Hybrid Retrieval · Vector Search · TypeScript

---

*AI Finance OS v2.0*
