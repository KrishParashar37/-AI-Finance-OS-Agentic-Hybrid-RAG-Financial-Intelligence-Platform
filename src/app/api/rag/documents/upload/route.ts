import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Mock upload delay
  await new Promise(r => setTimeout(r, 1500));
  return NextResponse.json({ success: true, message: "Document uploaded and processing" });
}
