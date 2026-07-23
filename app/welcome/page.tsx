import { redirect } from "next/navigation";
import { getActiveUser } from "@/lib/auth";
import { WelcomeCinematic } from "./welcome-cinematic";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  // Fail-safe server-side: sin usuario válido, no hay intro — a login.
  const user = await getActiveUser();
  if (!user) redirect("/login");

  return <WelcomeCinematic nombre={user.nombre} />;
}
