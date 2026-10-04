"use client";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/hooks/useApi";
import { setCurrency } from "@/lib/format";
import { FeedbackProvider } from "@/components/feedback";
import { CommandPalette } from "@/components/navbar/CommandPalette";
import { GlobalShortcuts } from "@/components/navbar/GlobalShortcuts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Settings = Record<string, Record<string, any>>;

type SettingsCtx = {
  settings: Settings;
  loaded: boolean;
  save: (key: string, value: Record<string, any>) => Promise<void>;
  dark: boolean;
  toggleTheme: () => void;
};
const Ctx = createContext<SettingsCtx | null>(null);
export const useSettings = () => useContext(Ctx)!;

type PaletteCtx = { open: boolean; setOpen: (v: boolean) => void };
const PCtx = createContext<PaletteCtx>({ open: false, setOpen: () => {} });
export const usePalette = () => useContext(PCtx);

function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({});
  const [loaded, setLoaded] = useState(false);
  const [dark, setDark] = useState(false);
  const [currency, setCur] = useState("INR");

  useEffect(() => {
    api
      .get<Settings>("/api/settings")
      .then((s) => setSettings(s))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(async (key: string, value: Record<string, any>) => {
    setSettings((s) => ({ ...s, [key]: value }));
    await api.put("/api/settings", { key, value });
  }, []);

  const appearance = settings.appearance;
  const privacy = settings.privacy;
  const cur = settings.preferences?.currency as string | undefined;

  useEffect(() => {
    const root = document.documentElement;
    const theme = (appearance?.theme as string) ?? localStorage.getItem("ai-theme") ?? "system";
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const d = theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", d);
      setDark(d);
    };
    apply();
    localStorage.setItem("ai-theme", theme);
    mq.addEventListener("change", apply);
    if (appearance?.accent) {
      root.setAttribute("data-accent", appearance.accent);
      localStorage.setItem("ai-accent", appearance.accent);
    }
    root.setAttribute("data-density", appearance?.density ?? "comfortable");
    root.setAttribute("data-animations", appearance?.animations === false ? "off" : "on");
    root.setAttribute("data-hide-balances", privacy?.hideBalances ? "true" : "false");
    return () => mq.removeEventListener("change", apply);
  }, [appearance, privacy]);

  useEffect(() => {
    if (cur && cur !== currency) {
      setCurrency(cur);
      setCur(cur);
    }
  }, [cur, currency]);

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    save("appearance", { ...(settings.appearance ?? { accent: "indigo", density: "comfortable", animations: true }), theme: next }).catch(() => {});
  }, [save, settings.appearance]);

  const value = useMemo(() => ({ settings, loaded, save, dark, toggleTheme }), [settings, loaded, save, dark, toggleTheme]);
  return (
    <Ctx.Provider value={value}>
      <Fragment key={currency}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsProvider>
      <FeedbackProvider>
        <PCtx.Provider value={{ open, setOpen }}>
          {children}
          <CommandPalette />
          <GlobalShortcuts />
        </PCtx.Provider>
      </FeedbackProvider>
    </SettingsProvider>
  );
}
