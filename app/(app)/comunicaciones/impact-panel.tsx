"use client";

import { useReducedMotion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingDown,
  BadgeDollarSign,
  Send,
  MessageSquareReply,
  CheckCircle2,
  Sparkles,
  CalendarHeart,
  type LucideIcon,
} from "lucide-react";
import { formatRD, cn } from "@/lib/utils";
import type { ImpactMetrics } from "@/lib/communications";
import { ESTADO_MENSAJE, type MensajeEstado } from "./estado-config";

const AXIS = "#94A3B8";
const GRID = "#94A3B822";

function Tip({
  active,
  payload,
  suffix,
}: {
  active?: boolean;
  payload?: { value: number; payload: { label: string } }[];
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-card-hover">
      <p className="font-semibold text-fg">{payload[0].payload.label}</p>
      <p className="tabular text-muted">
        {payload[0].value}
        {suffix}
      </p>
    </div>
  );
}

export function ImpactPanel({ m }: { m: ImpactMetrics }) {
  const reduce = useReducedMotion();
  const anim = reduce ? 0 : 800;
  const mejora = Math.max(0, m.noShowBase - m.noShowConRecordatorio);

  const donut = m.porEstado
    .filter((e) => ESTADO_MENSAJE[e.estado as MensajeEstado])
    .map((e) => ({
      label: ESTADO_MENSAJE[e.estado as MensajeEstado].label,
      value: e.total,
      hex: ESTADO_MENSAJE[e.estado as MensajeEstado].hex,
    }));

  return (
    <div className="space-y-5">
      {/* Héroe — dinero recuperado */}
      <div className="relative overflow-hidden rounded-2xl border border-mint/30 bg-gradient-to-br from-mint/10 via-surface to-surface p-6 shadow-card dark:from-mint/15">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-mint/10 blur-2xl" />
        <div className="relative">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mint">
            <BadgeDollarSign className="h-4 w-4" />
            Dinero recuperado estimado
          </p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-fg tabular">
            {formatRD(m.dineroRecuperado)}
          </p>
          <p className="mt-1 text-sm text-muted">
            ≈ {m.citasSalvadas} citas rescatadas del no-show × ticket promedio de{" "}
            {formatRD(m.ticketPromedio)}
          </p>
        </div>
      </div>

      {/* No-show antes vs después */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card dark:bg-surface/80">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg">Tasa de no-show</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-mint/10 px-2 py-0.5 text-xs font-bold text-mint">
              <TrendingDown className="h-3.5 w-3.5" />
              {mejora.toFixed(1)} pts menos
            </span>
          </div>
          <p className="mb-3 text-xs text-muted">
            Citas sin recordatorio vs. citas con recordatorio.
          </p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.comparativa} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: AXIS }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: AXIS }}
                  unit="%"
                />
                <Tooltip cursor={{ fill: GRID }} content={<Tip suffix="%" />} />
                <Bar dataKey="pct" radius={[8, 8, 0, 0]} animationDuration={anim}>
                  {m.comparativa.map((d, i) => (
                    <Cell key={i} fill={i === 0 ? "#EF4444" : "#00C896"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribución de estados */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card dark:bg-surface/80">
          <h3 className="mb-1 text-sm font-bold text-fg">Estado de los mensajes</h3>
          <p className="mb-3 text-xs text-muted">Todo lo programado y enviado.</p>
          <div className="flex items-center gap-4">
            <div className="h-[180px] w-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                    animationDuration={anim}
                  >
                    {donut.map((d, i) => (
                      <Cell key={i} fill={d.hex} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<Tip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {donut.map((d) => (
                <li key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.hex }} />
                  <span className="text-muted">{d.label}</span>
                  <span className="ml-auto font-bold tabular text-fg">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Métricas de operación */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Send} label="Recordatorios enviados" value={m.recordatoriosEnviados} accent="clinical" />
        <Stat icon={MessageSquareReply} label="Tasa de respuesta" value={m.tasaRespuesta} suffix="%" accent="mint" />
        <Stat icon={CheckCircle2} label="Citas confirmadas" value={m.confirmadas} accent="mint" />
        <Stat icon={CalendarHeart} label="Pacientes de higiene recuperados" value={m.higieneRecuperados} accent="gold" />
      </div>
      <div className="rounded-2xl border border-clinical/20 bg-clinical/5 p-4 text-sm text-fg">
        <p className="flex items-center gap-2 font-semibold text-clinical">
          <Sparkles className="h-4 w-4" />
          {m.presupuestosCerrados} presupuesto{m.presupuestosCerrados === 1 ? "" : "s"} cerrado
          {m.presupuestosCerrados === 1 ? "" : "s"} tras un mensaje de seguimiento.
        </p>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  accent: "clinical" | "mint" | "gold";
}) {
  const map = {
    clinical: "text-clinical bg-clinical/10",
    mint: "text-mint bg-mint/10",
    gold: "text-gold-dark bg-gold/10 dark:text-gold-light",
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card dark:bg-surface/80">
      <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", map[accent])}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-2 text-2xl font-extrabold tabular text-fg">
        {value}
        {suffix}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
