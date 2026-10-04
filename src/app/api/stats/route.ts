import type { NextRequest } from "next/server";
import { route } from "@/lib/api";
import { getStats } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const p = req.nextUrl.searchParams;
  return getStats(p.get("range") ?? "30d", p.get("from"), p.get("to"));
});
