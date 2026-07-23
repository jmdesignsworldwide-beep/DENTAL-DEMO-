"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Trophy, CalendarCheck, Gauge, UserX, Receipt, Minus,
} from "lucide-react";
import { formatRD } from "@/lib/utils";
import type { DentistMetrics } from "@/lib/staff";

function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  if (prev === 0 && cur === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-muted"><Minus className="h-3 w-3" /> —</span>;
  const pct = prev === 0 ? 100 : Math.round(((cur - prev) / prev) * 1000) / 10;
  const up = pct >= 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${good ? "text-mint" : "text-danger"}`}>
      <Icon className="h-3 w-3" /> {Math.abs(pct)}%
    </span>
  );
}

function Spark({ data, color }: { data: { mes: string; citas: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.citas));
  return (
    <div className="flex items-end gap-1" style={{ height: 40 }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <motion.span
            className="w-full rounded-sm"
            style={{ background: color, opacity: i === data.length - 1 ? 1 : 0.4 }}
            initial={{ height: 0 }}
            whileInView={{ height: `${(d.citas / max) * 32}px` }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
          />
          <span className="text-[8px] font-semibold text-muted">{d.mes}</span>
        </div>
      ))}
    </div>
  );
}

function OccBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? "#00C896" : pct >= 50 ? "#0066CC" : "#F59E0B";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-muted">Ocupación de agenda</span>
        <span className="tabular" style={{ color }}>{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </div>
  );
}

export function PerformancePanel({ metrics }: { metrics: DentistMetrics[] }) {
  const reduce = useReducedMotion();
  const activos = metrics.filter((m) => m.citasMes > 0 || m.activo);
  const conActividad = metrics.filter((m) => m.citasMes > 0);

  if (metrics.length === 0) {
    return <p className="py-16 text-center text-muted">No hay odontólogos registrados.</p>;
  }

  const medalla = ["#C9A84C", "#94A3B8", "#B87333"];

  return (
    <div className="space-y-6">
      {/* Ranking de producción */}
      {conActividad.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-muted">
            <Trophy className="h-4 w-4 text-gold" /> Producción del mes por odontólogo
          </p>
          <div className="space-y-2">
            {conActividad.map((m, i) => {
              const max = conActividad[0].ingresosMes || 1;
              return (
                <div key={m.staffId} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: i < 3 ? medalla[i] : "#94A3B8" }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[13px] font-bold text-fg">{m.nombre}</span>
                      <span className="ml-2 shrink-0 text-[13px] font-black tabular text-fg">{formatRD(m.ingresosMes)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <motion.div className="h-full rounded-full" style={{ background: m.color }} initial={{ width: 0 }} whileInView={{ width: `${(m.ingresosMes / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.7 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted">Panel de gestión — la producción refleja la actividad del mes, no una competencia.</p>
        </div>
      )}

      {/* Tarjetas por odontólogo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {activos.map((m) => (
          <motion.div
            key={m.staffId}
            initial={reduce ? undefined : { opacity: 0, y: 16 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="rounded-2xl border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-extrabold text-fg">{m.nombre}</p>
                <p className="text-[12px] font-semibold text-muted">{m.especialidad}</p>
              </div>
            </div>

            {m.citasMes === 0 ? (
              <p className="mt-4 rounded-xl bg-surface-2 px-3 py-4 text-center text-[13px] text-muted">
                Sin agenda registrada este mes.
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Metric icon={CalendarCheck} label="Citas" value={String(m.citasMes)} delta={<Delta cur={m.citasMes} prev={m.citasMesPrev} />} />
                  <Metric icon={Receipt} label="Ingresos" value={formatRD(m.ingresosMes)} delta={<Delta cur={m.ingresosMes} prev={m.ingresosMesPrev} />} small />
                  <Metric icon={Gauge} label="Ticket prom." value={formatRD(m.ticketPromedio)} small />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OccBar pct={m.ocupacionPct} />
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="inline-flex items-center gap-1 text-muted"><UserX className="h-3 w-3" /> Tasa de no-show</span>
                      <span className={`tabular ${m.noShowRate > 15 ? "text-danger" : "text-mint"}`}>{m.noShowRate}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                      <motion.div className="h-full rounded-full" style={{ background: m.noShowRate > 15 ? "#EF4444" : "#00C896" }} initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, m.noShowRate)}%` }} viewport={{ once: true }} transition={{ duration: 0.7 }} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Tratamientos frecuentes</p>
                    <div className="flex flex-wrap gap-1">
                      {m.topTratamientos.map((t) => (
                        <span key={t.nombre} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-fg">
                          {t.nombre} <span className="tabular text-muted">×{t.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <p className="mb-1 text-right text-[11px] font-bold uppercase tracking-wider text-muted">6 meses</p>
                    <Spark data={m.trend} color={m.color} />
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, delta, small }: { icon: React.ElementType; label: string; value: string; delta?: React.ReactNode; small?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2/60 p-2.5">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted"><Icon className="h-3 w-3" /> {label}</p>
      <p className={`mt-1 font-black tabular leading-none text-fg ${small ? "text-[15px]" : "text-[20px]"}`}>{value}</p>
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}
