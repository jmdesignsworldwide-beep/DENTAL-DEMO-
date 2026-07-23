"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Search, Check, X, Receipt, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatRD } from "@/lib/utils";
import { SERVICIOS, ITBIS_RATE } from "@/lib/treatments-catalog";
import type { PatientBasic } from "@/lib/appointments";
import type { CatalogItem } from "@/lib/treatments";
import { createInvoice, type NuevoItem } from "./actions";
import { METODOS, METODO_PAGO, type MetodoPago } from "./estado-config";

interface Linea extends NuevoItem {
  key: number;
}
let counter = 0;

export function InvoiceFormModal({
  open,
  onClose,
  patients,
  catalog,
  defaultPatientId,
}: {
  open: boolean;
  onClose: () => void;
  patients: PatientBasic[];
  catalog: CatalogItem[];
  defaultPatientId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [patient, setPatient] = React.useState<PatientBasic | null>(
    defaultPatientId ? patients.find((p) => p.id === defaultPatientId) ?? null : null,
  );
  const [pq, setPq] = React.useState("");
  const [tipoNcf, setTipoNcf] = React.useState<"B01" | "B02">("B02");
  const [lineas, setLineas] = React.useState<Linea[]>([]);
  const [descGlobal, setDescGlobal] = React.useState(0);
  const [notas, setNotas] = React.useState("");
  const [conPago, setConPago] = React.useState(false);
  const [metodo, setMetodo] = React.useState<MetodoPago>("efectivo");
  const [montoPago, setMontoPago] = React.useState(0);
  const [recibido, setRecibido] = React.useState(0);
  const [referencia, setReferencia] = React.useState("");

  const filtered = React.useMemo(() => {
    const s = pq.trim().toLowerCase();
    if (!s) return patients.slice(0, 6);
    return patients.filter((p) => p.nombre.toLowerCase().includes(s)).slice(0, 6);
  }, [pq, patients]);

  const subtotal = lineas.reduce(
    (a, l) => a + (l.precio_unitario * l.cantidad - l.descuento_item),
    0,
  );
  const base = Math.max(0, subtotal - descGlobal);
  const itbis = Math.round(base * ITBIS_RATE * 100) / 100;
  const total = Math.round((base + itbis) * 100) / 100;
  const cambio = metodo === "efectivo" ? Math.max(0, recibido - (montoPago || total)) : 0;

  const opciones = catalog.length
    ? catalog.map((c) => ({ nombre: c.nombre, precio: c.precio, id: c.id as string | undefined }))
    : SERVICIOS.map((s) => ({ nombre: s.nombre, precio: s.precio, id: undefined }));

  function addLinea(nombre?: string, precio?: number, tratId?: string) {
    setLineas((l) => [
      ...l,
      {
        key: ++counter,
        descripcion: nombre ?? "",
        cantidad: 1,
        precio_unitario: precio ?? 0,
        descuento_item: 0,
        tratamiento_id: tratId ?? null,
      },
    ]);
  }
  function updateLinea(key: number, patch: Partial<Linea>) {
    setLineas((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  function submit() {
    setError(null);
    if (!patient) return setError("Selecciona un paciente.");
    if (lineas.length === 0) return setError("Agrega al menos un servicio.");
    start(async () => {
      const res = await createInvoice({
        patientId: patient.id,
        tipo_ncf: tipoNcf,
        descuento_global: descGlobal,
        items: lineas.map(({ descripcion, cantidad, precio_unitario, descuento_item, tratamiento_id }) => ({
          descripcion,
          cantidad,
          precio_unitario,
          descuento_item,
          tratamiento_id,
        })),
        notas,
        pago: conPago
          ? { metodo, monto: montoPago || total, referencia }
          : null,
      });
      if (res.ok && res.id) {
        toast.success("Factura emitida");
        onClose();
        router.push(`/facturacion/${res.id}`);
      } else setError(res.error ?? "No se pudo crear la factura.");
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva factura"
      description="Genera una factura con NCF, ítems e ITBIS automático."
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm font-medium text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Paciente */}
        <Field label="Paciente" required>
          {patient ? (
            <div className="flex items-center justify-between rounded-xl border border-clinical-200 bg-clinical-50 px-3.5 py-2.5 dark:border-clinical-700/50 dark:bg-clinical-900/30">
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Check className="h-4 w-4 text-clinical" />
                {patient.nombre}
              </span>
              <button onClick={() => setPatient(null)} className="text-muted hover:text-danger">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={pq}
                  onChange={(e) => setPq(e.target.value)}
                  placeholder="Buscar paciente…"
                  className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg dark:bg-navy-light"
                />
              </div>
              {pq && (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-border">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPatient(p);
                        setPq("");
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
                    >
                      <span className="font-medium text-fg">{p.nombre}</span>
                      <span className="text-xs text-muted tabular">{p.telefono ?? ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        {/* Tipo NCF */}
        <div className="flex gap-2">
          {(["B02", "B01"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipoNcf(t)}
              className={`flex-1 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold transition-all ${
                tipoNcf === t ? "border-clinical ring-2 ring-clinical/30" : "border-border hover:bg-surface-2"
              }`}
            >
              <span className="block text-fg">{t}</span>
              <span className="block text-xs font-normal text-muted">
                {t === "B02" ? "Consumo" : "Crédito fiscal"}
              </span>
            </button>
          ))}
        </div>

        {/* Ítems */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Servicios</p>
            <Select
              value=""
              onChange={(e) => {
                const s = opciones.find((x) => x.nombre === e.target.value);
                if (s) addLinea(s.nombre, s.precio, s.id);
                e.target.value = "";
              }}
              className="h-9 w-auto"
            >
              <option value="">+ Agregar del catálogo</option>
              {opciones.map((s) => (
                <option key={s.nombre} value={s.nombre}>
                  {s.nombre} — {formatRD(s.precio)}
                </option>
              ))}
            </Select>
          </div>

          {lineas.length === 0 ? (
            <button
              onClick={() => addLinea()}
              className="w-full rounded-xl border border-dashed border-border py-4 text-sm font-medium text-muted hover:border-clinical-300 hover:text-clinical"
            >
              <Plus className="mr-1 inline h-4 w-4" /> Agregar servicio
            </button>
          ) : (
            <div className="space-y-2">
              {lineas.map((l) => (
                <div key={l.key} className="rounded-xl border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={l.descripcion}
                      onChange={(e) => updateLinea(l.key, { descripcion: e.target.value })}
                      placeholder="Descripción del servicio"
                      className="h-9 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg dark:bg-navy-light"
                    />
                    <button onClick={() => setLineas((x) => x.filter((y) => y.key !== l.key))} className="text-muted hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-[11px] font-medium text-muted">
                      Cantidad
                      <input
                        type="number"
                        min={1}
                        value={l.cantidad}
                        onChange={(e) => updateLinea(l.key, { cantidad: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="mt-0.5 h-8 w-full rounded-lg border border-border bg-surface px-2 text-sm text-fg tabular dark:bg-navy-light"
                      />
                    </label>
                    <label className="text-[11px] font-medium text-muted">
                      Precio (RD$)
                      <input
                        type="number"
                        min={0}
                        value={l.precio_unitario}
                        onChange={(e) => updateLinea(l.key, { precio_unitario: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="mt-0.5 h-8 w-full rounded-lg border border-border bg-surface px-2 text-sm text-fg tabular dark:bg-navy-light"
                      />
                    </label>
                    <label className="text-[11px] font-medium text-muted">
                      Descuento
                      <input
                        type="number"
                        min={0}
                        value={l.descuento_item}
                        onChange={(e) => updateLinea(l.key, { descuento_item: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="mt-0.5 h-8 w-full rounded-lg border border-border bg-surface px-2 text-sm text-fg tabular dark:bg-navy-light"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales */}
        <div className="space-y-1.5 rounded-xl bg-surface-2/60 p-3.5 dark:bg-navy-lighter/30">
          <Row label="Subtotal" value={formatRD(subtotal)} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Descuento global</span>
            <input
              type="number"
              min={0}
              value={descGlobal}
              onChange={(e) => setDescGlobal(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-8 w-28 rounded-lg border border-border bg-surface px-2 text-right text-sm text-fg tabular dark:bg-navy-light"
            />
          </div>
          <Row label={`ITBIS (${Math.round(ITBIS_RATE * 100)}%)`} value={formatRD(itbis)} />
          <div className="flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-sm font-bold text-fg">Total</span>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={total}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="text-lg font-extrabold text-clinical tabular"
              >
                {formatRD(total)}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Pago inicial */}
        <label className="flex items-center gap-2 text-sm font-medium text-fg">
          <input type="checkbox" checked={conPago} onChange={(e) => setConPago(e.target.checked)} className="h-4 w-4 rounded border-border text-clinical focus:ring-ring" />
          Registrar pago ahora
        </label>
        {conPago && (
          <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
            <Field label="Método">
              <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                {METODOS.filter((m) => m !== "mixto").map((m) => (
                  <option key={m} value={m}>
                    {METODO_PAGO[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Monto (RD$)">
              <Input
                type="number"
                value={montoPago || total}
                onChange={(e) => setMontoPago(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </Field>
            {metodo === "efectivo" && (
              <>
                <Field label="Efectivo recibido">
                  <Input type="number" value={recibido} onChange={(e) => setRecibido(Math.max(0, parseFloat(e.target.value) || 0))} />
                </Field>
                <div className="flex items-end">
                  <p className="text-sm text-muted">
                    Cambio: <span className="font-bold text-fg tabular">{formatRD(cambio)}</span>
                  </p>
                </div>
              </>
            )}
            {(metodo === "transferencia" || metodo === "tarjeta") && (
              <Field label={metodo === "transferencia" ? "Voucher / referencia" : "Referencia (aprobación)"} className="sm:col-span-2">
                <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="No. de voucher" />
              </Field>
            )}
          </div>
        )}

        <Field label="Notas">
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas de la factura…" />
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={Receipt} loading={pending} onClick={submit}>
            Emitir factura
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-fg tabular">{value}</span>
    </div>
  );
}
