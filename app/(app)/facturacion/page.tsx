import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { listInvoices } from "@/lib/billing";
import { listPatientsBasic } from "@/lib/appointments";
import { BillingClient } from "./billing-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { InvoiceEstado, MetodoPago } from "./estado-config";

export const metadata: Metadata = { title: "Facturación" };
export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Data({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(["owner", "recepcionista"]);
  const q = one(searchParams.q) ?? "";
  const estado = one(searchParams.estado) ?? "todos";
  const metodo = one(searchParams.metodo) ?? "todos";
  const desde = one(searchParams.desde) ?? "";
  const hasta = one(searchParams.hasta) ?? "";
  const page = Math.max(1, parseInt(one(searchParams.page) ?? "1", 10) || 1);

  const [res, patients] = await Promise.all([
    listInvoices({
      q,
      estado: estado as InvoiceEstado | "todos",
      metodo: metodo as MetodoPago | "todos",
      desde,
      hasta,
      page,
    }),
    listPatientsBasic(),
  ]);

  return (
    <BillingClient
      rows={res.rows}
      total={res.total}
      page={res.page}
      pageCount={res.pageCount}
      periodo={res.periodo}
      q={q}
      estado={estado}
      metodo={metodo}
      desde={desde}
      hasta={hasta}
      patients={patients}
      canWrite
    />
  );
}

export default function FacturacionPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-9 w-48" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <Data searchParams={searchParams} />
    </Suspense>
  );
}
