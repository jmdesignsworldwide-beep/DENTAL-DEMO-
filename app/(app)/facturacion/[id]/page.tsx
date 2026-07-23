import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getInvoice } from "@/lib/billing";
import { InvoiceDetailView } from "./invoice-detail-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const inv = await getInvoice(params.id);
  return { title: inv ? `Factura ${inv.ncf ?? ""}` : "Factura" };
}

export default async function InvoicePage({ params }: { params: { id: string } }) {
  await requireRole(["owner", "recepcionista"]);
  const invoice = await getInvoice(params.id);
  if (!invoice) notFound();
  return <InvoiceDetailView invoice={invoice} canWrite />;
}
