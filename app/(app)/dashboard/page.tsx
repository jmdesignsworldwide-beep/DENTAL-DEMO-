import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardHome } from "./dashboard-home";
import { DashboardSkeleton } from "./loading-skeleton";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

async function DashboardData() {
  const user = await requireActiveUser();
  const data = await getDashboardData(user);
  return <DashboardHome nombre={user.nombre} data={data} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData />
    </Suspense>
  );
}
