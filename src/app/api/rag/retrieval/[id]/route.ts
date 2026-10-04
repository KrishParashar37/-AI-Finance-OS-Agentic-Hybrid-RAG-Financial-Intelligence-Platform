import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  await new Promise(r => setTimeout(r, 400));

  const queries: Record<string, any> = {
    "101": {
      id: 101, query: "Show me expensive electronics purchases", latency_ms: 432, mode: "hybrid", sql_used: true, chunks_retrieved: 3,
      answer: "You have 2 major electronics purchases: MacBook Air M2 for ₹89,189 from Amazon.in and Samsung Galaxy S24 Ultra for ₹1,29,999 from Flipkart. Total: ₹2,19,188.",
      retrieved_chunks: [
        { chunk_id: "c1", filename: "Amazon_Receipt_Laptop.pdf", score: 0.94, text: "Apple MacBook Air M2 (13.6 inch, 8GB RAM, 256GB SSD) - ₹89,990 with ₹7,500 discount = ₹89,189" },
        { chunk_id: "c2", filename: "Flipkart_Receipt_Phone.jpg", score: 0.79, text: "Samsung Galaxy S24 Ultra 256GB - ₹1,29,999 via Flipkart Big Billion Days" },
        { chunk_id: "c3", filename: "HDFC_Credit_Card_Statement.pdf", score: 0.71, text: "Large transaction alert: ₹89,189 at Amazon.in. Credit limit utilization: 45%" }
      ]
    },
    "102": {
      id: 102, query: "What is my total spending on food last month?", latency_ms: 120, mode: "sql", sql_used: true, chunks_retrieved: 0,
      answer: "Your total food spending last month was ₹2,270 across 5 transactions: Swiggy ₹450, Zomato ₹680, McDonald's ₹320, Domino's ₹540, Starbucks ₹280.",
      retrieved_chunks: []
    },
    "103": {
      id: 103, query: "Find receipts from Adobe", latency_ms: 654, mode: "vector", sql_used: false, chunks_retrieved: 2,
      answer: "Found Adobe Creative Cloud subscription invoice: ₹4,230.42/month for All Apps plan. Billing date is 1st of every month.",
      retrieved_chunks: [
        { chunk_id: "c_a1", filename: "Adobe_Subscription_Invoice.pdf", score: 0.91, text: "Adobe Creative Cloud All Apps subscription. Monthly: ₹4,230.42 (incl. GST). Billing date: 1st of every month" },
        { chunk_id: "c_a2", filename: "Bank_Statement_Oct.pdf", score: 0.68, text: "ADOBE SYSTEMS - ₹4,230.42 recurring debit on 01-Oct-2024" }
      ]
    },
    "104": {
      id: 104, query: "Compare salary slips Q2 vs Q3", latency_ms: 510, mode: "hybrid", sql_used: true, chunks_retrieved: 2,
      answer: "September salary: Gross ₹1,25,000, Net ₹1,01,500. Your salary has remained consistent. PF and tax deductions are standard at 12% and 6.8% respectively.",
      retrieved_chunks: [
        { chunk_id: "c_s1", filename: "Salary_Slip_Sep_2024.pdf", score: 0.85, text: "Salary Slip - September 2024. Gross: ₹1,25,000. Deductions: PF ₹15,000 + Tax ₹8,500. Net Pay: ₹1,01,500" },
        { chunk_id: "c_s2", filename: "Bank_Statement_Oct.pdf", score: 0.72, text: "NEFT credit ₹1,01,500 from EMPLOYER on 01-Oct-2024" }
      ]
    },
    "105": {
      id: 105, query: "Show all travel receipts above ₹5000", latency_ms: 380, mode: "hybrid", sql_used: true, chunks_retrieved: 1,
      answer: "No individual travel transactions above ₹5,000 found. Your transport spending this month: Uber ₹280, Ola ₹350, Metro ₹500, Fuel ₹2,400. Total: ₹3,530.",
      retrieved_chunks: [
        { chunk_id: "c_t1", filename: "Bank_Statement_Oct.pdf", score: 0.73, text: "Uber ₹280, Ola ₹350, Metro recharge ₹500, Fuel ₹2,400 - October transport expenses" }
      ]
    }
  };

  const result = queries[id] || {
    id: Number(id), query: "Unknown query", latency_ms: 0, mode: "hybrid", sql_used: false, chunks_retrieved: 0,
    answer: "No data available for this query ID.",
    retrieved_chunks: []
  };

  return NextResponse.json(result);
}
