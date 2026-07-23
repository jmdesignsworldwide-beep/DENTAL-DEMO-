"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2, History } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { NcfSeq } from "@/lib/settings";
import { inputCls } from "./ui";
import { updateNcf, saveNcfUmbral } from "../actions";

export function NcfSection({ ncf, umbral }: { ncf: NcfSeq[]; umbral: number }) {
  const { success, error } = useToast();
  const [u, setU] = React.useState(umbral);
  const [uPending, startU] = React.useTransition();

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-lg font-extrabold text-fg">Secuencias NCF</h2>
        <p className="mt-0.5 text-[13px] text-muted">Comprobantes fiscales simulados. B01 (crédito fiscal) y B02 (consumidor final).</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ncf.map((seq) => <NcfCard key={seq.tipo} seq={seq} umbral={u} onSaved={() => success(`Secuencia ${seq.tipo} actualizada`)} onError={(e) => error("No se pudo actualizar", e)} />)}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-[15px] font-extrabold text-fg">Alerta de agotamiento</h3>
        <p className="mt-0.5 text-[13px] text-muted">Recibe una notificación cuando queden menos comprobantes que este umbral.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="number" value={u} onChange={(e) => setU(Math.max(0, Number(e.target.value) || 0))} className={`${inputCls} w-40`} />
          <span className="text-[13px] text-muted">comprobantes</span>
          <button
            onClick={() => startU(async () => { const r = await saveNcfUmbral(u); r.ok ? success("Umbral guardado") : error("No se pudo guardar", r.error); })}
            disabled={uPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-clinical px-4 py-2 text-sm font-bold text-white hover:bg-clinical-600 disabled:opacity-50"
          >
            {uPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-fg"><History className="h-4 w-4 text-muted" /> Secuencias agotadas</h3>
        <p className="mt-2 text-[13px] text-muted">Ninguna secuencia se ha agotado. El historial aparecerá aquí cuando una serie llegue a su fin.</p>
      </div>
    </div>
  );
}

function NcfCard({ seq, umbral, onSaved, onError }: { seq: NcfSeq; umbral: number; onSaved: () => void; onError: (e?: string) => void }) {
  const [actual, setActual] = React.useState(seq.actual);
  const [final, setFinal] = React.useState(seq.final);
  const [pending, start] = React.useTransition();

  const restantes = Math.max(0, final - actual);
  const pct = final > 0 ? Math.min(100, Math.round((actual / final) * 100)) : 0;
  const alerta = restantes <= umbral;
  const dirty = actual !== seq.actual || final !== seq.final;

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-black tabular text-fg">{seq.prefijo}</p>
        {alerta && <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 text-[11px] font-bold text-amber"><AlertTriangle className="h-3 w-3" /> Por agotarse</span>}
      </div>
      <p className="mt-1 text-[12px] text-muted">Quedan <span className="font-black tabular text-fg">{restantes.toLocaleString("es-DO")}</span> comprobantes</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
        <motion.div className="h-full rounded-full" style={{ background: alerta ? "#F59E0B" : "#0066CC" }} initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-muted">Secuencia actual</span>
          <input type="number" value={actual} onChange={(e) => setActual(Math.max(0, Number(e.target.value) || 0))} className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-[13px] tabular text-fg outline-none focus:ring-2 focus:ring-clinical/30" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-muted">Secuencia final</span>
          <input type="number" value={final} onChange={(e) => setFinal(Math.max(0, Number(e.target.value) || 0))} className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-[13px] tabular text-fg outline-none focus:ring-2 focus:ring-clinical/30" />
        </label>
      </div>
      <button
        onClick={() => start(async () => { const r = await updateNcf(seq.tipo, actual, final); r.ok ? onSaved() : onError(r.error); })}
        disabled={!dirty || pending}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-clinical px-3 py-1.5 text-[12px] font-bold text-white hover:bg-clinical-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Guardar {seq.tipo}
      </button>
    </div>
  );
}
