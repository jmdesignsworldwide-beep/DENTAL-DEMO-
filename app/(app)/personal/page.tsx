import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { getStaffModuleData } from "@/lib/staff";
import { PersonalClient } from "./personal-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Personal y Nómina" };
export const dynamic = "force-dynamic";

async function Data() {
  await requireRole(["owner"]);
  const data = await getStaffModuleData();
  return <PersonalClient data={data} />;
}

export default function PersonalPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-11 w-full max-w-md rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
