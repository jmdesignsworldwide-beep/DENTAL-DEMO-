import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { getOdontogram } from "@/lib/odontogram";
import { getSignedPhotoUrl } from "@/lib/storage";
import { OdontogramClient } from "../odontogram-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { patientId: string };
}): Promise<Metadata> {
  const p = await getPatient(params.patientId);
  return { title: p ? `Odontograma · ${p.nombre}` : "Odontograma" };
}

export default async function OdontogramaPacientePage({
  params,
}: {
  params: { patientId: string };
}) {
  const user = await requireRole(["owner", "dentista", "asistente"]);
  const patient = await getPatient(params.patientId);
  if (!patient) notFound();

  const [data, fotoUrl] = await Promise.all([
    getOdontogram(patient.id),
    getSignedPhotoUrl(patient.foto_path),
  ]);

  const canWrite =
    user.rol === "owner" || user.rol === "dentista" || user.rol === "asistente";

  return (
    <OdontogramClient
      patientId={patient.id}
      patientNombre={patient.nombre}
      patientVip={patient.es_vip}
      fotoUrl={fotoUrl}
      data={data}
      canWrite={canWrite}
    />
  );
}
