"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Modal } from "@/components/modals/Modal";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };
type ConfirmOpts = { title: string; message?: string; confirmText?: string; danger?: boolean };

type Ctx = {
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
  confirm: (o: ConfirmOpts) => Promise<boolean>;
};
const FeedbackCtx = createContext<Ctx | null>(null);

export function useToast() {
  return useContext(FeedbackCtx)!.toast;
}
export function useConfirm() {
  return useContext(FeedbackCtx)!.confirm;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const idRef = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const toast = useRef({
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    info: (m: string) => push("info", m),
  }).current;

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  const icons = { success: CheckCircle2, error: XCircle, info: Info };
  const colors = { success: "text-emerald-500", error: "text-rose-500", info: "text-sky-500" };

  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-24 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 md:bottom-6">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                role="status"
                className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-sm shadow-xl dark:border-white/10 dark:bg-slate-900"
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${colors[t.kind]}`} />
                <p className="flex-1 text-slate-700 dark:text-slate-200">{t.message}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <Modal open={!!dialog} onClose={() => close(false)} title={dialog?.title ?? ""} size="sm">
        <div className="flex gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${dialog?.danger ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20"}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{dialog?.message ?? "Are you sure you want to continue?"}</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={() => close(false)}>
            Cancel
          </button>
          <button className={`btn ${dialog?.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)} autoFocus>
            {dialog?.confirmText ?? "Confirm"}
          </button>
        </div>
      </Modal>
    </FeedbackCtx.Provider>
  );
}
