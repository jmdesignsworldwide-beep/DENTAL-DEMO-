"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { formatRD } from "@/lib/utils";
import type { ReportData, Segmento } from "@/lib/reports";

const AXIS = "#94A3B8";
const GRID = "#94A3B822";

function fmtCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function Tip({
  active,
  payload,
  label,
  kind,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: Record<string, unknown> }[];
  label?: string;
  kind: "money" | "count" | "pct";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const v = Number(p.value ?? 0);
  const name = (p.payload?.label as string) ?? (p.payload?.nombre as string) ?? label ?? p.name;
  const val = kind === "money" ? formatRD(v) : kind === "pct" ? `${v}%` : String(v);
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-card-hover">
      <p className="text-xs font-semibold text-fg">{name}</p>
      <p className="text-sm font-extrabold text-clinical tabular">{val}</p>
    </div>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <EmptyState icon={BarChart3} title="Sin datos" description="No hay datos en el rango seleccionado." />
        ) : (
          <div className="h-[240px] w-full">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportCharts({ data }: { data: ReportData }) {
  const reduce = !!useReducedMotion();
  const anim = reduce ? 0 : 900;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Ingresos por mes — línea con gradiente */}
      <ChartCard title="Ingresos por mes">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.ingresosMensuales} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="lineIngresos" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3391E6" />
                <stop offset="100%" stopColor="#0066CC" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="mes" stroke={AXIS} tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={40} />
            <Tooltip content={<Tip kind="money" />} cursor={{ stroke: GRID }} />
            <Line type="monotone" dataKey="value" stroke="url(#lineIngresos)" strokeWidth={3} dot={{ r: 3, fill: "#0066CC" }} activeDot={{ r: 5 }} animationDuration={anim} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Distribución de citas por estado — donut */}
      <ChartCard title="Citas por estado" empty={data.citasPorEstado.length === 0}>
        <div className="flex h-full items-center gap-4">
          <ResponsiveContainer width="60%" height="100%">
            <PieChart>
              <Pie data={data.citasPorEstado} dataKey="value" nameKey="label" innerRadius={48} outerRadius={80} paddingAngle={2} animationDuration={anim}>
                {data.citasPorEstado.map((s) => (<Cell key={s.key} fill={s.color} stroke="transparent" />))}
              </Pie>
              <Tooltip content={<Tip kind="count" />} />
            </PieChart>
          </ResponsiveContainer>
          <Leyenda items={data.citasPorEstado} />
        </div>
      </ChartCard>

      {/* Tratamientos más realizados — barras horizontales */}
      <ChartCard title="Tratamientos más realizados" empty={data.topTratamientos.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.topTratamientos} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" stroke={AXIS} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="nombre" stroke={AXIS} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={110} />
            <Tooltip content={<Tip kind="count" />} cursor={{ fill: GRID }} />
            <Bar dataKey="value" fill="#0066CC" radius={[0, 6, 6, 0]} barSize={16} animationDuration={anim} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Crecimiento de pacientes — área con gradiente */}
      <ChartCard title="Crecimiento de pacientes">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.pacientesMensuales} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="areaPac" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00C896" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#00C896" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="mes" stroke={AXIS} tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <Tooltip content={<Tip kind="count" />} cursor={{ stroke: GRID }} />
            <Area type="monotone" dataKey="value" stroke="#00C896" strokeWidth={2.5} fill="url(#areaPac)" animationDuration={anim} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Ingresos por método de pago — pie */}
      <ChartCard title="Ingresos por método de pago" empty={data.ingresosPorMetodo.length === 0}>
        <div className="flex h-full items-center gap-4">
          <ResponsiveContainer width="60%" height="100%">
            <PieChart>
              <Pie data={data.ingresosPorMetodo} dataKey="value" nameKey="label" outerRadius={82} animationDuration={anim}>
                {data.ingresosPorMetodo.map((s) => (<Cell key={s.key} fill={s.color} stroke="transparent" />))}
              </Pie>
              <Tooltip content={<Tip kind="money" />} />
            </PieChart>
          </ResponsiveContainer>
          <Leyenda items={data.ingresosPorMetodo} money />
        </div>
      </ChartCard>

      {/* Tasa de no-show — línea */}
      <ChartCard title="Tendencia de no-show (%)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.noShowTendencia} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="mes" stroke={AXIS} tick={{ fontSize: 12, fill: AXIS }} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={36} unit="%" />
            <Tooltip content={<Tip kind="pct" />} cursor={{ stroke: GRID }} />
            <Line type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={3} dot={{ r: 3, fill: "#EF4444" }} activeDot={{ r: 5 }} animationDuration={anim} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function Leyenda({ items, money }: { items: Segmento[]; money?: boolean }) {
  return (
    <ul className="flex-1 space-y-1.5">
      {items.slice(0, 6).map((s) => (
        <li key={s.key} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="flex-1 truncate text-muted">{s.label}</span>
          <span className="font-semibold text-fg tabular">{money ? formatRD(s.value) : s.value}</span>
        </li>
      ))}
    </ul>
  );
}
