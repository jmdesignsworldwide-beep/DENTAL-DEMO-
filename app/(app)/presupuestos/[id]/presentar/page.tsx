import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getBudget } from "@/lib/budgets";
import { getOdontogram } from "@/lib/odontogram";
import { PresentationClient } from "./presentation-client";

export const metadata: Metadata = { title: "Presentación del plan", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PresentarPage({ params }: { params: { id: string } }) {
  await requireRole(["owner", "dentista", "recepcionista"]);
  const budget = await getBudget(params.id);
  if (!budget) notFound();
  // Solo tiene sentido presentar planes ya presentados (o aceptados parciales).
  if (!["presentado", "aceptado_parcial"].includes(budget.estado)) {
    redirect(`/presupuestos/${budget.id}`);
  }

  const odontogram = await getOdontogram(budget.paciente_id);

  return <PresentationClient budget={budget} states={odontogram.states} />;
}
