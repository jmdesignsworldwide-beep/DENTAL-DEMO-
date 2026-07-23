import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActiveUser } from "@/lib/auth";
import { listTreatments } from "@/lib/treatments";
import { CatalogClient } from "./catalog-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Tratamientos" };
export const dynamic = "force-dynamic";

async function Data() {
  const user = await requireActiveUser();
  const treatments = await listTreatments();
  return <CatalogClient treatments={treatments} canManage={user.rol === "owner"} />;
}

export default function TratamientosPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <Data />
    </Suspense>
  );
}
