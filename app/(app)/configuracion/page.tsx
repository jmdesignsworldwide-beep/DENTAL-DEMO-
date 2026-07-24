import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRealOwner } from "@/lib/auth";
import { getSettingsData } from "@/lib/settings";
import { ConfiguracionClient } from "./configuracion-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

async function Data() {
  await requireRealOwner();
  const data = await getSettingsData();
  return <ConfiguracionClient data={data} />;
}

export default function ConfiguracionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-9 w-48" />
          <div className="flex gap-6">
            <Skeleton className="hidden h-96 w-56 rounded-2xl lg:block" />
            <Skeleton className="h-96 flex-1 rounded-2xl" />
          </div>
        </div>
      }
    >
      <Data />
    </Suspense>
  );
}
