import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRealOwner } from "@/lib/auth";
import { listDemoAccounts } from "@/lib/demos";
import { AccesoDemosClient } from "./acceso-demos-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Acceso Demos" };
export const dynamic = "force-dynamic";

async function Data() {
  await requireRealOwner();
  const cuentas = await listDemoAccounts();
  return <AccesoDemosClient cuentas={cuentas} />;
}

export default function AccesoDemosPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton className="h-9 w-56" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      }
    >
      <Data />
    </Suspense>
  );
}
