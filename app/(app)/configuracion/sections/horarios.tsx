"use client";

import * as React from "react";
import { CalendarHeart } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { ClinicSettings, Holiday } from "@/lib/settings";
import { SectionShell, inputCls, SaveButton, useUnsavedWarning } from "./ui";
import { saveHorarios, toggleHoliday } from "../actions";

const DIAS: [string, string][] = [
  ["lun", "Lunes"], ["mar", "Martes"], ["mie", "Miércoles"], ["jue", "Jueves"],
  ["vie", "Viernes"], ["sab", "Sábado"], ["dom", "Domingo"],
];
type DayCfg = { abre: string; cierra: string; desc: [string, string] | null } | null;

export function HorariosSection({ clinic, holidays }: { clinic: ClinicSettings; holidays: Holiday[] }) {
  const { success, error } = useToast();
  const [pending, start] = React.useTransition();
  const [h, setH] = React.useState<Record<string, DayCfg>>(() => {
    const base: Record<string, DayCfg> = {};
    for (const [k] of DIAS) base[k] = (clinic.horarioSemanal[k] ?? null) as DayCfg;
    return base;
  });
  const initial = React.useRef(JSON.stringify(h));
  const dirty = JSON.stringify(h) !== initial.current;
  useUnsavedWarning(dirty);

  const [hol, setHol] = React.useState(holidays);

  const setDay = (dia: string, cfg: DayCfg) => setH((p) => ({ ...p, [dia]: cfg }));
  const toggleDay = (dia: string) =>
    setDay(dia, h[dia] ? null : { abre: "08:00", cierra: "18:00", desc: null });

  const onSave = () =>
    start(async () => {
      const res = await saveHorarios(h);
      if (res.ok) { initial.current = JSON.stringify(h); success("Horarios guardados"); }
      else error("No se pudo guardar", res.error);
    });

  const onToggleHol = (id: string, next: boolean) => {
    setHol((prev) => prev.map((x) => (x.id === id ? { ...x, respetado: next } : x)));
    void toggleHoliday(id, next);
  };

  const fmtFecha = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${d} ${meses[(m ?? 1) - 1]}`;
  };

  return (
    <div className="space-y-5">
      <SectionShell title="Horarios de atención" description="Define apertura, cierre y descanso por día.">
        <div className="space-y-2">
          {DIAS.map(([k, label]) => {
            const cfg = h[k];
            const open = !!cfg;
            return (
              <div key={k} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2.5">
                <div className="flex w-28 items-center gap-2">
                  <Toggle on={open} onClick={() => toggleDay(k)} />
                  <span className={`text-[13px] font-bold ${open ? "text-fg" : "text-muted"}`}>{label}</span>
                </div>
                {open && cfg ? (
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <input type="time" value={cfg.abre} onChange={(e) => setDay(k, { ...cfg, abre: e.target.value })} className={`${inputCls} w-28`} />
                    <span className="text-muted">a</span>
                    <input type="time" value={cfg.cierra} onChange={(e) => setDay(k, { ...cfg, cierra: e.target.value })} className={`${inputCls} w-28`} />
                    <label className="ml-1 flex items-center gap-1.5 text-[12px] text-muted">
                      <input type="checkbox" checked={!!cfg.desc} onChange={(e) => setDay(k, { ...cfg, desc: e.target.checked ? ["13:00", "14:00"] : null })} className="accent-clinical" />
                      Descanso
                    </label>
                    {cfg.desc && (
                      <span className="flex items-center gap-1">
                        <input type="time" value={cfg.desc[0]} onChange={(e) => setDay(k, { ...cfg, desc: [e.target.value, cfg.desc![1]] })} className={`${inputCls} w-24`} />
                        <span className="text-muted">–</span>
                        <input type="time" value={cfg.desc[1]} onChange={(e) => setDay(k, { ...cfg, desc: [cfg.desc![0], e.target.value] })} className={`${inputCls} w-24`} />
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[13px] font-semibold text-muted">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Vista visual */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Vista semanal</p>
          <div className="flex gap-1.5">
            {DIAS.map(([k, label]) => {
              const cfg = h[k];
              const a = cfg ? Number(cfg.abre.slice(0, 2)) : 0;
              const c = cfg ? Number(cfg.cierra.slice(0, 2)) : 0;
              const top = ((a - 7) / 13) * 100;
              const height = ((c - a) / 13) * 100;
              return (
                <div key={k} className="flex-1 text-center">
                  <div className="relative h-24 overflow-hidden rounded-lg bg-surface-2">
                    {cfg && <div className="absolute inset-x-0.5 rounded bg-clinical/70" style={{ top: `${top}%`, height: `${height}%` }} />}
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-muted">{label.slice(0, 3)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <SaveButton dirty={dirty} pending={pending} onClick={onSave} />
      </SectionShell>

      {/* Feriados */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-fg"><CalendarHeart className="h-4 w-4 text-gold" /> Feriados dominicanos</h3>
        <p className="mt-0.5 text-[13px] text-muted">Marca los que tu clínica respeta. Los feriados no permiten agendar citas.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {hol.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-3 py-2">
              <div>
                <p className="text-[13px] font-bold text-fg">{f.nombre}</p>
                <p className="text-[11px] tabular text-muted">{fmtFecha(f.fecha)}</p>
              </div>
              <Toggle on={f.respetado} onClick={() => onToggleHol(f.id, !f.respetado)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-clinical" : "bg-surface-2 border border-border"}`}>
      <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform" style={{ transform: on ? "translateX(18px)" : "translateX(3px)" }} />
    </button>
  );
}
