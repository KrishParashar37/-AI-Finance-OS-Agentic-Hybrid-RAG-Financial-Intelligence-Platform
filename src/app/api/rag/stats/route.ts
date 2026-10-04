import { NextResponse } from "next/server";

export async function GET() {
  // Generate last 7 days of query data
  const daily_queries = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), count: Math.floor(Math.random() * 80) + 20 };
  });

  return NextResponse.json({
    documents: 142,
    chunks: 3504,
    embeddings: 3504,
    queries: 823,
    vector_db: "In-Memory (NumPy cosine)",
    indexed_pct: 100,
    avg_latency_ms: 342,
    cache_hit_rate: 67.5,
    top_doc_types: [
      { type: "receipt", count: 58 },
      { type: "bank_statement", count: 32 },
      { type: "invoice", count: 24 },
      { type: "salary_slip", count: 14 },
      { type: "tax_document", count: 8 },
      { type: "other", count: 6 },
    ],
    daily_queries,
    recent_queries: [
      { id: 101, query: "Show me expensive electronics purchases", mode: "hybrid", latency_ms: 432, chunks: 8, createdAt: new Date().toISOString() },
      { id: 102, query: "What is my total spending on food last month?", mode: "sql", latency_ms: 120, chunks: 0, createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 103, query: "Find receipts from Adobe", mode: "vector", latency_ms: 654, chunks: 12, createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 104, query: "Compare salary slips Q2 vs Q3", mode: "hybrid", latency_ms: 510, chunks: 6, createdAt: new Date(Date.now() - 14400000).toISOString() },
      { id: 105, query: "Show all travel receipts above ₹5000", mode: "hybrid", latency_ms: 380, chunks: 4, createdAt: new Date(Date.now() - 28800000).toISOString() },
    ]
  });
}
