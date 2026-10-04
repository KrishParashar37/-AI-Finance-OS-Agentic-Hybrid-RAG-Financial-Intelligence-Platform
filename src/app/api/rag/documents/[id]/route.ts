import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const docs: Record<string, any> = {
    doc_1: {
      id: "doc_1", filename: "Amazon_Receipt_Laptop.pdf", doc_type: "receipt", char_count: 4500, chunk_count: 8, status: "indexed",
      createdAt: new Date().toISOString(),
      raw_text_preview: "ORDER CONFIRMATION\nAmazon.in Order #408-1234567-8901234\nDate: October 25, 2024\n\nShipping Address: Krish Patel, 42 MG Road, Bangalore 560001\n\nItems Ordered:\n1. Apple MacBook Air M2 (13.6 inch, 8GB RAM, 256GB SSD)\n   Qty: 1 | Price: ₹89,990.00\n2. Apple USB-C Digital AV Multiport Adapter\n   Qty: 1 | Price: ₹5,900.00\n3. Laptop Sleeve 13 inch - Navy Blue\n   Qty: 1 | Price: ₹799.00\n\nSubtotal: ₹96,689.00\nDiscount (Festive Sale): -₹7,500.00\nDelivery: FREE\nTotal: ₹89,189.00\nPaid via: HDFC Credit Card ending 4532\n\nEstimated Delivery: October 28-30, 2024",
      chunks: [
        { id: "c1", index: 1, chars: 180, text: "ORDER CONFIRMATION - Amazon.in Order #408-1234567-8901234, Date: October 25, 2024. Shipping Address: Krish Patel, 42 MG Road, Bangalore 560001" },
        { id: "c2", index: 2, chars: 210, text: "Items Ordered: 1. Apple MacBook Air M2 (13.6 inch, 8GB RAM, 256GB SSD) - Qty: 1, Price: ₹89,990.00" },
        { id: "c3", index: 3, chars: 160, text: "2. Apple USB-C Digital AV Multiport Adapter - Qty: 1, Price: ₹5,900.00. 3. Laptop Sleeve 13 inch Navy Blue - Qty: 1, Price: ₹799.00" },
        { id: "c4", index: 4, chars: 150, text: "Subtotal: ₹96,689.00. Discount (Festive Sale): -₹7,500.00. Delivery: FREE. Total: ₹89,189.00" },
        { id: "c5", index: 5, chars: 120, text: "Payment Method: HDFC Credit Card ending 4532. Estimated Delivery: October 28-30, 2024" },
        { id: "c6", index: 6, chars: 100, text: "Category: Electronics. Merchant: Amazon.in. Payment Status: Paid. Delivery Status: Shipped" },
        { id: "c7", index: 7, chars: 90, text: "Order contains high-value electronics purchase. Flagged for warranty tracking." },
        { id: "c8", index: 8, chars: 80, text: "GST Invoice attached. GSTIN: 29AABCT1234Z1Z5. Tax Amount: ₹13,600.00" },
      ]
    }
  };

  const doc = docs[id] || {
    id, filename: `Document_${id}.pdf`, doc_type: "receipt", char_count: 2500, chunk_count: 4, status: "indexed",
    createdAt: new Date().toISOString(),
    raw_text_preview: "This is a sample document that has been indexed into the RAG knowledge base.\n\nThe document contains financial information including transaction details, amounts, and merchant data.\n\nAll text has been extracted, chunked, and embedded for semantic search.",
    chunks: [
      { id: "c1", index: 1, chars: 150, text: "Sample document header with metadata and transaction information." },
      { id: "c2", index: 2, chars: 200, text: "Main body of the document containing financial details, amounts and descriptions." },
      { id: "c3", index: 3, chars: 120, text: "Summary section with totals, payment methods and dates." },
      { id: "c4", index: 4, chars: 80, text: "Footer with legal notices and contact information." },
    ]
  };

  return NextResponse.json(doc);
}

export async function DELETE(req: Request, { params }: Ctx) {
  await params;
  await new Promise(r => setTimeout(r, 500));
  return NextResponse.json({ success: true });
}
