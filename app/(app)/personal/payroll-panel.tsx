"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Wallet, TrendingUp, TrendingDown, Receipt, HandCoins, FileText, Check, Loader2,
} from "lucide-react";
import { formatRD } from "@/lib/utils";
import {
  escalarPeriodo, PERIODO_FACTOR, PERIODO_LABEL, type Periodo,
} from "@/lib/payroll";
import type { PayrollRow } from "@/lib/staff";
import { markPayrollPaid } from "./actions";

const PERIODOS: Periodo[] = ["mensual", "quincenal", "semanal"];

export function PayrollPanel({
  payroll,
  periodoMes,
  totalesPrev,
}: {
  payroll: PayrollRow[];
  periodoMes: string;
  totalesPrev: { bruto: number; deducciones: number; neto: number };
}) {
  const reduce = useReducedMotion();
  const [periodo, setPeriodo] = React.useState<Periodo>("mensual");
  const [paid, setPaid] = React.useState<Record<string, boolean>>({});
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const factor = PERIODO_FACTOR[periodo];
  const rows = payroll.map((r) => ({ ...r, view: escalarPeriodo(r.calc, periodo) }));

  const totBruto = rows.reduce((s, r) => s + r.view.bruto, 0);
  const totDed = rows.reduce((s, r) => s + r.view.totalDeducciones, 0);
  const totNeto = rows.reduce((s, r) => s + r.view.neto, 0);

  const prevBruto = totalesPrev.bruto * factor;
  const prevNeto = totalesPrev.neto * factor;

  const isPaid = (r: PayrollRow) => paid[r.staffId] || r.estadoPago === "pagada";

  const onPay = (r: PayrollRow) => {
    setPendingId(r.staffId);
    void markPayrollPaid(r.staffId, periodoMes, r.calc.neto).then((res) => {
      if (res.ok) setPaid((p) => ({ ...p, [r.staffId]: true }));
      setPendingId(null);
    });
  };

  return (
    <div className="space-y-5">
      {/* Toggle de período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${periodo === p ? "bg-clinical text-white" : "text-muted hover:text-fg"}`}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted">
          Período: <span className="font-semibold text-fg">{PERIODO_LABEL[periodo]}</span> · {periodoMes}
        </p>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TotalCard label="Costo laboral" value={totBruto} icon={Wallet} accent="#0066CC" delta={pct(totBruto, prevBruto)} reduce={!!reduce} />
        <TotalCard label="Total deducciones" value={totDed} icon={Receipt} accent="#F59E0B" reduce={!!reduce} />
        <TotalCard label="Neto a pagar" value={totNeto} icon={HandCoins} accent="#00C896" delta={pct(totNeto, prevNeto)} reduce={!!reduce} />
      </div>

      {/* Tabla de nómina */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-3 text-left font-bold">Empleado</th>
              <th className="px-3 py-3 text-right font-bold">Base</th>
              <th className="px-3 py-3 text-right font-bold">Comisiones</th>
              <th className="px-3 py-3 text-right font-bold">Bruto</th>
              <th className="px-3 py-3 text-right font-bold">AFP</th>
              <th className="px-3 py-3 text-right font-bold">SFS</th>
              <th className="px-3 py-3 text-right font-bold">ISR</th>
              <th className="px-3 py-3 text-right font-bold">Otras</th>
              <th className="px-3 py-3 text-right font-bold">Neto</th>
              <th className="px-3 py-3 text-center font-bold">Estado</th>
              <th className="px-3 py-3 text-center font-bold">Volante</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pagada = isPaid(r);
              return (
                <tr key={r.staffId} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                  <td className="px-3 py-2.5">
                    <p className="font-bold text-fg">{r.nombre}</p>
                    <p className="text-[11px] text-muted">{r.especialidad ?? r.rol}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular text-fg">{formatRD(r.view.salarioBase)}</td>
                  <td className="px-3 py-2.5 text-right tabular text-fg">{r.view.comisiones > 0 ? formatRD(r.view.comisiones) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular text-fg">{formatRD(r.view.bruto)}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted">{formatRD(r.view.afp)}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted">{formatRD(r.view.sfs)}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted">{r.view.isr > 0 ? formatRD(r.view.isr) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted">{r.view.otrasDeducciones > 0 ? formatRD(r.view.otrasDeducciones) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-black tabular text-clinical">{formatRD(r.view.neto)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {pagada ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-bold text-mint">
                        <Check className="h-3 w-3" /> Pagada
                      </span>
                    ) : (
                      <button
                        onClick={() => onPay(r)}
                        disabled={pendingId === r.staffId}
                        className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-2.5 py-1 text-[11px] font-bold text-amber transition-colors hover:bg-amber/20 disabled:opacity-60"
                      >
                        {pendingId === r.staffId ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Marcar pagada
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <a
                      href={`/imprimir/volante/${r.staffId}?periodo=${periodo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-fg hover:bg-surface-2"
                    >
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-clinical/30 bg-surface-2/40 text-[13px] font-black">
              <td className="px-3 py-3 text-fg">Totales del período</td>
              <td colSpan={2} />
              <td className="px-3 py-3 text-right tabular text-fg">{formatRD(totBruto)}</td>
              <td colSpan={3} />
              <td className="px-3 py-3 text-right tabular text-amber">{formatRD(totDed)}</td>
              <td className="px-3 py-3 text-right tabular text-mint">{formatRD(totNeto)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        Deducciones calculadas con la normativa dominicana vigente: AFP 2.87% y SFS 3.04% (TSS del empleado) e ISR
        según la escala anual de la DGII. Los montos se ajustan automáticamente al período seleccionado.
      </p>
    </div>
  );
}

function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function TotalCard({
  label, value, icon: Icon, accent, delta, reduce,
}: {
  label: string; value: number; icon: React.ElementType; accent: string; delta?: number | null; reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 12 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-surface p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-muted">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accent}1a`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-[24px] font-black tabular leading-none text-fg">{formatRD(value)}</p>
      {delta != null && (
        <p className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold ${delta >= 0 ? "text-mint" : "text-danger"}`}>
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(delta)}% vs. mes anterior
        </p>
      )}
    </motion.div>
  );
}
