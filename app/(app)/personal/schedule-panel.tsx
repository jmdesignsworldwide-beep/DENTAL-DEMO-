"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Plane, HeartPulse, CalendarX, ShieldCheck } from "lucide-react";
import type { StaffMember, AbsenceRow, CoverageDay } from "@/lib/staff";

const DIAS = ["lun", "mar", "mie", "jue", "vie", "sab"] as const;
const DIA_LABEL: Record<string, string> = {
  lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb",
};
const ABS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  vacaciones: { label: "Vacaciones", icon: Plane, color: "#F59E0B" },
  licencia: { label: "Licencia", icon: HeartPulse, color: "#8B5CF6" },
  ausencia: { label: "Ausencia", icon: CalendarX, color: "#EF4444" },
};

function fmtRango(inicio: string, fin: string): string {
  const f = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${d} ${meses[(m ?? 1) - 1]}`;
  };
  return inicio === fin ? f(inicio) : `${f(inicio)} – ${f(fin)}`;
}

export function SchedulePanel({
  staff,
  absences,
  coverage,
}: {
  staff: StaffMember[];
  absences: AbsenceRow[];
  coverage: CoverageDay[];
}) {
  const visibles = staff.filter((s) => s.estado !== "inactivo");
  const diasConHueco = coverage.filter((c) => c.gaps.length > 0);

  return (
    <div className="space-y-5">
      {/* Cobertura */}
      <div className={`rounded-2xl border p-4 shadow-card ${diasConHueco.length ? "border-amber/40 bg-amber/5" : "border-mint/40 bg-mint/5"}`}>
        <p className="flex items-center gap-2 text-[13px] font-extrabold text-fg">
          {diasConHueco.length ? <AlertTriangle className="h-4 w-4 text-amber" /> : <ShieldCheck className="h-4 w-4 text-mint" />}
          Cobertura odontológica de la semana
        </p>
        {diasConHueco.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">Todos los horarios de la clínica tienen al menos un odontólogo disponible.</p>
        ) : (
          <div className="mt-2 space-y-1">
            {diasConHueco.map((c) => (
              <p key={c.dia} className="text-[13px] text-fg">
                <span className="font-bold">{c.diaLargo}:</span>{" "}
                {c.gaps.map((g, i) => (
                  <span key={i} className="tabular text-amber">
                    {g.inicio}–{g.fin}{i < c.gaps.length - 1 ? ", " : ""}
                  </span>
                ))}{" "}
                <span className="text-muted">sin odontólogo</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Rejilla semanal */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Personal</th>
              {DIAS.map((d) => (
                <th key={d} className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted">{DIA_LABEL[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((s, ri) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: ri * 0.04 }}
                className="border-b border-border last:border-0 hover:bg-surface-2/40"
              >
                <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-fg">{s.nombre}</p>
                      <p className="truncate text-[10px] text-muted">{s.especialidad}</p>
                    </div>
                  </div>
                </td>
                {DIAS.map((d) => {
                  const r = s.horario[d];
                  return (
                    <td key={d} className="px-1.5 py-2 text-center align-middle">
                      {r ? (
                        <span
                          className="inline-block whitespace-nowrap rounded-md px-1.5 py-1 text-[10px] font-bold tabular"
                          style={{ background: `${s.color}1f`, color: s.color }}
                        >
                          {r[0].slice(0, 5)}–{r[1].slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted">·</span>
                      )}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ausencias */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
        <p className="mb-3 text-[13px] font-extrabold uppercase tracking-wider text-muted">Vacaciones, licencias y ausencias</p>
        {absences.length === 0 ? (
          <p className="text-[13px] text-muted">No hay ausencias registradas.</p>
        ) : (
          <div className="space-y-2">
            {absences.map((a, i) => {
              const meta = ABS_META[a.tipo] ?? ABS_META.ausencia;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${meta.color}1a`, color: meta.color }}>
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-fg">{a.nombre}</p>
                    <p className="truncate text-[11px] text-muted">{meta.label}{a.motivo ? ` · ${a.motivo}` : ""}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-surface px-2 py-1 text-[11px] font-semibold tabular text-muted">{fmtRango(a.inicio, a.fin)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
