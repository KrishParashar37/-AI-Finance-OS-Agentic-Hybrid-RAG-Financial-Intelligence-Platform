"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modals/Modal";
import { usePalette, useSettings } from "@/components/providers";
import { SHORTCUTS } from "@/lib/nav";

const GO: Record<string, string> = { d: "/", e: "/expenses", a: "/analytics", b: "/budgets", i: "/ai", r: "/reports", s: "/settings", g: "/goals" };

export function GlobalShortcuts() {
  const router = useRouter();
  const { open, setOpen } = usePalette();
  const { toggleTheme } = useSettings();
  const [help, setHelp] = useState(false);
  const gPressed = useRef<number>(0);

  useEffect(() => {
    const onShow = () => setHelp(true);
    window.addEventListener("show-shortcuts", onShow);
    return () => window.removeEventListener("show-shortcuts", onShow);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || open) return;
      const k = e.key.toLowerCase();
      if (Date.now() - gPressed.current < 900 && GO[k]) {
        gPressed.current = 0;
        router.push(GO[k]);
        return;
      }
      if (k === "g") gPressed.current = Date.now();
      else if (e.key === "?") setHelp(true);
      else if (e.key === "/") {
        e.preventDefault();
        setOpen(true);
      } else if (k === "n") router.push("/expenses/new");
      else if (k === "s") router.push("/scanner");
      else if (k === "t") toggleTheme();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, router, toggleTheme]);

  return (
    <Modal open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts">
      <ul className="divide-y divide-slate-100 dark:divide-white/10">
        {SHORTCUTS.map((s) => (
          <li key={s.keys} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-slate-600 dark:text-slate-300">{s.action}</span>
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium dark:border-white/10 dark:bg-white/5">{s.keys}</kbd>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
