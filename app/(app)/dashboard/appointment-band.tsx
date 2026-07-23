"use client";

import { useRouter } from "next/navigation";
import { CalendarX2, Clock, Stethoscope, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatHora } from "@/lib/utils";
import type { CitaHoy } from "@/lib/dashboard";
import { ESTADO } from "./estado-config";

export function AppointmentBand({ citas }: { citas: CitaHoy[] }) {
  const router = useRouter();

  if (citas.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarX2}
          title="No hay citas para hoy"
          description="Cuando agendes citas para hoy aparecerán aquí, ordenadas por hora y con su estado en vivo."
        />
      </Card>
    );
  }

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
      {citas.map((c) => {
        const st = ESTADO[c.estado];
        return (
          <button
            key={c.id}
            onClick={() => router.push("/citas?view=dia")}
            className="group relative min-w-[240px] shrink-0 overflow-hidden rounded-2xl border border-border bg-surface p-4 text-left shadow-card transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:shadow-card-hover sm:min-w-0 dark:bg-surface/80"
          >
            <span
              className={`absolute inset-y-0 left-0 w-1 ${st.bar}`}
              aria-hidden
            />
            <div className="flex items-center justify-between pl-1.5">
              <span className="flex items-center gap-1.5 text-sm font-bold text-fg tabular">
                <Clock className="h-3.5 w-3.5 text-muted" />
                {formatHora(c.hora)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${st.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 truncate pl-1.5 text-[15px] font-bold tracking-tight text-fg">
              <User className="h-4 w-4 shrink-0 text-clinical" />
              {c.paciente}
            </p>
            <p className="mt-1 flex items-center gap-1.5 truncate pl-1.5 text-sm text-muted">
              <Stethoscope className="h-3.5 w-3.5 shrink-0" />
              {c.tratamiento}
            </p>
            {c.dentista && (
              <p className="mt-2 truncate pl-1.5 text-xs font-medium text-muted/80">
                {c.dentista}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
