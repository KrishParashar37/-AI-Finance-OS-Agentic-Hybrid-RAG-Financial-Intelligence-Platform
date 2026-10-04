import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const topK = Number(url.searchParams.get("top_k")) || 8;

  await new Promise(r => setTimeout(r, 600));

  // Simulate search results based on query keywords
  const allResults = [
    { chunk_id: "c_e1", document_id: "doc_1", filename: "Amazon_Receipt_Laptop.pdf", doc_type: "receipt", chunk_index: 2, text: "Apple MacBook Air M2 (13.6 inch, 8GB RAM, 256GB SSD) purchased on October 25, 2024 for ₹89,990.00 from Amazon.in", score: 0.94 },
    { chunk_id: "c_e2", document_id: "doc_1", filename: "Amazon_Receipt_Laptop.pdf", doc_type: "receipt", chunk_index: 3, text: "Accessories purchased: Apple USB-C Digital AV Multiport Adapter ₹5,900.00, Laptop Sleeve ₹799.00", score: 0.81 },
    { chunk_id: "c_e3", document_id: "doc_2", filename: "Bank_Statement_Oct.pdf", doc_type: "bank_statement", chunk_index: 12, text: "AMAZON.IN purchase debit ₹89,189.00 on 25-Oct-2024 via HDFC Credit Card ending 4532", score: 0.76 },
    { chunk_id: "c_f1", document_id: "doc_2", filename: "Bank_Statement_Oct.pdf", doc_type: "bank_statement", chunk_index: 5, text: "Swiggy food order ₹450.00 on 15-Oct-2024. Zomato delivery ₹680.00 on 18-Oct-2024", score: 0.88 },
    { chunk_id: "c_f2", document_id: "doc_2", filename: "Bank_Statement_Oct.pdf", doc_type: "bank_statement", chunk_index: 8, text: "McDonald's ₹320.00. Domino's Pizza ₹540.00. Starbucks ₹280.00 - total dining expenses October", score: 0.82 },
    { chunk_id: "c_a1", document_id: "doc_3", filename: "Adobe_Subscription_Invoice.pdf", doc_type: "invoice", chunk_index: 1, text: "Adobe Creative Cloud All Apps subscription. Monthly: ₹4,230.42 (incl. GST). Billing date: 1st of every month. Account: krish@email.com", score: 0.91 },
    { chunk_id: "c_s1", document_id: "doc_5", filename: "Salary_Slip_Sep_2024.pdf", doc_type: "salary_slip", chunk_index: 1, text: "Salary Slip - September 2024. Gross: ₹1,25,000. Deductions: PF ₹15,000 + Tax ₹8,500. Net Pay: ₹1,01,500", score: 0.85 },
    { chunk_id: "c_p1", document_id: "doc_6", filename: "Flipkart_Receipt_Phone.jpg", doc_type: "receipt", chunk_index: 2, text: "Samsung Galaxy S24 Ultra 256GB - ₹1,29,999.00 purchased on Flipkart Big Billion Days sale", score: 0.79 },
    { chunk_id: "c_t1", document_id: "doc_2", filename: "Bank_Statement_Oct.pdf", doc_type: "bank_statement", chunk_index: 15, text: "Uber ride ₹280 on 10-Oct. Ola cab ₹350 on 12-Oct. Metro card recharge ₹500 on 01-Oct. Fuel ₹2,400 on 20-Oct", score: 0.73 },
    { chunk_id: "c_cc1", document_id: "doc_7", filename: "HDFC_Credit_Card_Statement.pdf", doc_type: "credit_card_statement", chunk_index: 5, text: "Large transaction alert: ₹89,189 at Amazon.in on 25-Oct-2024. Credit limit utilization: 45%", score: 0.71 },
    { chunk_id: "c_i1", document_id: "doc_8", filename: "Zerodha_Investment_Report.pdf", doc_type: "investment_statement", chunk_index: 3, text: "SIP investments: ₹10,000/month in Nifty 50 Index Fund. Total invested: ₹1,20,000. Current value: ₹1,38,400", score: 0.68 },
    { chunk_id: "c_b1", document_id: "doc_9", filename: "Electricity_Bill_Oct.jpg", doc_type: "invoice", chunk_index: 1, text: "BESCOM Electricity Bill - October 2024. Units consumed: 280. Amount due: ₹1,820.00. Due date: 15-Nov-2024", score: 0.65 },
  ];

  // Simple keyword matching to make search feel responsive
  let filtered = allResults;
  if (q.includes("electronic") || q.includes("laptop") || q.includes("phone")) {
    filtered = allResults.filter(r => r.text.toLowerCase().includes("macbook") || r.text.toLowerCase().includes("samsung") || r.text.toLowerCase().includes("electronics"));
  } else if (q.includes("food") || q.includes("dining") || q.includes("restaurant")) {
    filtered = allResults.filter(r => r.text.toLowerCase().includes("swiggy") || r.text.toLowerCase().includes("zomato") || r.text.toLowerCase().includes("mcdonald") || r.text.toLowerCase().includes("domino") || r.text.toLowerCase().includes("food") || r.text.toLowerCase().includes("dining"));
  } else if (q.includes("adobe") || q.includes("subscription")) {
    filtered = allResults.filter(r => r.text.toLowerCase().includes("adobe") || r.text.toLowerCase().includes("subscription"));
  } else if (q.includes("travel") || q.includes("transport")) {
    filtered = allResults.filter(r => r.text.toLowerCase().includes("uber") || r.text.toLowerCase().includes("ola") || r.text.toLowerCase().includes("metro") || r.text.toLowerCase().includes("fuel"));
  } else if (q.includes("salary")) {
    filtered = allResults.filter(r => r.text.toLowerCase().includes("salary"));
  } else if (q.includes("tax")) {
    filtered = allResults.filter(r => r.text.toLowerCase().includes("tax") || r.text.toLowerCase().includes("gst"));
  } else if (q.includes("bank") || q.includes("statement")) {
    filtered = allResults.filter(r => r.doc_type === "bank_statement");
  } else if (q.includes("unusual") || q.includes("large")) {
    filtered = allResults.filter(r => r.text.includes("89,189") || r.text.includes("1,29,999") || r.text.includes("alert"));
  }

  // If no keyword match, return top results
  if (filtered.length === 0) filtered = allResults;

  return NextResponse.json({
    results: filtered.slice(0, topK).map((r, i) => ({ ...r, score: Math.max(0.55, r.score - i * 0.03) }))
  });
}
