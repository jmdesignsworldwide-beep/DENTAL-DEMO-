"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, FileText } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import type { PatientBasic } from "@/lib/appointments";

export function HistoriaPicker({ patients }: { patients: PatientBasic[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return patients.slice(0, 40);
    return patients
      .filter((p) => p.nombre.toLowerCase().includes(s) || (p.telefono ?? "").includes(s))
      .slice(0, 40);
  }, [q, patients]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          Historia clínica
        </h1>
        <p className="text-sm text-muted">
          Selecciona un paciente para ver o registrar su expediente clínico.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar paciente por nombre o teléfono…"
          className="h-12 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg placeholder:text-muted/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 dark:bg-navy-light"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface dark:bg-surface/80">
          <EmptyState icon={FileText} title="Sin pacientes" description="No se encontraron pacientes con ese criterio." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface dark:bg-surface/80">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/historia/${p.id}`)}
              className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-clinical-50/60 dark:hover:bg-clinical-900/20"
            >
              <Avatar nombre={p.nombre} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">{p.nombre}</p>
                <p className="text-xs text-muted tabular">{p.telefono ?? "—"}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
