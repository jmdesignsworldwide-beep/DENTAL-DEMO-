import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getPayrollSlip } from "@/lib/staff";
import { formatRD, formatDateLong } from "@/lib/utils";
import {
  escalarPeriodo, montoALetras, PERIODO_LABEL, type Periodo,
} from "@/lib/payroll";
import { LogoMark } from "@/components/brand/logo";
import { PrintBar } from "./print-button";

export const metadata: Metadata = { title: "Volante de pago — Impresión", robots: { index: false } };
export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PERIODOS: Periodo[] = ["mensual", "quincenal", "semanal"];

export default async function VolantePage({
  params,
  searchParams,
}: {
  params: { staffId: string };
  searchParams: SearchParams;
}) {
  await requireRole(["owner"]);
  const slip = await getPayrollSlip(params.staffId);
  if (!slip) notFound();

  const pRaw = one(searchParams.periodo) as Periodo | undefined;
  const periodo: Periodo = pRaw && PERIODOS.includes(pRaw) ? pRaw : "mensual";
  const calc = escalarPeriodo(slip.calc, periodo);
  const [y, m] = slip.periodoMes.split("-").map(Number);
  const mesLargo = new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("es-DO", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-white text-[#0A1628]">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PrintBar />

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
            <p className="text-sm font-bold text-[#0066CC]">VOLANTE DE PAGO</p>
            <p className="font-semibold capitalize">{PERIODO_LABEL[periodo]}</p>
            <p className="capitalize">{mesLargo}</p>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-4 rounded-lg bg-[#F4F8FC] p-4 text-sm">
          <div>
            <p className="text-[11px] font-bold uppercase text-[#475569]">Empleado</p>
            <p className="font-bold">{slip.member.nombre}</p>
            <p className="text-[#475569]">{slip.member.especialidad ?? slip.member.rol}</p>
          </div>
          <div className="text-right">
            {slip.member.exequatur && <p className="text-[#475569]">Exequátur: <span className="font-semibold">{slip.member.exequatur}</span></p>}
            <p className="text-[#475569]">Ingreso: <span className="font-semibold">{formatDateLong(slip.member.fechaIngreso)}</span></p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-6">
          {/* Ingresos */}
          <div>
            <p className="mb-2 border-b border-[#CBD5E1] pb-1 text-[11px] font-bold uppercase text-[#0066CC]">Ingresos</p>
            <Row label="Salario base" value={formatRD(calc.salarioBase)} />
            {calc.comisiones > 0 && <Row label="Comisiones" value={formatRD(calc.comisiones)} />}
            {calc.horasExtra > 0 && <Row label="Horas extra" value={formatRD(calc.horasExtra)} />}
            <div className="mt-1 flex justify-between border-t border-[#E2E8F0] pt-1 font-bold">
              <span>Total ingresos</span>
              <span className="tabular">{formatRD(calc.bruto)}</span>
            </div>
          </div>

          {/* Deducciones */}
          <div>
            <p className="mb-2 border-b border-[#CBD5E1] pb-1 text-[11px] font-bold uppercase text-[#B45309]">Deducciones</p>
            <Row label="AFP (2.87%)" value={formatRD(calc.afp)} />
            <Row label="SFS (3.04%)" value={formatRD(calc.sfs)} />
            {calc.isr > 0 && <Row label="ISR" value={formatRD(calc.isr)} />}
            {calc.otrasDeducciones > 0 && <Row label="Otras (adelantos)" value={formatRD(calc.otrasDeducciones)} />}
            <div className="mt-1 flex justify-between border-t border-[#E2E8F0] pt-1 font-bold">
              <span>Total deducciones</span>
              <span className="tabular">{formatRD(calc.totalDeducciones)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border-2 border-[#0066CC] bg-[#F4F8FC] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#0066CC]">NETO A PAGAR</span>
            <span className="text-2xl font-black tabular text-[#0066CC]">{formatRD(calc.neto)}</span>
          </div>
          <p className="mt-1 text-[11px] italic text-[#475569]">{montoALetras(calc.neto)}</p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs">
          <div className="border-t border-[#94A3B8] pt-2 text-[#475569]">Firma del empleado</div>
          <div className="border-t border-[#94A3B8] pt-2 text-[#475569]">Firma autorizada</div>
        </div>

        <footer className="mt-8 border-t border-[#E2E8F0] pt-3 text-center text-[10px] text-[#94A3B8]">
          Volante de pago simulado (demo). Deducciones según normativa dominicana vigente (TSS + ISR) · Clínica Dental
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-sm">
      <span className="text-[#475569]">{label}</span>
      <span className="font-semibold tabular">{value}</span>
    </div>
  );
}
