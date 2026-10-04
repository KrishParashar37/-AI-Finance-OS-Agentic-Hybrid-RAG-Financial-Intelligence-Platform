"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Moon, Search, Settings, ShieldCheck, Sparkles, Sun, User } from "lucide-react";
import { usePalette, useSettings } from "@/components/providers";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Logo } from "@/components/sidebar/Sidebar";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { setOpen } = usePalette();
  const { dark, toggleTheme, settings } = useSettings();
  const name = (settings.profile?.name as string) ?? "Krish";
  const email = (settings.profile?.email as string) ?? "";
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-slate-200/70 bg-[var(--bg)]/80 px-4 backdrop-blur-xl md:gap-3 md:px-8 dark:border-white/10">
      <div className="md:hidden">
        <Logo compact />
      </div>
      <button onClick={() => setOpen(true)} className="hidden h-10 max-w-md flex-1 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3.5 text-sm text-slate-400 transition hover:border-slate-300 md:flex dark:border-white/10 dark:bg-white/5" aria-label="Open search (Ctrl+K)">
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search transactions, pages…</span>
        <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] dark:border-white/10">Ctrl K</kbd>
      </button>
      <div className="flex-1 md:hidden" />
      <button onClick={() => setOpen(true)} className="btn btn-ghost !p-2.5 md:hidden" aria-label="Search">
        <Search className="h-5 w-5" />
      </button>
      <div className="hidden flex-1 md:block" />
      <button onClick={toggleTheme} className="btn btn-ghost !p-2.5" aria-label="Toggle theme">
        {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <NotificationBell />
      <Link href="/ai" className="btn btn-primary hidden !px-3.5 sm:inline-flex">
        <Sparkles className="h-4 w-4" /> AI
      </Link>
      <div className="relative" ref={ref}>
        <button onClick={() => setMenu((m) => !m)} className="bg-grad grid h-10 w-10 cursor-pointer place-items-center rounded-full text-sm font-bold text-white" aria-label="Account menu" aria-expanded={menu}>
          {name[0]}
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={() => setMenu(false)}>
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-slate-500">{email}</p>
              </div>
              <div className="my-1 h-px bg-slate-100 dark:bg-white/10" />
              {[
                { href: "/settings/profile", label: "Profile", icon: User },
                { href: "/settings", label: "Settings", icon: Settings },
                { href: "/ai/anomalies", label: "Security Center", icon: ShieldCheck },
              ].map((i) => (
                <Link key={i.href} href={i.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/10">
                  <i.icon className="h-4 w-4" /> {i.label}
                </Link>
              ))}
              <div className="my-1 h-px bg-slate-100 dark:bg-white/10" />
              <button onClick={async () => { await signOut(auth); router.push("/login"); }} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
