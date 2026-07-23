import { redirect } from "next/navigation";
import { getActiveUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getActiveUser();
  redirect(user ? "/dashboard" : "/login");
}
