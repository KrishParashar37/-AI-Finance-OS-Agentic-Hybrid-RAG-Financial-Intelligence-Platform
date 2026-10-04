"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { api, useApi } from "@/hooks/useApi";
import { timeAgo, cn } from "@/lib/format";
import type { Notif } from "@/lib/types";

export const NOTIF_ICON = { info: Info, warning: AlertTriangle, success: CheckCircle2, alert: ShieldAlert } as const;
export const NOTIF_COLOR = { info: "text-sky-500 bg-sky-500/10", warning: "text-amber-500 bg-amber-500/10", success: "text-emerald-500 bg-emerald-500/10", alert: "text-rose-500 bg-rose-500/10" } as const;

export function NotificationBell() {
  const q = useApi<Notif[]>("/api/resources/notifications");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { reload } = q;
  useEffect(() => {
    reload();
  }, [pathname, reload]);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const list = q.data ?? [];
  const unread = list.filter((n) => !n.read).length;
  const markAll = async () => {
    await api.patch("/api/resources/notifications", { set: { read: true } });
    reload();
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost relative !p-2.5" aria-label={`Notifications (${unread} unread)`} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="fixed top-16 right-3 z-50 w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:top-full sm:right-0 sm:mt-2 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <p className="font-semibold">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs font-medium text-indigo-500 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {list.length === 0 && <p className="p-8 text-center text-sm text-slate-500">You&apos;re all caught up 🎉</p>}
              {list.slice(0, 6).map((n) => {
                const Icon = NOTIF_ICON[n.type as keyof typeof NOTIF_ICON] ?? Info;
                return (
                  <div key={n.id} className={cn("flex gap-3 px-4 py-3", !n.read && "bg-indigo-50/60 dark:bg-white/[0.04]")}>
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", NOTIF_COLOR[n.type as keyof typeof NOTIF_COLOR])}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-500">{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 py-3 text-center text-sm font-medium text-indigo-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
              View all notifications
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
