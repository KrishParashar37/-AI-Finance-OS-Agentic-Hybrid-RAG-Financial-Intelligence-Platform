import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const msg = (body.message || "").toLowerCase();

  // Generate context-aware answers based on keywords
  let answer = "";
  let mode = "hybrid";
  let citations: any[] = [];
  let steps: string[] = [];

  if (msg.includes("food") || msg.includes("khana") || msg.includes("dining")) {
    answer = "Based on your bank statements and receipts, here's your food spending breakdown:\n\n🍔 **Swiggy**: ₹450 (15 Oct)\n🍕 **Zomato**: ₹680 (18 Oct)\n🍟 **McDonald's**: ₹320\n🍕 **Domino's Pizza**: ₹540\n☕ **Starbucks**: ₹280\n\n**Total Food & Dining**: ₹2,270 this month\n\nThis is 15% lower than your 3-month average of ₹2,680. Good job controlling food spending! 🎉";
    mode = "hybrid";
    citations = [
      { type: "document", title: "Bank_Statement_Oct.pdf", score: 0.88, preview: "Swiggy food order ₹450, Zomato delivery ₹680", document_id: "doc_2" },
      { type: "sql", title: "Transactions DB", count: 12, total: 2270 }
    ];
    steps = ["Classified as hybrid (needs DB + docs)", "Generated SQL: SELECT * FROM transactions WHERE category = 'Food'", "Vector search for 'food dining receipts'", "Found 5 matching transactions in DB", "Found 2 relevant document chunks", "Merged and formatted response"];
  } else if (msg.includes("electronic") || msg.includes("laptop") || msg.includes("phone")) {
    answer = "I found **2 major electronics purchases** in your records:\n\n💻 **MacBook Air M2** — ₹89,189 from Amazon.in (25 Oct)\n📱 **Samsung Galaxy S24 Ultra** — ₹1,29,999 from Flipkart (Big Billion Days)\n\n**Total Electronics**: ₹2,19,188\n\nBoth purchases were on credit card. The MacBook has warranty tracking enabled.";
    mode = "hybrid";
    citations = [
      { type: "document", title: "Amazon_Receipt_Laptop.pdf", score: 0.94, preview: "Apple MacBook Air M2 purchased for ₹89,990 with ₹7,500 festive discount", document_id: "doc_1" },
      { type: "document", title: "Flipkart_Receipt_Phone.jpg", score: 0.79, preview: "Samsung Galaxy S24 Ultra 256GB - ₹1,29,999", document_id: "doc_6" },
      { type: "sql", title: "Transactions DB", count: 2, total: 219188 }
    ];
    steps = ["Classified as hybrid query", "SQL search: category = 'Electronics'", "Vector search: 'electronics laptop phone purchase'", "Found 2 receipts + 2 DB entries", "Cross-referenced amounts", "Generated summary"];
  } else if (msg.includes("subscription")) {
    answer = "Here are your active subscriptions from uploaded invoices and transaction data:\n\n🎨 **Adobe Creative Cloud** — ₹4,230/month\n🎬 **Netflix Premium** — ₹649/month\n🎵 **Spotify** — ₹119/month\n📱 **iCloud+ 200GB** — ₹219/month\n🤖 **ChatGPT Plus** — ₹1,999/month\n\n**Total Monthly Subscriptions**: ₹7,216\n\nAdobe is your most expensive subscription at 59% of total.";
    mode = "hybrid";
    citations = [
      { type: "document", title: "Adobe_Subscription_Invoice.pdf", score: 0.91, preview: "Adobe Creative Cloud All Apps - ₹4,230.42/month", document_id: "doc_3" },
      { type: "sql", title: "Transactions DB", count: 5, total: 7216 }
    ];
    steps = ["Identified subscription-related query", "SQL: SELECT * FROM transactions WHERE is_recurring = true", "Vector search: 'subscription invoice monthly'", "Found Adobe invoice document", "Found 5 recurring transactions", "Calculated totals"];
  } else if (msg.includes("salary") || msg.includes("income")) {
    answer = "From your salary slips and bank statements:\n\n💰 **September 2024 Salary**:\n• Gross: ₹1,25,000\n• PF Deduction: ₹15,000\n• Tax (TDS): ₹8,500\n• Net Pay: ₹1,01,500\n\n📊 Your savings rate is **18.8%** based on average income vs expenses.\n\nYour salary is credited on the 1st of every month via NEFT.";
    mode = "vector";
    citations = [
      { type: "document", title: "Salary_Slip_Sep_2024.pdf", score: 0.85, preview: "Gross: ₹1,25,000. Deductions: PF ₹15,000 + Tax ₹8,500. Net: ₹1,01,500", document_id: "doc_5" },
    ];
    steps = ["Classified as document-focused query", "Vector search: 'salary income earnings'", "Found salary slip document", "Extracted key figures", "Calculated savings rate from historical data"];
  } else if (msg.includes("unusual") || msg.includes("large") || msg.includes("anomal")) {
    answer = "🔍 I found **3 unusually large transactions**:\n\n1. 💻 **Amazon.in** — ₹89,189 (MacBook Air M2) on 25 Oct\n2. 📱 **Flipkart** — ₹1,29,999 (Samsung S24 Ultra) on 15 Oct\n3. ⛽ **Fuel** — ₹2,400 on 20 Oct (2x your usual ₹1,200)\n\nThe first two are one-time purchases. The fuel expense is **100% above average** — might want to check if there was an error.";
    mode = "hybrid";
    citations = [
      { type: "document", title: "HDFC_Credit_Card_Statement.pdf", score: 0.71, preview: "Large transaction alert: ₹89,189 at Amazon.in. Credit limit utilization: 45%", document_id: "doc_7" },
      { type: "sql", title: "Transactions DB", count: 3, total: 221588 }
    ];
    steps = ["Anomaly detection query detected", "SQL: SELECT * WHERE amount > avg * 2", "Vector search: 'unusual large transaction alert'", "Found credit card alert in documents", "Identified 3 outlier transactions", "Compared against 3-month averages"];
  } else if (msg.includes("compare") || msg.includes("spending") || msg.includes("category") || msg.includes("top")) {
    answer = "📊 **Your Top 5 Spending Categories (October)**:\n\n1. 🛒 **Shopping/Electronics** — ₹2,19,188 (78%)\n2. 🍔 **Food & Dining** — ₹2,270 (0.8%)\n3. 🚗 **Transport** — ₹3,530 (1.3%)\n4. 📱 **Subscriptions** — ₹7,216 (2.6%)\n5. 🏠 **Bills & Utilities** — ₹1,820 (0.6%)\n\n⚠️ Electronics spending is abnormally high due to MacBook + Phone purchases. Without those, your monthly spending is ₹14,836 — well within budget!";
    mode = "sql";
    citations = [
      { type: "sql", title: "Transactions DB", count: 45, total: 234024 }
    ];
    steps = ["Classified as analytics/SQL query", "Generated aggregation SQL by category", "Calculated percentages", "Identified outliers", "Generated comparison analysis"];
  } else if (msg.includes("tax") || msg.includes("gst")) {
    answer = "📋 **Tax-Related Summary**:\n\n• **TDS Deducted (Sep)**: ₹8,500 from salary\n• **GST on Amazon Purchase**: ₹13,600\n• **Tax Document Status**: 1 pending processing\n\nYour tax document 'Pending_Tax_Form_2024.pdf' is still being processed. Once indexed, I'll be able to answer more specific tax queries.";
    mode = "hybrid";
    citations = [
      { type: "document", title: "Salary_Slip_Sep_2024.pdf", score: 0.7, preview: "Tax (TDS): ₹8,500", document_id: "doc_5" },
      { type: "document", title: "Amazon_Receipt_Laptop.pdf", score: 0.65, preview: "GST Invoice - Tax Amount: ₹13,600", document_id: "doc_1" },
    ];
    steps = ["Identified tax-related query", "Vector search: 'tax GST TDS deduction'", "Found 2 relevant documents", "Note: 1 tax document still processing"];
  } else if (msg.includes("summarize") || msg.includes("overview") || msg.includes("summary")) {
    answer = "📊 **Financial Summary (October 2024)**:\n\n💰 **Income**: ₹1,01,500 (Net salary)\n💳 **Total Spending**: ₹2,34,024\n📈 **Savings**: -₹1,32,524 (deficit due to one-time purchases)\n\n**Excluding one-time electronics** (₹2,19,188):\n• Monthly expenses: ₹14,836\n• Savings: ₹86,664 (85% savings rate!) 🎉\n\n📄 **Knowledge Base**: 142 documents indexed, 3,504 chunks searchable\n🔍 **Queries this month**: 823 with avg 342ms latency";
    mode = "hybrid";
    citations = [
      { type: "sql", title: "Transactions DB", count: 45, total: 234024 },
      { type: "document", title: "Salary_Slip_Sep_2024.pdf", score: 0.85, preview: "Net Pay: ₹1,01,500", document_id: "doc_5" },
    ];
    steps = ["Comprehensive summary query", "SQL: Aggregate all income and expenses", "Vector search: 'monthly overview summary'", "Combined DB totals with document data", "Calculated savings rate", "Added KB stats"];
  } else {
    answer = `Great question! Let me search through your **142 indexed documents** and **transaction database** for: "${body.message}"\n\nI found relevant information in your financial records. Your total tracked expenses this month are ₹2,34,024 across 45 transactions.\n\nWould you like me to:\n• Break down by category?\n• Find related documents?\n• Compare with previous months?\n\nJust ask! 🚀`;
    mode = "hybrid";
    citations = [
      { type: "sql", title: "Transactions DB", count: 45, total: 234024 },
    ];
    steps = ["Classified query intent", "Searched MySQL transactions", "Searched vector store (3,504 chunks)", "No strong document match, using DB data", "Generated helpful response"];
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

      send({ t: "meta", v: { mode, steps } });
      await new Promise(r => setTimeout(r, 300));

      send({ t: "citations", v: citations });
      await new Promise(r => setTimeout(r, 200));

      // Stream answer word by word
      const words = answer.split(" ");
      for (const word of words) {
        send({ t: "chunk", v: word + " " });
        await new Promise(r => setTimeout(r, 25));
      }

      controller.close();
    }
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/event-stream" }
  });
}
