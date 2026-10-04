"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body && !isForm ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data as T;
}

const body = (b: unknown) => (b instanceof FormData ? b : JSON.stringify(b ?? {}));

export const api = {
  get: <T,>(url: string) => request<T>(url),
  post: <T,>(url: string, b?: unknown) => request<T>(url, { method: "POST", body: body(b) }),
  patch: <T,>(url: string, b?: unknown) => request<T>(url, { method: "PATCH", body: body(b) }),
  put: <T,>(url: string, b?: unknown) => request<T>(url, { method: "PUT", body: body(b) }),
  del: <T,>(url: string) => request<T>(url, { method: "DELETE" }),
};

export type Query<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T | null) => void;
};

export function useApi<T>(url: string | null): Query<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const d = await request<T>(url);
      if (id === reqId.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
