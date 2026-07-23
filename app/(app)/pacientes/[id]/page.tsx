import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth";
import { getPatient, getTreatmentHistory } from "@/lib/patients";
import { getSignedPhotoUrl } from "@/lib/storage";
import { ProfileView } from "./profile-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const p = await getPatient(params.id);
  return { title: p ? p.nombre : "Paciente" };
}

export default async function PatientPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireActiveUser();
  const patient = await getPatient(params.id);
  if (!patient) notFound();

  const [historial, fotoUrl] = await Promise.all([
    getTreatmentHistory(patient.id),
    getSignedPhotoUrl(patient.foto_path),
  ]);

  const canEdit =
    user.rol === "owner" ||
    user.rol === "recepcionista" ||
    user.rol === "dentista";
  const canSeeIncome = user.rol === "owner" || user.rol === "recepcionista";
  const canSeeClinical = user.rol === "owner" || user.rol === "dentista";
  const canSeeOdonto =
    user.rol === "owner" || user.rol === "dentista" || user.rol === "asistente";

  return (
    <ProfileView
      patient={patient}
      historial={historial}
      fotoUrl={fotoUrl}
      canEdit={canEdit}
      canSeeIncome={canSeeIncome}
      canSeeClinical={canSeeClinical}
      canSeeOdonto={canSeeOdonto}
    />
  );
}
