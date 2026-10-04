import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { amount, receipt } = await req.json();

    // Using the test keys provided directly to avoid .env restart issues
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_TjlwoF47XqQu32";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "CyDBsv2J2WEt13TDcurAzNlw";

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Razorpay accepts amount in paise
        currency: "INR",
        receipt: receipt || `receipt_${Date.now()}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
