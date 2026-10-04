import { NextResponse } from "next/server";

export async function POST() {
  // Simulate re-indexing delay
  await new Promise(r => setTimeout(r, 1000));
  return NextResponse.json({ success: true, message: "Re-indexing started for 142 documents" });
}
