import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActiveUser } from "@/lib/auth";
import { getNotifications, getNotifPrefs } from "@/lib/notifications";
import { NotificacionesClient } from "./notificaciones-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Notificaciones" };
export const dynamic = "force-dynamic";

async function Data() {
  await requireActiveUser();
  const [notifications, prefs] = await Promise.all([getNotifications(120), getNotifPrefs()]);
  return <NotificacionesClient initial={notifications} prefs={prefs} />;
}

export default function NotificacionesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-11 w-full rounded-xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      }
    >
      <Data />
    </Suspense>
  );
}
