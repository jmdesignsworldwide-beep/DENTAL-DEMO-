import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { getPatientRecords } from "@/lib/clinical";
import { calcularEdad } from "@/lib/validation";
import { formatDateLong } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { PrintBar } from "./print-button";

export const metadata: Metadata = { title: "Historia clínica — Impresión", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PrintHistoriaPage({
  params,
}: {
  params: { patientId: string };
}) {
  await requireRole(["owner", "dentista"]);
  const patient = await getPatient(params.patientId);
  if (!patient) notFound();
  const records = await getPatientRecords(patient.id);
  const edad = calcularEdad(patient.fecha_nacimiento);

  return (
    <div className="min-h-screen bg-white text-[#0A1628]">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PrintBar patientId={patient.id} />

        {/* Membrete */}
        <header className="mb-6 flex items-center justify-between border-b-2 border-[#0066CC] pb-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <div>
              <p className="text-lg font-extrabold tracking-tight">
                Clínica Dental
              </p>
              <p className="text-xs text-[#475569]">
                Sistema de Gestión · República Dominicana
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-[#475569]">
            <p className="font-semibold text-[#0066CC]">HISTORIA CLÍNICA</p>
            <p>Emitido: {formatDateLong(new Date())}</p>
          </div>
        </header>

        {/* Datos del paciente */}
        <section className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-[#F4F8FC] p-4 text-sm">
          <Dato label="Paciente" value={patient.nombre} />
          <Dato label="Cédula" value={patient.cedula ?? "—"} />
          <Dato label="Edad" value={edad !== null ? `${edad} años` : "—"} />
          <Dato label="Teléfono" value={patient.telefono ?? "—"} />
          <Dato label="Tipo de sangre" value={patient.tipo_sangre ?? "—"} />
          <Dato label="Seguro" value={patient.seguro ?? "—"} />
          {patient.alergias && (
            <div className="col-span-2 mt-1 rounded border border-[#EF4444]/40 bg-[#EF4444]/5 px-2 py-1 text-[#B91C1C]">
              <span className="font-bold">Alergias:</span> {patient.alergias}
            </div>
          )}
        </section>

        {/* Entradas */}
        <section className="space-y-4">
          {records.length === 0 ? (
            <p className="text-sm text-[#475569]">Sin entradas registradas.</p>
          ) : (
            records.map((r) => (
              <article
                key={r.id}
                className="break-inside-avoid rounded-lg border border-[#E2E8F0] p-4"
              >
                <div className="mb-2 flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                  <p className="font-bold">{formatDateLong(r.fecha)}</p>
                  <p className="text-xs text-[#475569]">
                    {r.odontologo_nombre ?? ""}
                    {r.firmada ? " · Firmada" : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <Campo label="Motivo" value={r.motivo_consulta} />
                  <Campo label="Diagnóstico" value={r.diagnostico} />
                  <Campo label="Tratamiento" value={r.tratamiento_realizado} />
                  <Campo label="Materiales" value={r.materiales_usados} />
                  <Campo
                    label="Signos vitales"
                    value={[
                      r.presion_arterial ? `P/A ${r.presion_arterial} mmHg` : null,
                      r.frecuencia_cardiaca ? `FC ${r.frecuencia_cardiaca} lpm` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null}
                  />
                  <Campo label="Medicamentos" value={r.medicamentos_recetados} />
                  {r.notas_clinicas && (
                    <div className="col-span-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#475569]">
                        Notas clínicas
                      </p>
                      <p className="whitespace-pre-wrap">{r.notas_clinicas}</p>
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        <footer className="mt-8 border-t border-[#E2E8F0] pt-3 text-center text-[10px] text-[#94A3B8]">
          Documento generado por el Sistema de Gestión de Clínica Dental ·
          Confidencial · {formatDateLong(new Date())}
        </footer>
      </div>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold text-[#475569]">{label}:</span> {value}
    </p>
  );
}

function Campo({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#475569]">
        {label}
      </p>
      <p>{value}</p>
    </div>
  );
}
