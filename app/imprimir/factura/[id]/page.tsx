import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getInvoice } from "@/lib/billing";
import { formatRD, formatDateLong } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { ESTADO_FACTURA, METODO_PAGO } from "@/app/(app)/facturacion/estado-config";
import { PrintBar } from "./print-button";

export const metadata: Metadata = { title: "Factura — Impresión", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PrintInvoicePage({ params }: { params: { id: string } }) {
  await requireRole(["owner", "recepcionista"]);
  const inv = await getInvoice(params.id);
  if (!inv) notFound();

  return (
    <div className="min-h-screen bg-white text-[#0A1628]">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PrintBar invoiceId={inv.id} />

        <header className="mb-6 flex items-start justify-between border-b-2 border-[#0066CC] pb-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <div>
              <p className="text-lg font-extrabold tracking-tight">Clínica Dental</p>
              <p className="text-xs text-[#475569]">RNC: 1-31-00000-0 · Av. Winston Churchill #90, Santo Domingo</p>
              <p className="text-xs text-[#475569]">Tel: 809-555-0100</p>
            </div>
          </div>
          <div className="text-right text-xs text-[#475569]">
            <p className="text-sm font-bold text-[#0066CC]">FACTURA</p>
            <p className="font-semibold tabular">{inv.ncf ?? ""}</p>
            <p>Tipo {inv.tipo_ncf}</p>
            <p>{formatDateLong(inv.fecha)}</p>
          </div>
        </header>

        <section className="mb-5 rounded-lg bg-[#F4F8FC] p-4 text-sm">
          <p><span className="font-semibold text-[#475569]">Cliente:</span> {inv.paciente}</p>
          {inv.paciente_cedula && <p><span className="font-semibold text-[#475569]">Cédula:</span> {inv.paciente_cedula}</p>}
          <p><span className="font-semibold text-[#475569]">Estado:</span> {ESTADO_FACTURA[inv.estado].label}</p>
        </section>

        <table className="mb-4 w-full text-sm">
          <thead>
            <tr className="border-b border-[#CBD5E1] text-[11px] uppercase text-[#475569]">
              <th className="py-2 text-left font-bold">Descripción</th>
              <th className="py-2 text-right font-bold">Cant.</th>
              <th className="py-2 text-right font-bold">Precio</th>
              <th className="py-2 text-right font-bold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it) => (
              <tr key={it.id} className="border-b border-[#E2E8F0]">
                <td className="py-2">{it.descripcion}</td>
                <td className="py-2 text-right tabular">{it.cantidad}</td>
                <td className="py-2 text-right tabular">{formatRD(it.precio_unitario)}</td>
                <td className="py-2 text-right tabular">{formatRD(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <Line label="Subtotal" value={formatRD(inv.subtotal)} />
          {inv.descuento_global > 0 && <Line label="Descuento" value={`- ${formatRD(inv.descuento_global)}`} />}
          <Line label="ITBIS (18%)" value={formatRD(inv.itbis)} />
          <div className="flex justify-between border-t border-[#0066CC] pt-1 text-base font-extrabold text-[#0066CC]">
            <span>Total</span>
            <span className="tabular">{formatRD(inv.total)}</span>
          </div>
          {inv.metodo_pago && <Line label="Método de pago" value={METODO_PAGO[inv.metodo_pago]} />}
        </div>

        <footer className="mt-10 border-t border-[#E2E8F0] pt-3 text-center text-[10px] text-[#94A3B8]">
          Comprobante fiscal simulado (demo). Gracias por su preferencia · Clínica Dental
        </footer>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#475569]">{label}</span>
      <span className="font-semibold tabular">{value}</span>
    </div>
  );
}
