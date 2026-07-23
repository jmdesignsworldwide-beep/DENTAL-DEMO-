import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth";
import { DashboardHome } from "./dashboard-home";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Puerta de servidor. La UI con iconos vive en el client component
  // (evita pasar componentes Lucide a través del límite RSC).
  const user = await requireActiveUser();
  return <DashboardHome nombre={user.nombre} />;
}
