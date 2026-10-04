import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "AI Expense Scanner — Intelligent Personal Finance Platform",
  description: "Scan. Understand. Predict. Save. An AI finance OS with receipt OCR, analytics, budgets and an AI assistant.",
};

export const viewport: Viewport = { themeColor: "#6366f1" };

const initScript = `(function(){try{var t=localStorage.getItem('ai-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var a=localStorage.getItem('ai-accent');if(a)document.documentElement.setAttribute('data-accent',a);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
