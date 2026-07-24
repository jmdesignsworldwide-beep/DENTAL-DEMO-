import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole, getActiveUser } from "@/lib/auth";
import {
  listTodayQueue,
  listUpcoming,
  listRecentHistory,
  listTemplates,
  getCommStats,
  getImpactMetrics,
} from "@/lib/communications";
import { listPatientsBasic } from "@/lib/appointments";
import { ComunicacionesClient } from "./comunicaciones-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Comunicaciones" };
export const dynamic = "force-dynamic";

async function Data() {
  await requireRole(["owner", "recepcionista", "dentista"]);
  const user = await getActiveUser();
  const isOwner = user?.rol === "owner";

  const [queue, upcoming, history, templates, stats, impact, patients] = await Promise.all([
    listTodayQueue(),
    listUpcoming(),
    listRecentHistory(300),
    listTemplates(),
    getCommStats(),
    getImpactMetrics(),
    listPatientsBasic(),
  ]);

  return (
    <ComunicacionesClient
      queue={queue}
      upcoming={upcoming}
      history={history}
      templates={templates}
      stats={stats}
      impact={impact}
      patients={patients}
      isOwner={isOwner}
    />
  );
}

export default function ComunicacionesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-9 w-56" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <Data />
    </Suspense>
  );
}
