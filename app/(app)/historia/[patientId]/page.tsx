import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { getPatientRecords } from "@/lib/clinical";
import { listDentists } from "@/lib/appointments";
import { getSignedPhotoUrl } from "@/lib/storage";
import { HistoriaTimeline } from "../historia-timeline";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { patientId: string };
}): Promise<Metadata> {
  const p = await getPatient(params.patientId);
  return { title: p ? `Historia · ${p.nombre}` : "Historia clínica" };
}

export default async function HistoriaPacientePage({
  params,
}: {
  params: { patientId: string };
}) {
  const user = await requireRole(["owner", "dentista"]);
  const patient = await getPatient(params.patientId);
  if (!patient) notFound();

  const [records, dentists, fotoUrl] = await Promise.all([
    getPatientRecords(patient.id),
    listDentists(),
    getSignedPhotoUrl(patient.foto_path),
  ]);

  return (
    <HistoriaTimeline
      patientId={patient.id}
      patientNombre={patient.nombre}
      patientVip={patient.es_vip}
      fotoUrl={fotoUrl}
      records={records}
      canWrite={user.rol === "owner" || user.rol === "dentista"}
      odontologos={dentists}
      defaultOdontologo={user.nombre}
    />
  );
}
