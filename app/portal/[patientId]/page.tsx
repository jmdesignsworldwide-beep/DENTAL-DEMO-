import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveUser } from "@/lib/auth";
import { getPortalData } from "@/lib/patient-portal";
import { BarePortal } from "./bare-portal";

export const metadata: Metadata = {
  title: "Portal del Paciente",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function BarePortalPage({
  params,
}: {
  params: { patientId: string };
}) {
  // Datos sensibles del paciente: exige sesión activa del personal.
  await requireActiveUser();
  const data = await getPortalData(params.patientId);

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="text-lg font-bold text-fg">No se encontró este portal.</p>
        <Link href="/portal-paciente" className="mt-4 rounded-xl bg-clinical px-5 py-2.5 text-sm font-bold text-white">
          Volver al presentador
        </Link>
      </div>
    );
  }

  return <BarePortal data={data} />;
}
