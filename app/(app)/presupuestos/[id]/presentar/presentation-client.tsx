"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  X,
  Sparkles,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { LogoMark } from "@/components/brand/logo";
import { OdontogramChart } from "@/app/(app)/odontograma/odontogram-chart";
import type { ToothState } from "@/lib/odontogram";
import { formatRD, cn } from "@/lib/utils";
import type { BudgetFull, BudgetItemDTO } from "@/lib/budgets";
import { PRIORIDAD } from "../../estado-config";
import { respondBudget } from "../../actions";

export function PresentationClient({
  budget,
  states,
}: {
  budget: BudgetFull;
  states: Record<number, ToothState>;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [focusFdi, setFocusFdi] = React.useState<number | null>(null);

  const pendientes = budget.items.filter((i) => i.estado_item === "pendiente");
  const yaAceptados = budget.items.filter((i) => i.estado_item !== "pendiente");

  // Selección: por defecto todo lo pendiente salvo grupos de opción.
  const [selected, setSelected] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const it of pendientes) if (!it.opcion_grupo) s.add(it.id);
    return s;
  });

  const grupos = React.useMemo(() => {
    const m = new Map<string, BudgetItemDTO[]>();
    for (const it of pendientes) {
      if (!it.opcion_grupo) continue;
      if (!m.has(it.opcion_grupo)) m.set(it.opcion_grupo, []);
      m.get(it.opcion_grupo)!.push(it);
    }
    return m;
  }, [pendientes]);

  const toggle = (it: BudgetItemDTO) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (it.opcion_grupo) {
        // Radio: al elegir una opción, deselecciona las hermanas del grupo.
        const siblings = grupos.get(it.opcion_grupo) ?? [];
        for (const s of siblings) next.delete(s.id);
        if (!prev.has(it.id)) next.add(it.id);
      } else {
        next.has(it.id) ? next.delete(it.id) : next.add(it.id);
      }
      return next;
    });
  };

  const selectedTotal = pendientes
    .filter((i) => selected.has(i.id))
    .reduce((a, i) => a + i.subtotal, 0);

  // Detecta dentición por los dientes involucrados (temporales 51–85).
  const denticion = budget.items.some(
    (i) => i.diente_fdi && i.diente_fdi >= 51 && i.diente_fdi <= 85,
  )
    ? "pediatrico"
    : "adulto";

  const dientesPlan = Array.from(
    new Set(budget.items.map((i) => i.diente_fdi).filter((x): x is number => !!x)),
  ).sort((a, b) => a - b);

  const fases = React.useMemo(() => {
    const map = new Map<string, BudgetItemDTO[]>();
    for (const it of pendientes.filter((i) => !i.opcion_grupo)) {
      const key = it.fase_nombre ?? "Servicios";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [pendientes]);

  const accept = async () => {
    if (selected.size === 0) return error("Selecciona al menos un servicio.");
    setBusy(true);
    const res = await respondBudget(budget.id, [...selected]);
    setBusy(false);
    if (res.ok) {
      success("¡Plan aceptado!", "Se registró la decisión del paciente.");
      router.push(`/presupuestos/${budget.id}`);
    } else error("No se pudo registrar", res.error);
  };

  const reject = async () => {
    setBusy(true);
    const res = await respondBudget(budget.id, [], motivo.trim() || undefined);
    setBusy(false);
    if (res.ok) {
      success("Respuesta registrada");
      router.push(`/presupuestos/${budget.id}`);
    } else error("No se pudo registrar", res.error);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-28">
      <Link
        href={`/presupuestos/${budget.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al plan
      </Link>

      {/* Portada */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-clinical/10 via-surface to-surface p-6 shadow-card sm:p-8 dark:from-clinical/20 dark:via-surface dark:to-surface"
      >
        <div className="flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-clinical">
              Plan de tratamiento personalizado
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-fg">{budget.titulo}</h1>
          </div>
        </div>
        <p className="mt-4 text-lg font-bold text-fg">Para: {budget.paciente}</p>
        {budget.diagnostico_general && (
          <p className="mt-1 max-w-2xl text-sm text-muted">{budget.diagnostico_general}</p>
        )}
        <div className="mt-4 flex items-center gap-2 text-sm text-muted">
          <ShieldCheck className="h-4 w-4 text-mint" />
          Precios garantizados
          {budget.fecha_vencimiento ? ` hasta el ${budget.fecha_vencimiento}` : ""}.
        </div>
      </motion.div>

      {/* Odontograma con dientes del plan */}
      {dientesPlan.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-fg">Piezas incluidas en tu plan</h2>
            <div className="flex flex-wrap gap-1">
              {dientesPlan.map((fdi) => (
                <button
                  key={fdi}
                  onMouseEnter={() => setFocusFdi(fdi)}
                  onMouseLeave={() => setFocusFdi(null)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-bold tabular ring-1 ring-inset transition-colors",
                    focusFdi === fdi
                      ? "bg-clinical text-white ring-clinical"
                      : "bg-surface-2 text-muted ring-border hover:text-fg",
                  )}
                >
                  #{fdi}
                </button>
              ))}
            </div>
          </div>
          <OdontogramChart
            denticion={denticion}
            states={states}
            selectedFdi={focusFdi}
            onSelect={() => {}}
            readOnly
          />
        </div>
      )}

      {/* Ítems ya aceptados (en re-presentación parcial) */}
      {yaAceptados.length > 0 && (
        <div className="rounded-2xl border border-mint/30 bg-mint/5 p-4">
          <p className="mb-2 text-sm font-bold text-mint">Ya aceptado anteriormente</p>
          <ul className="space-y-1">
            {yaAceptados.map((it) => (
              <li key={it.id} className="flex items-center justify-between text-sm text-fg">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-mint" />
                  {it.descripcion}
                </span>
                <span className="font-semibold tabular">{formatRD(it.subtotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Comparativa de opciones */}
      {[...grupos.entries()].map(([grupo, items]) => (
        <div key={grupo} className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-dark dark:text-gold-light" />
            <h3 className="text-sm font-bold text-fg">
              Elige una opción {grupo ? `· ${grupo.replace(/_/g, " ")}` : ""}
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {items.map((it) => {
              const active = selected.has(it.id);
              return (
                <button
                  key={it.id}
                  onClick={() => toggle(it)}
                  onMouseEnter={() => it.diente_fdi && setFocusFdi(it.diente_fdi)}
                  onMouseLeave={() => setFocusFdi(null)}
                  className={cn(
                    "flex flex-col rounded-xl border-2 p-4 text-left transition-all",
                    active
                      ? "border-clinical bg-clinical/10 shadow-card"
                      : "border-border bg-surface hover:border-clinical/40",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-bold text-fg">{it.descripcion}</span>
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border-2",
                        active ? "border-clinical bg-clinical text-white" : "border-border",
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </span>
                  </span>
                  <span className="mt-2 text-lg font-extrabold tabular text-clinical">
                    {formatRD(it.subtotal)}
                  </span>
                  {it.fase_nombre && (
                    <span className="mt-1 text-xs text-muted">{it.fase_nombre}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Fases seleccionables */}
      {fases.map(([fase, items]) => (
        <div key={fase} className="rounded-2xl border border-border bg-surface shadow-card dark:bg-surface/80">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Layers className="h-4 w-4 text-clinical" />
            <h3 className="text-sm font-bold text-fg">{fase}</h3>
          </div>
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const active = selected.has(it.id);
              const prio = PRIORIDAD[it.prioridad];
              return (
                <li key={it.id}>
                  <button
                    onClick={() => toggle(it)}
                    onMouseEnter={() => it.diente_fdi && setFocusFdi(it.diente_fdi)}
                    onMouseLeave={() => setFocusFdi(null)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                        active ? "border-clinical bg-clinical text-white" : "border-border",
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-fg">{it.descripcion}</span>
                        {it.diente_fdi && (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold tabular text-muted">
                            #{it.diente_fdi}
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                            prio.chip,
                          )}
                        >
                          {prio.label}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular text-fg">
                      {formatRD(it.subtotal)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Rechazo con motivo */}
      {rejecting && (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
          <label className="mb-1.5 block text-sm font-semibold text-fg">
            Motivo (opcional — ayuda a mejorar la propuesta)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Ej. Prefiere esperar, evaluar costo…"
            className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-fg outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="danger" icon={X} onClick={reject} loading={busy}>
              Confirmar rechazo
            </Button>
          </div>
        </div>
      )}

      {/* Barra de acción fija */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {selected.size} servicio{selected.size === 1 ? "" : "s"} seleccionado
              {selected.size === 1 ? "" : "s"}
            </p>
            <p className="text-xl font-extrabold tabular text-clinical">{formatRD(selectedTotal)}</p>
          </div>
          <div className="flex gap-2">
            {!rejecting && (
              <Button variant="ghost" icon={X} onClick={() => setRejecting(true)} disabled={busy}>
                Rechazar
              </Button>
            )}
            <Button icon={Check} onClick={accept} loading={busy} disabled={selected.size === 0}>
              Aceptar seleccionados
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
