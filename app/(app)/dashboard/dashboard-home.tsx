"use client";

import {
  CalendarCheck,
  Users,
  DollarSign,
  Activity,
  Rocket,
} from "lucide-react";
import { greeting } from "@/lib/utils";
import { KPICard } from "@/components/ui/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Stagger, StaggerItem } from "@/components/motion/stagger";

export function DashboardHome({ nombre }: { nombre: string }) {
  const firstName = nombre.replace(/^(Dr|Dra|Lic)\.?\s+/i, "").split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{greeting()},</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {nombre}
          </h1>
        </div>
        <Badge variant="clinical" dot>
          Fundación activa · Tanda 1 de 18
        </Badge>
      </div>

      {/* KPIs de muestra — se conectan a datos reales en la Tanda 2 */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <KPICard
            label="Citas de hoy"
            value={14}
            icon={CalendarCheck}
            trend={8.3}
            accent="clinical"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Pacientes activos"
            value={1287}
            icon={Users}
            trend={4.1}
            accent="mint"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Ingresos del mes"
            value={842500}
            prefix="RD$ "
            icon={DollarSign}
            trend={12.6}
            accent="gold"
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Tratamientos activos"
            value={63}
            icon={Activity}
            trend={-2.4}
            accent="amber"
          />
        </StaggerItem>
      </Stagger>

      <Card>
        <CardContent className="pt-5">
          <EmptyState
            icon={Rocket}
            title={`La fundación está lista, ${firstName}`}
            description="Login, welcome cinemático, design system, layout y seguridad Fort Knox ya están en pie. El Dashboard completo con banda de citas, acciones rápidas y actividad en vivo llega en la Tanda 2."
          />
        </CardContent>
      </Card>
    </div>
  );
}
