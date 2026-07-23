import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const notifications = await getNotifications(60);
  const unread = notifications.filter((n) => !n.leida).length;
  return NextResponse.json(
    { notifications, unread },
    { headers: { "Cache-Control": "no-store" } },
  );
}
