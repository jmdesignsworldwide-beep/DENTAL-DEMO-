"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileDown,
  MessageCircle,
  Ban,
  Plus,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Field } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatRD, formatDateLong } from "@/lib/utils";
import type { InvoiceFull } from "@/lib/billing";
import {
  ESTADO_FACTURA,
  METODO_PAGO,
  METODOS,
  type MetodoPago,
} from "../estado-config";
import { addPayment, cancelInvoice } from "../actions";

export function InvoiceDetailView({
  invoice,
  canWrite,
}: {
  invoice: InvoiceFull;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const [payOpen, setPayOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [metodo, setMetodo] = React.useState<MetodoPago>("efectivo");
  const [monto, setMonto] = React.useState(invoice.saldo);
  const [ref, setRef] = React.useState("");
  const [motivo, setMotivo] = React.useState("");

  const est = ESTADO_FACTURA[invoice.estado];
  const anulada = invoice.estado === "anulada";

  const waPhone = (invoice.paciente_telefono ?? "").replace(/\D/g, "");
  const waNumber = waPhone.length === 10 ? `1${waPhone}` : waPhone;
  const waMsg = encodeURIComponent(
    `Hola ${invoice.paciente}, le compartimos su factura ${invoice.ncf ?? ""} de Clínica Dental por ${formatRD(invoice.total)}.` +
      (invoice.saldo > 0 ? ` Saldo pendiente: ${formatRD(invoice.saldo)}.` : " Pagada en su totalidad.") +
      " ¡Gracias por su preferencia!",
  );
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${waMsg}` : null;

  function pagar() {
    start(async () => {
      const r = await addPayment(invoice.id, metodo, monto, ref);
      if (r.ok) {
        toast.success("Pago registrado");
        setPayOpen(false);
        setRef("");
        router.refresh();
      } else toast.error("Error", r.error);
    });
  }
  function anular() {
    start(async () => {
      const r = await cancelInvoice(invoice.id, motivo);
      if (r.ok) {
        toast.success("Factura anulada");
        setCancelOpen(false);
        router.refresh();
      } else toast.error("Error", r.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/facturacion" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Facturación
      </Link>

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-clinical" />
                <h1 className="text-xl font-extrabold tracking-tight text-fg tabular">{invoice.ncf ?? "Sin NCF"}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${est.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${est.dot}`} />
                  {est.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {invoice.paciente}
                {invoice.paciente_cedula ? ` · ${invoice.paciente_cedula}` : ""} · {formatDateLong(invoice.fecha)}
              </p>
              <p className="text-xs text-muted">Comprobante tipo {invoice.tipo_ncf}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/imprimir/factura/${invoice.id}`} target="_blank">
                <Button variant="secondary" size="sm" icon={FileDown}>PDF</Button>
              </Link>
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm" icon={MessageCircle} className="text-mint">WhatsApp</Button>
                </a>
              )}
            </div>
          </div>

          {anulada && invoice.motivo_cancelacion && (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
              <span className="font-semibold">Anulada — motivo:</span> {invoice.motivo_cancelacion}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ítems */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 text-left font-bold">Descripción</th>
                  <th className="py-2 text-right font-bold">Cant.</th>
                  <th className="py-2 text-right font-bold">Precio</th>
                  <th className="py-2 text-right font-bold">Desc.</th>
                  <th className="py-2 text-right font-bold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it) => (
                  <tr key={it.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 text-fg">{it.descripcion}</td>
                    <td className="py-2 text-right text-muted tabular">{it.cantidad}</td>
                    <td className="py-2 text-right text-muted tabular">{formatRD(it.precio_unitario)}</td>
                    <td className="py-2 text-right text-muted tabular">{formatRD(it.descuento_item)}</td>
                    <td className="py-2 text-right font-semibold text-fg tabular">{formatRD(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto max-w-xs space-y-1.5">
            <Tot label="Subtotal" value={formatRD(invoice.subtotal)} />
            {invoice.descuento_global > 0 && <Tot label="Descuento global" value={`- ${formatRD(invoice.descuento_global)}`} />}
            <Tot label="ITBIS (18%)" value={formatRD(invoice.itbis)} />
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="font-bold text-fg">Total</span>
              <span className="text-lg font-extrabold text-clinical tabular">{formatRD(invoice.total)}</span>
            </div>
            <Tot label="Pagado" value={formatRD(invoice.pagado)} />
            {invoice.saldo > 0 && !anulada && (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-danger">Saldo</span>
                <span className="font-bold text-danger tabular">{formatRD(invoice.saldo)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Pagos</CardTitle>
          {canWrite && !anulada && invoice.saldo > 0 && (
            <Button size="sm" icon={Plus} onClick={() => { setMonto(invoice.saldo); setPayOpen(true); }}>
              Registrar pago
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted">Sin pagos registrados.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-fg">{METODO_PAGO[p.metodo]}</span>
                  <span className="text-xs text-muted">{p.referencia ?? ""}</span>
                  <span className="font-bold text-fg tabular">{formatRD(p.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canWrite && !anulada && (
        <div className="flex justify-end">
          <Button variant="ghost" icon={Ban} className="text-danger" onClick={() => setCancelOpen(true)}>
            Anular factura
          </Button>
        </div>
      )}

      {/* Modal pago */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Registrar pago"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button icon={Plus} loading={pending} onClick={pagar}>Registrar</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Método">
            <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {METODOS.filter((m) => m !== "mixto").map((m) => (
                <option key={m} value={m}>{METODO_PAGO[m as MetodoPago]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Monto (RD$)">
            <Input type="number" value={monto} onChange={(e) => setMonto(Math.max(0, parseFloat(e.target.value) || 0))} />
          </Field>
          {(metodo === "transferencia" || metodo === "tarjeta") && (
            <Field label="Voucher / referencia" className="sm:col-span-2">
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="No. de voucher" />
            </Field>
          )}
        </div>
      </Modal>

      {/* Modal anular */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Anular factura"
        description="La factura no se borra; queda anulada con su motivo registrado permanentemente."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Cancelar</Button>
            <Button variant="danger" icon={Ban} loading={pending} disabled={motivo.trim().length < 3} onClick={anular}>
              Anular
            </Button>
          </>
        }
      >
        <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la anulación" autoFocus />
      </Modal>
    </div>
  );
}

function Tot({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-fg tabular">{value}</span>
    </div>
  );
}
