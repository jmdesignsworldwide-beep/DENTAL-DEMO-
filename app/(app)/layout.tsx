import { requireActiveUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Puerta de servidor: exige sesión + perfil activo. Redirige si no.
  const user = await requireActiveUser();
  return <AppShell user={user}>{children}</AppShell>;
}
