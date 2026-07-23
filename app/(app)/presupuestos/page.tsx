import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole, getActiveUser } from "@/lib/auth";
import { listBudgets, getBudgetKPIs } from "@/lib/budgets";
import { listPatientsBasic } from "@/lib/appointments";
import { PresupuestosClient } from "./presupuestos-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { BudgetEstado } from "./estado-config";

export const metadata: Metadata = { title: "Presupuestos" };
export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Data({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(["owner", "dentista", "recepcionista", "asistente"]);
  const user = await getActiveUser();
  const canCreate = user?.rol === "owner" || user?.rol === "dentista";

  const q = one(searchParams.q) ?? "";
  const estado = (one(searchParams.estado) ?? "todos") as BudgetEstado | "todos";
  const page = Math.max(1, parseInt(one(searchParams.page) ?? "1", 10) || 1);

  const [res, kpis, patients] = await Promise.all([
    listBudgets({ q, estado, page }),
    getBudgetKPIs(),
    canCreate ? listPatientsBasic() : Promise.resolve([]),
  ]);

  return (
    <PresupuestosClient
      rows={res.rows}
      total={res.total}
      page={res.page}
      pageCount={res.pageCount}
      kpis={kpis}
      q={q}
      estado={estado}
      patients={patients}
      canCreate={canCreate}
    />
  );
}

export default function PresupuestosPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-9 w-56" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <Data searchParams={searchParams} />
    </Suspense>
  );
}
