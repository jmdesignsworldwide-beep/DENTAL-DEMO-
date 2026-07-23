"use client";

import Link from "next/link";
import {
  Users,
  CalendarCheck,
  DollarSign,
  ClipboardList,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import { useToast } from "@/components/ui/toast";
import type { DashboardData } from "@/lib/dashboard";

interface KpiDef {
  label: string;
  value: number;
  icon: LucideIcon;
  prefix?: string;
  trend?: number;
  accent: "clinical" | "mint" | "amber" | "gold";
  modulo: string;
  tanda: number;
  href?: string; // si el módulo ya existe, navega en vez de mostrar toast
}

export function KPIGrid({
  kpis,
  canSeeIncome,
}: Pick<DashboardData, "kpis" | "canSeeIncome">) {
  const toast = useToast();

  const tercero: KpiDef =
    canSeeIncome && kpis.ingresosMes !== null
      ? {
          label: "Ingresos este mes",
          value: kpis.ingresosMes,
          icon: DollarSign,
          prefix: "RD$ ",
          trend: kpis.ingresosMesTrend ?? undefined,
          accent: "gold",
          modulo: "Facturación",
          tanda: 8,
          href: "/facturacion",
        }
      : {
          label: "Pacientes activos",
          value: kpis.pacientesActivos,
          icon: UserCheck,
          accent: "gold",
          modulo: "Pacientes",
          tanda: 3,
          href: "/pacientes",
        };

  const defs: KpiDef[] = [
    {
      label: "Pacientes este mes",
      value: kpis.pacientesMes,
      icon: Users,
      trend: kpis.pacientesMesTrend,
      accent: "clinical",
      modulo: "Pacientes",
      tanda: 3,
      href: "/pacientes",
    },
    {
      label: "Citas de hoy",
      value: kpis.citasHoy,
      icon: CalendarCheck,
      accent: "mint",
      modulo: "Citas",
      tanda: 4,
      href: "/citas?view=dia",
    },
    tercero,
    {
      label: "Tratamientos pendientes",
      value: kpis.tratamientosPendientes,
      icon: ClipboardList,
      accent: "amber",
      modulo: "Tratamientos",
      tanda: 9,
    },
  ];

  const cardFor = (d: KpiDef) => (
    <KPICard
      label={d.label}
      value={d.value}
      icon={d.icon}
      prefix={d.prefix}
      trend={d.trend}
      accent={d.accent}
    />
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {defs.map((d) =>
        d.href ? (
          <Link
            key={d.label}
            href={d.href}
            className="block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {cardFor(d)}
          </Link>
        ) : (
          <button
            key={d.label}
            onClick={() =>
              toast.toast({
                type: "info",
                title: d.modulo,
                description: `El módulo completo se activa en la Tanda ${d.tanda}.`,
              })
            }
            className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {cardFor(d)}
          </button>
        ),
      )}
    </div>
  );
}
