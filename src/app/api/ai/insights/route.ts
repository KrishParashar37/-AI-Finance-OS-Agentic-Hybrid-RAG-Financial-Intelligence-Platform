import { route } from "@/lib/api";
import { getInsights } from "@/lib/ai";

export const dynamic = "force-dynamic";

export const GET = route(async () => getInsights());
