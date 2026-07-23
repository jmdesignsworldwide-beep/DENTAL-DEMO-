"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

export function SectionShell({
  title, description, children, aside,
}: {
  title: string; description?: string; children: React.ReactNode; aside?: React.ReactNode;
}) {
  return (
    <div className={aside ? "grid gap-5 lg:grid-cols-[1fr_360px]" : ""}>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-lg font-extrabold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        <div className="mt-4 space-y-4">{children}</div>
      </div>
      {aside && <div className="lg:sticky lg:top-24 lg:self-start">{aside}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-[12px] font-bold text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted outline-none focus:ring-2 focus:ring-clinical/30";

export function SaveButton({ dirty, pending, onClick, label = "Guardar cambios" }: { dirty: boolean; pending: boolean; onClick: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        onClick={onClick}
        disabled={!dirty || pending}
        className="inline-flex items-center gap-2 rounded-xl bg-clinical px-5 py-2.5 text-sm font-bold text-white shadow-card transition-all hover:bg-clinical-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {label}
      </button>
      {dirty && !pending && (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" /> Cambios sin guardar
        </motion.span>
      )}
    </div>
  );
}

/** Advierte al cerrar/recargar si hay cambios sin guardar. */
export function useUnsavedWarning(dirty: boolean) {
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
