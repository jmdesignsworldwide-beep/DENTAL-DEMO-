import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getBudget, type BudgetItemDTO } from "@/lib/budgets";
import { formatRD, formatDateLong } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { ESTADO_PRESUPUESTO } from "@/app/(app)/presupuestos/estado-config";
import { PrintBar } from "./print-button";

export const metadata: Metadata = {
  title: "Presupuesto — Impresión",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function PrintBudgetPage({ params }: { params: { id: string } }) {
  await requireRole(["owner", "dentista", "recepcionista"]);
  const b = await getBudget(params.id);
  if (!b) notFound();

  // Agrupa por fase, respetando el orden.
  const fases = new Map<string, BudgetItemDTO[]>();
  for (const it of b.items) {
    const key = it.fase_nombre ?? "Servicios";
    if (!fases.has(key)) fases.set(key, []);
    fases.get(key)!.push(it);
  }
  const subtotal = b.items.reduce((a, i) => a + i.subtotal, 0);
  const estado = ESTADO_PRESUPUESTO[b.estado];
  const dientes = Array.from(
    new Set(b.items.map((i) => i.diente_fdi).filter((x): x is number => !!x)),
  ).sort((a, c) => a - c);

  return (
    <div className="min-h-screen bg-white text-[#0A1628]">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PrintBar
          budgetId={b.id}
          telefono={b.paciente_telefono}
          paciente={b.paciente}
          titulo={b.titulo}
          total={b.total_estimado}
        />

        <header className="mb-6 flex items-start justify-between border-b-2 border-[#0066CC] pb-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <div>
              <p className="text-lg font-extrabold tracking-tight">Clínica Dental</p>
              <p className="text-xs text-[#475569]">
                RNC: 1-31-00000-0 · Av. Winston Churchill #90, Santo Domingo
              </p>
              <p className="text-xs text-[#475569]">Tel: 809-555-0100</p>
            </div>
          </div>
          <div className="text-right text-xs text-[#475569]">
            <p className="text-sm font-bold text-[#0066CC]">PLAN DE TRATAMIENTO</p>
            <p className="font-semibold">{estado.label}</p>
            {b.version > 1 && <p>Versión {b.version}</p>}
            <p>{formatDateLong(b.created_at)}</p>
          </div>
        </header>

        <section className="mb-5 rounded-lg bg-[#F4F8FC] p-4 text-sm">
          <p className="text-base font-bold">{b.titulo}</p>
          <p className="mt-1">
            <span className="font-semibold text-[#475569]">Paciente:</span> {b.paciente}
          </p>
          {b.paciente_cedula && (
            <p>
              <span className="font-semibold text-[#475569]">Cédula:</span> {b.paciente_cedula}
            </p>
          )}
          {b.odontologo && (
            <p>
              <span className="font-semibold text-[#475569]">Odontólogo:</span> {b.odontologo}
            </p>
          )}
          {b.fecha_vencimiento && (
            <p>
              <span className="font-semibold text-[#475569]">Válido hasta:</span>{" "}
              {formatDateLong(b.fecha_vencimiento)}
            </p>
          )}
          {b.diagnostico_general && (
            <p className="mt-2 text-[#334155]">
              <span className="font-semibold text-[#475569]">Diagnóstico:</span>{" "}
              {b.diagnostico_general}
            </p>
          )}
        </section>

        {dientes.length > 0 && (
          <section className="mb-5">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#475569]">
              Piezas incluidas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dientes.map((fdi) => (
                <span
                  key={fdi}
                  className="rounded-md bg-[#E8F1FB] px-2 py-0.5 text-xs font-bold text-[#0066CC]"
                >
                  #{fdi}
                </span>
              ))}
            </div>
          </section>
        )}

        {[...fases.entries()].map(([fase, items]) => (
          <section key={fase} className="mb-4">
            <p className="mb-1 border-l-4 border-[#0066CC] pl-2 text-sm font-bold text-[#0A1628]">
              {fase}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#CBD5E1] text-[11px] uppercase text-[#475569]">
                  <th className="py-1.5 text-left font-bold">Servicio</th>
                  <th className="py-1.5 text-right font-bold">Cant.</th>
                  <th className="py-1.5 text-right font-bold">Precio</th>
                  <th className="py-1.5 text-right font-bold">Importe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-[#E2E8F0]">
                    <td className="py-1.5">
                      {it.descripcion}
                      {it.diente_fdi ? (
                        <span className="text-[#475569]"> · pieza {it.diente_fdi}</span>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-right tabular">{it.cantidad}</td>
                    <td className="py-1.5 text-right tabular">{formatRD(it.precio_unitario)}</td>
                    <td className="py-1.5 text-right tabular">{formatRD(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
          <Line label="Subtotal" value={formatRD(subtotal)} />
          {b.descuento_global > 0 && (
            <Line label="Descuento" value={`- ${formatRD(b.descuento_global)}`} />
          )}
          <div className="flex justify-between border-t border-[#0066CC] pt-1 text-base font-extrabold text-[#0066CC]">
            <span>Total estimado</span>
            <span className="tabular">{formatRD(b.total_estimado)}</span>
          </div>
        </div>

        {/* Firmas */}
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-[#475569]">
          <div>
            <div className="mb-1 border-t border-[#94A3B8]" />
            Firma del paciente
          </div>
          <div>
            <div className="mb-1 border-t border-[#94A3B8]" />
            Firma del odontólogo
          </div>
        </div>

        <footer className="mt-10 border-t border-[#E2E8F0] pt-3 text-center text-[10px] text-[#94A3B8]">
          Presupuesto informativo (demo). Los precios pueden variar según hallazgos clínicos ·
          Clínica Dental
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
