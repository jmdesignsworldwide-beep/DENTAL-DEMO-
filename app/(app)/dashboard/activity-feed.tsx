"use client";

import { Activity, Receipt, CalendarDays, UserRound } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { initials, relativeTime } from "@/lib/utils";
import type { ActividadItem } from "@/lib/dashboard";

const entityIcon: Record<string, typeof Activity> = {
  invoice: Receipt,
  appointment: CalendarDays,
  patient: UserRound,
};

export function ActivityFeed({ actividad }: { actividad: ActividadItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-[18px] w-[18px] text-clinical" />
          Actividad reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actividad.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sin actividad reciente"
            description="Las acciones del equipo (citas, pagos, registros) aparecerán aquí en tiempo real."
          />
        ) : (
          <ul className="space-y-1">
            {actividad.map((a) => {
              const Icon = a.entity ? entityIcon[a.entity] ?? Activity : Activity;
              return (
                <li key={a.id} className="flex items-start gap-3 py-2">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-clinical-400 to-clinical-700 text-[11px] font-bold text-white">
                    {initials(a.actor)}
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-clinical ring-2 ring-surface">
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-fg">
                      <span className="font-bold">{a.actor}</span>{" "}
                      <span className="text-fg/80">{a.action}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {relativeTime(a.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
