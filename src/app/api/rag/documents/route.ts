import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    { id: "doc_1", filename: "Amazon_Receipt_Laptop.pdf", doc_type: "receipt", char_count: 4500, chunk_count: 8, status: "indexed", size_kb: 142, createdAt: new Date().toISOString() },
    { id: "doc_2", filename: "Bank_Statement_Oct.pdf", doc_type: "bank_statement", char_count: 12400, chunk_count: 24, status: "indexed", size_kb: 380, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: "doc_3", filename: "Adobe_Subscription_Invoice.pdf", doc_type: "invoice", char_count: 1200, chunk_count: 3, status: "indexed", size_kb: 56, createdAt: new Date(Date.now() - 172800000).toISOString() },
    { id: "doc_4", filename: "Pending_Tax_Form_2024.pdf", doc_type: "tax_document", char_count: 8000, chunk_count: 0, status: "processing", size_kb: 245, createdAt: new Date(Date.now() - 300000).toISOString() },
    { id: "doc_5", filename: "Salary_Slip_Sep_2024.pdf", doc_type: "salary_slip", char_count: 3200, chunk_count: 6, status: "indexed", size_kb: 98, createdAt: new Date(Date.now() - 432000000).toISOString() },
    { id: "doc_6", filename: "Flipkart_Receipt_Phone.jpg", doc_type: "receipt", char_count: 2800, chunk_count: 4, status: "indexed", size_kb: 420, createdAt: new Date(Date.now() - 518400000).toISOString() },
    { id: "doc_7", filename: "HDFC_Credit_Card_Statement.pdf", doc_type: "credit_card_statement", char_count: 15600, chunk_count: 30, status: "indexed", size_kb: 512, createdAt: new Date(Date.now() - 604800000).toISOString() },
    { id: "doc_8", filename: "Zerodha_Investment_Report.pdf", doc_type: "investment_statement", char_count: 9200, chunk_count: 18, status: "indexed", size_kb: 290, createdAt: new Date(Date.now() - 691200000).toISOString() },
    { id: "doc_9", filename: "Electricity_Bill_Oct.jpg", doc_type: "invoice", char_count: 1800, chunk_count: 3, status: "indexed", size_kb: 180, createdAt: new Date(Date.now() - 777600000).toISOString() },
    { id: "doc_10", filename: "Corrupted_Scan.pdf", doc_type: "receipt", char_count: 0, chunk_count: 0, status: "error", size_kb: 12, createdAt: new Date(Date.now() - 864000000).toISOString() },
  ]);
}
