"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Percent, ArrowRight, Check, X, Loader2 } from "lucide-react";
import { formatRD } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { TreatmentLite } from "@/lib/settings";
import { inputCls } from "./ui";
import { updateTreatmentPrice, bulkAdjustCategory } from "../actions";

const CAT_LABEL: Record<string, string> = {
  preventiva: "Preventiva", restauradora: "Restauradora", endodoncia: "Endodoncia",
  periodoncia: "Periodoncia", cirugia_oral: "Cirugía oral", ortodoncia: "Ortodoncia",
  estetica: "Estética", odontopediatria: "Odontopediatría",
};

export function TratamientosSection({ treatments }: { treatments: TreatmentLite[] }) {
  const { success, error } = useToast();
  const [items, setItems] = React.useState(treatments);

  const cats = React.useMemo(() => {
    const m = new Map<string, TreatmentLite[]>();
    for (const t of items) { const a = m.get(t.categoria) ?? []; a.push(t); m.set(t.categoria, a); }
    return [...m.entries()];
  }, [items]);

  const onPrice = async (id: string, precio: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, precio } : t)));
    const res = await updateTreatmentPrice(id, precio);
    if (!res.ok) error("No se pudo actualizar", res.error);
  };

  const onBulk = async (categoria: string, pct: number) => {
    const res = await bulkAdjustCategory(categoria, pct);
    if (res.ok) {
      const factor = 1 + pct / 100;
      setItems((prev) => prev.map((t) => (t.categoria === categoria ? { ...t, precio: Math.round(t.precio * factor * 100) / 100 } : t)));
      success("Precios actualizados", `${res.count ?? 0} tratamientos de ${CAT_LABEL[categoria] ?? categoria} ajustados ${pct}%.`);
    } else error("No se pudo ajustar", res.error);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-lg font-extrabold text-fg">Catálogo de tratamientos</h2>
      <p className="mt-0.5 text-[13px] text-muted">Edita precios en línea o aplica un ajuste porcentual a toda una categoría.</p>

      <div className="mt-4 space-y-3">
        {cats.map(([cat, list]) => (
          <CategoryBlock key={cat} cat={cat} list={list} onPrice={onPrice} onBulk={onBulk} />
        ))}
      </div>
    </div>
  );
}

function CategoryBlock({
  cat, list, onPrice, onBulk,
}: {
  cat: string; list: TreatmentLite[]; onPrice: (id: string, p: number) => void; onBulk: (cat: string, pct: number) => Promise<void>;
}) {
  const [openAdj, setOpenAdj] = React.useState(false);
  const [pct, setPct] = React.useState(10);
  const [pending, start] = React.useTransition();

  const factor = 1 + pct / 100;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between bg-surface-2/50 px-3 py-2">
        <p className="text-[13px] font-extrabold text-fg">{CAT_LABEL[cat] ?? cat} <span className="text-muted">· {list.length}</span></p>
        <button onClick={() => setOpenAdj((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[12px] font-bold text-clinical hover:bg-clinical/10">
          <Percent className="h-3.5 w-3.5" /> Ajuste masivo
        </button>
      </div>

      <AnimatePresence>
        {openAdj && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border bg-clinical/5">
            <div className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-fg">Ajustar todos</span>
                <input type="number" value={pct} onChange={(e) => setPct(Number(e.target.value) || 0)} className={`${inputCls} w-24`} />
                <span className="text-[12px] font-semibold text-muted">%</span>
                <div className="ml-auto flex gap-1.5">
                  {[5, 10, -5].map((v) => (
                    <button key={v} onClick={() => setPct(v)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-bold text-fg hover:bg-surface-2">{v > 0 ? `+${v}` : v}%</button>
                  ))}
                </div>
              </div>
              {/* Preview antes/después */}
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg bg-surface p-2">
                {list.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-[12px]">
                    <span className="truncate pr-2 text-muted">{t.nombre}</span>
                    <span className="flex shrink-0 items-center gap-1.5 tabular">
                      <span className="text-muted line-through">{formatRD(t.precio)}</span>
                      <ArrowRight className="h-3 w-3 text-clinical" />
                      <span className="font-bold text-fg">{formatRD(Math.round(t.precio * factor * 100) / 100)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setOpenAdj(false)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold text-muted"><X className="h-3.5 w-3.5" /> Cancelar</button>
                <button
                  onClick={() => start(async () => { await onBulk(cat, pct); setOpenAdj(false); })}
                  disabled={pending || pct === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-clinical px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aplicar a {list.length}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="divide-y divide-border">
        {list.map((t) => (
          <PriceRow key={t.id} t={t} onPrice={onPrice} />
        ))}
      </div>
    </div>
  );
}

function PriceRow({ t, onPrice }: { t: TreatmentLite; onPrice: (id: string, p: number) => void }) {
  const [val, setVal] = React.useState(String(t.precio));
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => setVal(String(t.precio)), [t.precio]);

  const commit = () => {
    const p = Math.max(0, Math.round(Number(val) * 100) / 100);
    if (p !== t.precio) { onPrice(t.id, p); setSaved(true); window.setTimeout(() => setSaved(false), 1400); }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{t.nombre}</span>
      {saved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-mint"><Check className="h-4 w-4" /></motion.span>}
      <div className="flex items-center gap-1">
        <span className="text-[12px] text-muted">RD$</span>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-8 w-24 rounded-lg border border-border bg-surface px-2 text-right text-[13px] font-bold tabular text-fg outline-none focus:ring-2 focus:ring-clinical/30"
        />
      </div>
    </div>
  );
}
