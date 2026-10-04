"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bot, ChevronRight, CreditCard, Home, Menu, ScanLine } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Sidebar, NavList, Logo } from "@/components/sidebar/Sidebar";
import { Navbar } from "@/components/navbar/Navbar";
import { Drawer } from "@/components/modals/Modal";
import { SEGMENT_LABELS } from "@/lib/nav";
import { cn } from "@/lib/format";

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const crumbs = parts
    .map((p, i) => ({ label: /^\d+$/.test(p) ? "Details" : (SEGMENT_LABELS[p] ?? p), href: "/" + parts.slice(0, i + 1).join("/"), raw: p }))
    // "result" is not a standalone page
    .filter((c) => c.raw !== "result");
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-500">
      <Link href="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {i === crumbs.length - 1 ? <span className="font-medium text-slate-800 dark:text-slate-200">{c.label}</span> : <Link href={c.href} className="hover:text-slate-900 dark:hover:text-white">{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Home", icon: Home, active: pathname === "/" },
    { href: "/scanner", label: "Scan", icon: ScanLine, active: pathname.startsWith("/scanner") },
    { href: "/expenses", label: "Expenses", icon: CreditCard, active: pathname.startsWith("/expenses") },
    { href: "/ai", label: "AI", icon: Bot, active: pathname.startsWith("/ai") && !pathname.startsWith("/ai/anomalies") },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-950/90" aria-label="Bottom navigation">
      <div className="grid grid-cols-5">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={i.active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", i.active ? "text-indigo-500" : "text-slate-500")}>
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
        <button onClick={onMore} className="flex cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-500" aria-label="More">
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed, setCollapsed]   = useState(false);
  const [more, setMore]             = useState(false);
  const [authState, setAuthState]   = useState<"checking" | "authed" | "unauthed">("checking");

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthState("authed");
      } else {
        setAuthState("unauthed");
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });

  // Show spinner while checking auth
  if (authState !== "authed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500">
            {authState === "checking" ? "Loading..." : "Redirecting to login..."}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 -left-40 h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl" />
      </div>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={cn("transition-[padding] duration-300", collapsed ? "md:pl-[76px]" : "md:pl-64")}>
        <Navbar />
        <main className="mx-auto max-w-[1500px] px-4 pt-5 pb-28 md:px-8 md:pb-10">
          <Breadcrumbs />
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            {children}
          </motion.div>
        </main>
      </div>
      <BottomNav onMore={() => setMore(true)} />
      <Drawer open={more} onClose={() => setMore(false)} title="Menu" side="left">
        <div className="mb-4">
          <Logo />
        </div>
        <NavList forceLabels onNavigate={() => setMore(false)} />
      </Drawer>
    </div>
  );
}
