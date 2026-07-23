import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { getInventory } from "@/lib/inventory";
import { InventoryClient } from "./inventory-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Inventario" };
export const dynamic = "force-dynamic";

async function Data() {
  const user = await requireRole(["owner", "recepcionista", "asistente"]);
  const data = await getInventory();
  const canMove = ["owner", "recepcionista", "asistente"].includes(user.rol);
  const canEdit = user.rol === "owner" || user.rol === "recepcionista";
  return <InventoryClient data={data} canMove={canMove} canEdit={canEdit} />;
}

export default function InventarioPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-9 w-40" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <Data />
    </Suspense>
  );
}
