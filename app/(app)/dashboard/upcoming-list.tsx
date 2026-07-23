"use client";

import { CalendarClock, ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatHora } from "@/lib/utils";
import type { ProximaCita } from "@/lib/dashboard";

function fechaCorta(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - hoy.getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return new Intl.DateTimeFormat("es-DO", {
    weekday: "short",
    day: "numeric",
  }).format(d);
}

export function UpcomingList({ proximas }: { proximas: ProximaCita[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-[18px] w-[18px] text-clinical" />
          Próximas citas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {proximas.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Sin próximas citas"
            description="Las siguientes citas agendadas se listarán aquí."
          />
        ) : (
          <ul className="divide-y divide-border/70">
            {proximas.map((p) => (
              <li
                key={p.id}
                className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-clinical-50 text-clinical dark:bg-clinical-900/40 dark:text-clinical-200">
                  <span className="text-[10px] font-bold uppercase leading-none">
                    {fechaCorta(p.fecha).split(" ")[0]}
                  </span>
                  <span className="text-xs font-bold leading-tight tabular">
                    {formatHora(p.hora)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-fg">
                    {p.paciente}
                  </p>
                  <p className="truncate text-xs text-muted">{p.tratamiento}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
