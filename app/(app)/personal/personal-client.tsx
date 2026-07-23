"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, CalendarRange, Wallet } from "lucide-react";
import type { StaffModuleData } from "@/lib/staff";
import { TeamPanel } from "./team-panel";
import { PerformancePanel } from "./performance-panel";
import { SchedulePanel } from "./schedule-panel";
import { PayrollPanel } from "./payroll-panel";

type Tab = "equipo" | "rendimiento" | "horarios" | "nomina";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "equipo", label: "Equipo", icon: Users },
  { key: "rendimiento", label: "Rendimiento", icon: TrendingUp },
  { key: "horarios", label: "Horarios", icon: CalendarRange },
  { key: "nomina", label: "Nómina", icon: Wallet },
];

export function PersonalClient({ data }: { data: StaffModuleData }) {
  const [tab, setTab] = React.useState<Tab>("equipo");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Personal y Nómina</h1>
        <p className="mt-1 text-sm text-muted">
          Tu equipo, su rendimiento y el costo laboral — todo en un solo lugar.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1 no-scrollbar">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                active ? "text-white" : "text-muted hover:text-fg"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="personal-tab"
                  className="absolute inset-0 rounded-xl bg-clinical"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <t.icon className="h-4 w-4" /> {t.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[300px]">
        {tab === "equipo" && <TeamPanel staff={data.staff} />}
        {tab === "rendimiento" && <PerformancePanel metrics={data.metrics} />}
        {tab === "horarios" && (
          <SchedulePanel staff={data.staff} absences={data.absences} coverage={data.coverage} />
        )}
        {tab === "nomina" && (
          <PayrollPanel payroll={data.payroll} periodoMes={data.periodoMes} totalesPrev={data.totalesPrev} />
        )}
      </div>
    </div>
  );
}
