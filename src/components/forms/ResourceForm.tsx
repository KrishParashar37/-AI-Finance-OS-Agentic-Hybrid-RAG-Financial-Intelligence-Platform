"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Field } from "@/components/forms";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
  options?: (string | { value: string; label: string })[];
  required?: boolean;
  min?: number;
  placeholder?: string;
  span?: 1 | 2;
  hint?: string;
};

export function ResourceForm({
  fields,
  initial = {},
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  fields: FieldDef[];
  initial?: Record<string, unknown>;
  submitLabel?: string;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<Record<string, unknown>>(() => {
    const o: Record<string, unknown> = {};
    for (const f of fields) o[f.key] = initial[f.key] ?? (f.type === "checkbox" ? false : f.type === "select" ? (typeof f.options?.[0] === "string" ? f.options?.[0] : (f.options?.[0] as { value: string } | undefined)?.value ?? "") : "");
    return o;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const val = v[f.key];
      if (f.required && (val === "" || val === undefined || val === null)) errs[f.key] = `${f.label} is required`;
      if (f.type === "number" && val !== "") {
        const n = Number(val);
        if (Number.isNaN(n)) errs[f.key] = "Enter a valid number";
        else if (f.min !== undefined && n < f.min) errs[f.key] = `Must be at least ${f.min}`;
        out[f.key] = n;
      } else out[f.key] = val;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await onSubmit(out);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      {fields.map((f) => {
        const cls = f.span === 2 || f.type === "textarea" ? "sm:col-span-2" : "";
        if (f.type === "checkbox")
          return (
            <label key={f.key} className={`flex cursor-pointer items-center gap-3 ${cls || "sm:col-span-2"}`}>
              <input type="checkbox" className="h-4 w-4 accent-indigo-500" checked={!!v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} />
              <span className="text-sm">{f.label}</span>
            </label>
          );
        return (
          <Field key={f.key} label={f.label} error={errors[f.key]} hint={f.hint} className={cls}>
            {f.type === "select" ? (
              <select className="input" value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                {f.options?.map((o) => (typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea className="input min-h-20" value={String(v[f.key] ?? "")} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            ) : (
              <input className="input" type={f.type} min={f.min} step={f.type === "number" ? "any" : undefined} value={String(v[f.key] ?? "")} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            )}
          </Field>
        );
      })}
      <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary min-w-28" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</button>
      </div>
    </form>
  );
}
