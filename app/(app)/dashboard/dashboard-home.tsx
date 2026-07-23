"use client";

import { Badge } from "@/components/ui/badge";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { greeting } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard";
import { KPIGrid } from "./kpi-grid";
import { AppointmentBand } from "./appointment-band";
import { QuickActions } from "./quick-actions";
import { UpcomingList } from "./upcoming-list";
import { ActivityFeed } from "./activity-feed";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

export function DashboardHome({
  nombre,
  data,
}: {
  nombre: string;
  data: DashboardData;
}) {
  return (
    <Stagger className="mx-auto max-w-6xl space-y-8">
      {/* Encabezado */}
      <StaggerItem>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted">{greeting()},</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              {nombre}
            </h1>
          </div>
          <Badge variant="clinical" dot>
            {data.citasHoy.length} citas hoy · {data.kpis.tratamientosPendientes}{" "}
            pendientes
          </Badge>
        </div>
      </StaggerItem>

      {/* KPIs */}
      <StaggerItem>
        <KPIGrid kpis={data.kpis} canSeeIncome={data.canSeeIncome} />
      </StaggerItem>

      {/* Banda de citas de hoy */}
      <StaggerItem>
        <SectionTitle>Citas de hoy</SectionTitle>
        <AppointmentBand citas={data.citasHoy} />
      </StaggerItem>

      {/* Acciones rápidas */}
      <StaggerItem>
        <SectionTitle>Acciones rápidas</SectionTitle>
        <QuickActions />
      </StaggerItem>

      {/* Próximas + Actividad */}
      <StaggerItem>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UpcomingList proximas={data.proximas} />
          <ActivityFeed actividad={data.actividad} />
        </div>
      </StaggerItem>
    </Stagger>
  );
}
