import type { NextConfig } from "next";

/**
 * Frontend ↔ FastAPI link.
 *
 * All `/api/*` requests (fetch calls, the streaming AI chat, the backup
 * download link and multipart uploads) are proxied to the FastAPI backend,
 * which talks to the same MySQL database.
 *
 * - Default target: the FastAPI server on http://127.0.0.1:8000
 * - Override with API_PROXY_TARGET (e.g. a deployed URL)
 * - Disable the proxy (use the built-in Next.js API routes instead) by
 *   setting API_PROXY_TARGET to an empty string.
 */
const rawTarget = process.env.API_PROXY_TARGET;
const apiTarget = rawTarget === undefined ? "http://127.0.0.1:8000" : rawTarget;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiTarget) return [];
    return {
      // RAG routes have no Next.js handler — proxy them to Python backend
      beforeFiles: [
        { source: "/api/rag/:path*",    destination: `${apiTarget}/api/rag/:path*` },
        { source: "/api/health",         destination: `${apiTarget}/api/health` },
      ],
      afterFiles: [],
      // All remaining /api/* routes fall through to Python if no JS handler exists
      fallback: [
        { source: "/api/:path*", destination: `${apiTarget}/api/:path*` },
      ],
    };
  },
};

export default nextConfig;
