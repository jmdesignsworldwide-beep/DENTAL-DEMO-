"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { DollarSign, Receipt, UserPlus, CalendarCheck, FileDown, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/motion/count-up";
import { LogoMark } from "@/components/brand/logo";
import { formatRD, formatDateLong, pctChange } from "@/lib/utils";
import type { ReportData } from "@/lib/reports";
import { ReportCharts } from "./report-charts";
import { cn } from "@/lib/utils";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Preset = "este_mes" | "mes_pasado" | "ultimos_3" | "este_anio" | "personalizado";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "este_mes", label: "Este mes" },
  { key: "mes_pasado", label: "Mes pasado" },
  { key: "ultimos_3", label: "Últimos 3 meses" },
  { key: "este_anio", label: "Este año" },
  { key: "personalizado", label: "Personalizado" },
];

function rangoDe(p: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === "este_mes") return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
  if (p === "mes_pasado") return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  if (p === "ultimos_3") return { from: ymd(new Date(y, m - 2, 1)), to: ymd(now) };
  if (p === "este_anio") return { from: ymd(new Date(y, 0, 1)), to: ymd(now) };
  return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
}

export function ReportsClient({ data, preset }: { data: ReportData; preset: Preset }) {
  const router = useRouter();
  const pathname = usePathname();
  const [customFrom, setCustomFrom] = React.useState(data.from);
  const [customTo, setCustomTo] = React.useState(data.to);

  function aplicar(p: Preset) {
    if (p === "personalizado") {
      router.replace(`${pathname}?preset=personalizado&from=${customFrom}&to=${customTo}`, { scroll: false });
      return;
    }
    const r = rangoDe(p);
    router.replace(`${pathname}?preset=${p}&from=${r.from}&to=${r.to}`, { scroll: false });
  }

  const k = data.kpis;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Membrete solo impresión */}
      <div className="hidden items-center gap-3 border-b-2 border-[#0066CC] pb-3 print:flex">
        <LogoMark className="h-10 w-10" />
        <div>
          <p className="text-lg font-extrabold">Clínica Dental — Reporte de gestión</p>
          <p className="text-xs text-muted">
            Período: {formatDateLong(data.from)} — {formatDateLong(data.to)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Reportes</h1>
          <p className="text-sm text-muted">
            {formatDateLong(data.from)} — {formatDateLong(data.to)}
          </p>
        </div>
        <Button variant="secondary" icon={FileDown} onClick={() => window.print()}>
          Exportar PDF
        </Button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => aplicar(p.key)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition-colors",
              preset === p.key ? "border-clinical bg-clinical text-white" : "border-border bg-surface text-muted hover:text-fg dark:bg-surface/60",
            )}
          >
            {p.label}
          </button>
        ))}
        {preset === "personalizado" && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 rounded-xl border border-border bg-surface px-2 text-[13px] text-fg dark:bg-navy-light [color-scheme:light] dark:[color-scheme:dark]" />
            <span className="text-muted">—</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 rounded-xl border border-border bg-surface px-2 text-[13px] text-fg dark:bg-navy-light [color-scheme:light] dark:[color-scheme:dark]" />
            <Button size="sm" onClick={() => aplicar("personalizado")}>Aplicar</Button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="Ingreso del período" prefix="RD$ " value={k.ingresoTotal} trend={pctChange(k.ingresoTotal, k.ingresoTotalPrev)} accent="gold" />
        <Kpi icon={Receipt} label="Ticket promedio" prefix="RD$ " value={k.ticket} trend={pctChange(k.ticket, k.ticketPrev)} accent="clinical" />
        <Kpi icon={UserPlus} label="Pacientes nuevos" value={k.pacientesNuevos} trend={pctChange(k.pacientesNuevos, k.pacientesNuevosPrev)} accent="mint" />
        <Kpi icon={CalendarCheck} label="Tasa de atención" suffix="%" value={k.ocupacion} decimals={1} trend={pctChange(k.ocupacion, k.ocupacionPrev)} accent="amber" />
      </div>

      {/* Gráficas */}
      <ReportCharts data={data} />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
  trend,
  accent,
}: {
  icon: typeof DollarSign;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend: number;
  accent: "clinical" | "mint" | "amber" | "gold";
}) {
  const positive = trend >= 0;
  const cls = {
    clinical: "text-clinical bg-clinical-50 dark:bg-clinical-900/40",
    mint: "text-mint bg-mint/10",
    amber: "text-amber bg-amber/10",
    gold: "text-gold-dark bg-gold/10 dark:text-gold-light",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card dark:bg-surface/80">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted">{label}</span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", cls)}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-fg">
        <CountUp value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs font-semibold">
        <span className={cn("inline-flex items-center gap-0.5", positive ? "text-mint" : "text-danger")}>
          {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {Math.abs(trend)}%
        </span>
        <span className="text-muted">vs. período anterior</span>
      </div>
    </div>
  );
}
