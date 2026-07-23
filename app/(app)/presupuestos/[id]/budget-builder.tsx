"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  Printer,
  Presentation,
  CalendarPlus,
  Receipt,
  Trophy,
  Copy,
  Stethoscope,
  User,
  CalendarClock,
  Tag,
  Layers,
  History,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatRD, formatDateLong, relativeTime, cn } from "@/lib/utils";
import type { BudgetFull, BudgetItemDTO } from "@/lib/budgets";
import type { CatalogItem } from "@/lib/treatments";
import {
  ESTADO_PRESUPUESTO,
  PRIORIDAD,
  ITEM_ESTADO,
  type Prioridad,
} from "../estado-config";
import {
  addBudgetItem,
  removeBudgetItem,
  updateBudgetMeta,
  presentBudget,
  generateAppointmentsFromBudget,
  generateInvoiceFromBudget,
  completeBudget,
  newBudgetVersion,
} from "../actions";

const PRIORIDADES: Prioridad[] = ["urgente", "necesario", "electivo"];

export function BudgetBuilder({
  budget,
  catalog,
  canInvoice,
}: {
  budget: BudgetFull;
  catalog: CatalogItem[];
  canInvoice: boolean;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [busy, setBusy] = React.useState(false);

  const cfg = ESTADO_PRESUPUESTO[budget.estado];
  const Icon = cfg.icon;
  const cerrado = ["aceptado", "aceptado_parcial", "completado"].includes(budget.estado);
  const puedeEditarItems = budget.canEdit && (budget.estado === "borrador" || budget.estado === "presentado");
  const subtotal = budget.items.reduce((a, i) => a + i.subtotal, 0);

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
    after?: () => void,
  ) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      success(okMsg);
      after ? after() : router.refresh();
    } else {
      error("No se pudo completar", res.error);
    }
  };

  // Agrupa ítems por fase (respetando el orden).
  const fases = React.useMemo(() => {
    const map = new Map<string, BudgetItemDTO[]>();
    for (const it of budget.items) {
      const key = it.fase_nombre ?? "Servicios";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [budget.items]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/presupuestos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Presupuestos
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ─── Columna principal ─── */}
        <div className="space-y-5">
          {/* Cabecera */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card dark:bg-surface/80">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                    cfg.chip,
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
                <h1 className="mt-2 text-xl font-extrabold tracking-tight text-fg">
                  {budget.titulo}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <Link
                    href={`/pacientes/${budget.paciente_id}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-clinical hover:underline"
                  >
                    <User className="h-4 w-4" />
                    {budget.paciente}
                  </Link>
                  {budget.odontologo && (
                    <span className="inline-flex items-center gap-1.5">
                      <Stethoscope className="h-4 w-4" />
                      {budget.odontologo}
                    </span>
                  )}
                  {budget.fecha_vencimiento && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4" />
                      Vence {formatDateLong(budget.fecha_vencimiento)}
                    </span>
                  )}
                </div>
              </div>
              {budget.version > 1 && (
                <Badge variant="neutral">Versión {budget.version}</Badge>
              )}
            </div>

            {budget.diagnostico_general && (
              <div className="mt-4 rounded-xl bg-surface-2 p-3.5 text-sm text-fg">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                  Diagnóstico general
                </p>
                {budget.diagnostico_general}
              </div>
            )}
            {!budget.canSeeClinical && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
                <Info className="h-3.5 w-3.5" />
                El diagnóstico clínico solo es visible para el odontólogo.
              </p>
            )}
            {budget.motivo_rechazo && (
              <div className="mt-4 rounded-xl border border-danger/20 bg-danger/5 p-3.5 text-sm text-danger">
                <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide">Motivo de rechazo</p>
                {budget.motivo_rechazo}
              </div>
            )}
          </div>

          {/* Ítems por fase */}
          <div className="space-y-4">
            {fases.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
                Aún no hay servicios en este plan.
                {puedeEditarItems && " Agrégalos abajo."}
              </div>
            )}
            {fases.map(([fase, items]) => (
              <div key={fase} className="rounded-2xl border border-border bg-surface shadow-card dark:bg-surface/80">
                <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                  <Layers className="h-4 w-4 text-clinical" />
                  <h3 className="text-sm font-bold text-fg">{fase}</h3>
                  <span className="ml-auto text-xs font-semibold text-muted tabular">
                    {formatRD(items.reduce((a, i) => a + i.subtotal, 0))}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {items.map((it) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      canEdit={puedeEditarItems}
                      busy={busy}
                      onRemove={() =>
                        run(
                          () => removeBudgetItem(budget.id, it.id),
                          "Servicio eliminado",
                        )
                      }
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Agregar servicio */}
          {puedeEditarItems && (
            <AddItemForm
              budgetId={budget.id}
              catalog={catalog}
              busy={busy}
              onAdded={() => {
                success("Servicio agregado");
                router.refresh();
              }}
              onError={(m) => error("No se pudo agregar", m)}
            />
          )}

          {/* Bitácora */}
          {budget.events.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card dark:bg-surface/80">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-clinical" />
                <h3 className="text-sm font-bold text-fg">Historial del plan</h3>
              </div>
              <ol className="space-y-3">
                {budget.events.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-clinical/60" />
                    <div>
                      <p className="text-sm font-medium text-fg">{ev.detalle ?? ev.tipo}</p>
                      <p className="text-xs text-muted">{relativeTime(ev.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card dark:bg-surface/80">
            <h3 className="text-sm font-bold text-fg">Resumen económico</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Subtotal" value={formatRD(subtotal)} />
              {budget.descuento_global > 0 && (
                <Row label="Descuento global" value={`- ${formatRD(budget.descuento_global)}`} />
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="font-bold text-fg">Total estimado</dt>
                <dd className="text-lg font-extrabold tabular text-clinical">
                  {formatRD(budget.total_estimado)}
                </dd>
              </div>
            </dl>

            {budget.canEdit && !cerrado && (
              <DiscountEditor
                budgetId={budget.id}
                current={budget.descuento_global}
                busy={busy}
                onSaved={() => {
                  success("Descuento actualizado");
                  router.refresh();
                }}
                onError={(m) => error("No se pudo guardar", m)}
              />
            )}
          </div>

          {/* Acciones */}
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-5 shadow-card dark:bg-surface/80">
            <h3 className="mb-1 text-sm font-bold text-fg">Acciones</h3>

            {budget.estado === "borrador" && budget.canEdit && (
              <Button
                icon={Send}
                className="w-full"
                loading={busy}
                disabled={budget.items.length === 0}
                onClick={() => run(() => presentBudget(budget.id), "Presupuesto presentado")}
              >
                Presentar al paciente
              </Button>
            )}

            {budget.estado === "presentado" && (
              <Link href={`/presupuestos/${budget.id}/presentar`} className="block">
                <Button icon={Presentation} className="w-full">
                  Modo presentación
                </Button>
              </Link>
            )}

            {cerrado && (
              <>
                <Button
                  icon={CalendarPlus}
                  variant="secondary"
                  className="w-full"
                  loading={busy}
                  onClick={() =>
                    run(
                      () => generateAppointmentsFromBudget(budget.id),
                      "Citas generadas",
                    )
                  }
                >
                  Generar citas
                </Button>
                {canInvoice && (
                  <Button
                    icon={Receipt}
                    variant="secondary"
                    className="w-full"
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      const res = await generateInvoiceFromBudget(budget.id);
                      setBusy(false);
                      if (res.ok && res.invoiceId) {
                        success("Factura generada");
                        router.push(`/facturacion/${res.invoiceId}`);
                      } else error("No se pudo facturar", res.error);
                    }}
                  >
                    Generar factura
                  </Button>
                )}
                {budget.canEdit && budget.estado !== "completado" && (
                  <Button
                    icon={Trophy}
                    variant="gold"
                    className="w-full"
                    loading={busy}
                    onClick={() => run(() => completeBudget(budget.id), "Plan completado")}
                  >
                    Marcar completado
                  </Button>
                )}
              </>
            )}

            {/* Imprimir siempre disponible cuando ya hay servicios */}
            {budget.items.length > 0 && (
              <Link href={`/imprimir/presupuesto/${budget.id}`} target="_blank" className="block">
                <Button icon={Printer} variant="ghost" className="w-full">
                  Imprimir / PDF
                </Button>
              </Link>
            )}

            {/* Nueva versión para planes cerrados o rechazados */}
            {budget.canEdit &&
              ["rechazado", "vencido", "aceptado_parcial", "completado"].includes(budget.estado) && (
                <Button
                  icon={Copy}
                  variant="ghost"
                  className="w-full"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    const res = await newBudgetVersion(budget.id);
                    setBusy(false);
                    if (res.ok && res.id) {
                      success("Nueva versión creada");
                      router.push(`/presupuestos/${res.id}`);
                    } else error("No se pudo versionar", res.error);
                  }}
                >
                  Crear nueva versión
                </Button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular text-fg">{value}</dd>
    </div>
  );
}

function ItemRow({
  item,
  canEdit,
  busy,
  onRemove,
}: {
  item: BudgetItemDTO;
  canEdit: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const prio = PRIORIDAD[item.prioridad];
  const estadoItem = ITEM_ESTADO[item.estado_item];
  const bloqueado = ["aceptado", "agendado", "completado"].includes(item.estado_item);
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-fg">{item.descripcion}</span>
          {item.diente_fdi && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold tabular text-muted">
              #{item.diente_fdi}
              {item.superficie ? ` · ${item.superficie}` : ""}
            </span>
          )}
          {item.opcion_grupo && (
            <span className="inline-flex items-center gap-0.5 rounded bg-gold/10 px-1.5 py-0.5 text-[11px] font-bold text-gold-dark dark:text-gold-light">
              <Tag className="h-2.5 w-2.5" />
              opción
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
              prio.chip,
            )}
          >
            {prio.label}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
              estadoItem.chip,
            )}
          >
            {estadoItem.label}
          </span>
          <span className="text-xs text-muted tabular">
            {item.cantidad} × {formatRD(item.precio_unitario)}
            {item.descuento_item > 0 ? ` − ${formatRD(item.descuento_item)}` : ""}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-sm font-bold tabular text-fg">{formatRD(item.subtotal)}</span>
      {canEdit && !bloqueado && (
        <button
          onClick={onRemove}
          disabled={busy}
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
          aria-label="Eliminar servicio"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function DiscountEditor({
  budgetId,
  current,
  busy,
  onSaved,
  onError,
}: {
  budgetId: string;
  current: number;
  busy: boolean;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [val, setVal] = React.useState(String(current || ""));
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const res = await updateBudgetMeta(budgetId, { descuento_global: Number(val) || 0 });
    setSaving(false);
    if (res.ok) onSaved();
    else onError(res.error ?? "Error");
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <label className="mb-1.5 block text-xs font-semibold text-muted">Descuento global (RD$)</label>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none tabular focus:border-clinical focus:ring-2 focus:ring-clinical/20"
        />
        <Button size="sm" onClick={save} loading={saving} disabled={busy}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

function AddItemForm({
  budgetId,
  catalog,
  busy,
  onAdded,
  onError,
}: {
  budgetId: string;
  catalog: CatalogItem[];
  busy: boolean;
  onAdded: () => void;
  onError: (m: string) => void;
}) {
  const [tratamientoId, setTratamientoId] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [precio, setPrecio] = React.useState("");
  const [duracion, setDuracion] = React.useState("30");
  const [cantidad, setCantidad] = React.useState("1");
  const [diente, setDiente] = React.useState("");
  const [prioridad, setPrioridad] = React.useState<Prioridad>("necesario");
  const [fase, setFase] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const onPickCatalog = (id: string) => {
    setTratamientoId(id);
    const t = catalog.find((c) => c.id === id);
    if (t) {
      setDescripcion(t.nombre);
      setPrecio(String(t.precio));
      setDuracion(String(t.duracion_min));
    }
  };

  const reset = () => {
    setTratamientoId("");
    setDescripcion("");
    setPrecio("");
    setDuracion("30");
    setCantidad("1");
    setDiente("");
    setPrioridad("necesario");
    setFase("");
  };

  const submit = async () => {
    if (!descripcion.trim()) return onError("Describe el servicio.");
    setSaving(true);
    const res = await addBudgetItem(budgetId, {
      tratamiento_id: tratamientoId || null,
      descripcion: descripcion.trim(),
      diente_fdi: diente ? Number(diente) : null,
      cantidad: Number(cantidad) || 1,
      precio_unitario: Number(precio) || 0,
      duracion_min: Number(duracion) || 30,
      prioridad,
      fase_nombre: fase.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      reset();
      onAdded();
    } else onError(res.error ?? "Error");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-dashed border-clinical/30 bg-clinical/5 p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4 text-clinical" />
        <h3 className="text-sm font-bold text-fg">Agregar servicio</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-muted">Desde el catálogo</label>
          <select
            value={tratamientoId}
            onChange={(e) => onPickCatalog(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          >
            <option value="">— Servicio personalizado —</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {formatRD(c.precio)}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-muted">Descripción</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej. Resina en pieza 36"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </div>

        <Field label="Precio (RD$)">
          <input
            type="number"
            min={0}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none tabular focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </Field>
        <Field label="Cantidad">
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none tabular focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </Field>
        <Field label="Diente (FDI)">
          <input
            type="number"
            value={diente}
            onChange={(e) => setDiente(e.target.value)}
            placeholder="opcional"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none tabular focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </Field>
        <Field label="Prioridad">
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as Prioridad)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {PRIORIDAD[p].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fase (opcional)" className="sm:col-span-2">
          <input
            value={fase}
            onChange={(e) => setFase(e.target.value)}
            placeholder="Ej. Fase 1 — Higiene"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-clinical focus:ring-2 focus:ring-clinical/20"
          />
        </Field>
      </div>

      <div className="mt-4 flex justify-end">
        <Button icon={Plus} onClick={submit} loading={saving} disabled={busy}>
          Agregar al plan
        </Button>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}
