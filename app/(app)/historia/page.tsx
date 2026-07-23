import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { listPatientsBasic } from "@/lib/appointments";
import { HistoriaPicker } from "./historia-picker";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Historia clínica" };
export const dynamic = "force-dynamic";

async function Data() {
  await requireRole(["owner", "dentista"]);
  const patients = await listPatientsBasic();
  return <HistoriaPicker patients={patients} />;
}

export default function HistoriaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      }
    >
      <Data />
    </Suspense>
  );
}
