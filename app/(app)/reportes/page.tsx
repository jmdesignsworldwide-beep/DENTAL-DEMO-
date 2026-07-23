import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { getReports } from "@/lib/reports";
import { ReportsClient } from "./reports-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function defaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: ymd(from), to: ymd(now) };
}

async function Data({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(["owner"]);
  const def = defaultRange();
  const from = one(searchParams.from) ?? def.from;
  const to = one(searchParams.to) ?? def.to;
  const preset = (one(searchParams.preset) as
    | "este_mes"
    | "mes_pasado"
    | "ultimos_3"
    | "este_anio"
    | "personalizado") ?? "ultimos_3";

  const okDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const data = await getReports(okDate(from) ? from : def.from, okDate(to) ? to : def.to);
  return <ReportsClient data={data} preset={preset} />;
}

export default function ReportesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-9 w-40" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <Data searchParams={searchParams} />
    </Suspense>
  );
}
