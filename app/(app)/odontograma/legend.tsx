"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { ESTADO_DIENTE, ESTADOS_ORDEN } from "./tooth-config";

export function Legend() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3 dark:bg-surface/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between sm:pointer-events-none"
      >
        <span className="text-[13px] font-bold uppercase tracking-wide text-muted">
          Leyenda
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform sm:hidden ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`mt-2 flex-wrap gap-x-4 gap-y-1.5 ${open ? "flex" : "hidden"} sm:flex`}>
        {ESTADOS_ORDEN.map((e) => {
          const cfg = ESTADO_DIENTE[e];
          return (
            <span key={e} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <span
                className="h-3 w-3 rounded-full ring-1 ring-inset ring-black/10"
                style={{ background: cfg.fill }}
              />
              {cfg.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
