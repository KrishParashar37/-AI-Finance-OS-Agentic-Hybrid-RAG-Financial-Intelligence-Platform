import { ensureSeeded } from "@/db/seed";

/** Wraps a route handler: ensures demo data exists, serialises results, handles errors. */
export function route<A extends unknown[]>(fn: (...a: A) => Promise<unknown>) {
  return async (...a: A): Promise<Response> => {
    try {
      await ensureSeeded();
      const r = await fn(...a);
      return r instanceof Response ? r : Response.json(r);
    } catch (e) {
      console.error(e);
      return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
    }
  };
}

export const bad = (message: string, status = 400) => Response.json({ error: message }, { status });
