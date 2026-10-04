"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronsLeft, ChevronsRight, ScanLine, Settings } from "lucide-react";
import { NAV, isActive } from "@/lib/nav";
import { cn } from "@/lib/format";
import { Tooltip } from "@/components/ui";
import { useSettings } from "@/components/providers";

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="bg-grad grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/30">
        <ScanLine className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight">AI EXPENSE</span>
          <span className="text-grad block text-sm font-bold tracking-tight">SCANNER</span>
        </span>
      )}
    </Link>
  );
}

type NavGroup = { title: string; items: typeof NAV };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      NAV.find((n) => n.label === "Dashboard")!,
      NAV.find((n) => n.label === "Scan")!,
    ],
  },
  {
    title: "Finance",
    items: [
      NAV.find((n) => n.label === "Expenses")!,
      NAV.find((n) => n.label === "Income")!,
      NAV.find((n) => n.label === "Accounts")!,
    ],
  },
  {
    title: "AI & Insights",
    items: [
      NAV.find((n) => n.label === "Analytics")!,
      NAV.find((n) => n.label === "AI")!,
      NAV.find((n) => n.label === "RAG")!,
      NAV.find((n) => n.label === "Security")!,
    ],
  },
  {
    title: "Tracking",
    items: [
      NAV.find((n) => n.label === "Budgets")!,
      NAV.find((n) => n.label === "Subscriptions")!,
      NAV.find((n) => n.label === "Bills")!,
      NAV.find((n) => n.label === "Invoices")!,
      NAV.find((n) => n.label === "Goals")!,
    ],
  },
  {
    title: "General",
    items: [
      NAV.find((n) => n.label === "Shared")!,
      NAV.find((n) => n.label === "Reports")!,
      { label: "Notifications", href: "/notifications", icon: Bell } as (typeof NAV)[number],
      { label: "Settings", href: "/settings", icon: Settings } as (typeof NAV)[number],
    ],
  },
];

export function NavList({ collapsed, onNavigate, forceLabels }: { collapsed?: boolean; onNavigate?: () => void; forceLabels?: boolean }) {
  const pathname = usePathname();
  const showLabel = forceLabels || !collapsed;

  return (
    <nav className="space-y-5" aria-label="Main navigation">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          {/* Section header — only visible when labels are shown */}
          {showLabel && (
            <p className={cn(
              "mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500",
              !forceLabels && collapsed ? "hidden" : "",
              !forceLabels && !collapsed ? "hidden lg:block" : ""
            )}>
              {group.title}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === "/notifications"
                ? pathname.startsWith("/notifications")
                : isActive(item as (typeof NAV)[number], pathname);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    forceLabels ? "justify-start" : collapsed ? "justify-center" : "justify-center lg:justify-start",
                    active
                      ? "bg-grad text-white shadow-md shadow-indigo-500/25"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className={forceLabels ? "" : collapsed ? "hidden" : "hidden lg:inline"}>
                    {item.label}
                  </span>
                </Link>
              );
              return forceLabels ? (
                <div key={item.href}>{link}</div>
              ) : (
                <div key={item.href} className={collapsed ? "" : "lg:hidden"}>
                  <Tooltip text={item.label}>{link}</Tooltip>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const name = (settings.profile?.name as string) ?? "Krish";
  return (
    <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200/70 bg-white/70 backdrop-blur-xl transition-[width] duration-300 md:flex dark:border-white/10 dark:bg-slate-950/40", collapsed ? "w-[76px]" : "w-64")}>
      <div className={cn("flex h-16 items-center px-4", collapsed ? "justify-center" : "justify-start")}>
        <div className={!collapsed ? "block" : "hidden"}><Logo /></div>
        <div className={cn(collapsed ? "block" : "hidden")}>
          <Logo compact />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
        <nav className="space-y-5" aria-label="Main navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className={cn(
                "mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500",
                collapsed ? "hidden" : "block"
              )}>
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === "/notifications"
                    ? pathname.startsWith("/notifications")
                    : isActive(item as (typeof NAV)[number], pathname);
                  return (
                    <Tooltip key={item.href} text={item.label}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          collapsed ? "justify-center" : "justify-start",
                          active
                            ? "bg-grad text-white shadow-md shadow-indigo-500/25"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className={collapsed ? "hidden" : "inline"}>{item.label}</span>
                      </Link>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-slate-200/70 p-3 dark:border-white/10">
        <div className={cn("flex items-center gap-3 rounded-xl p-2", collapsed ? "justify-center" : "justify-start")}>
          <span className="bg-grad grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white">{name[0]}</span>
          <div className={cn("min-w-0 leading-tight", collapsed ? "hidden" : "block")}>
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-slate-500">Pro · AI Finance OS</p>
          </div>
        </div>
        <button onClick={onToggle} className="btn btn-ghost mt-1 hidden w-full md:flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}
