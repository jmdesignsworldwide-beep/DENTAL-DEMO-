import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole, getActiveUser } from "@/lib/auth";
import { getBudget } from "@/lib/budgets";
import { listCatalog } from "@/lib/treatments";
import { BudgetBuilder } from "./budget-builder";

export const metadata: Metadata = { title: "Presupuesto" };
export const dynamic = "force-dynamic";

export default async function BudgetDetailPage({ params }: { params: { id: string } }) {
  await requireRole(["owner", "dentista", "recepcionista", "asistente"]);
  const user = await getActiveUser();
  const budget = await getBudget(params.id);
  if (!budget) notFound();

  const catalog = budget.canEdit ? await listCatalog() : [];
  const canInvoice = user?.rol === "owner" || user?.rol === "recepcionista";

  return <BudgetBuilder budget={budget} catalog={catalog} canInvoice={canInvoice} />;
}
