"use server";

import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NOTIF_TYPES } from "@/lib/notification-types";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function markNotificationsRead(ids: string[]): Promise<{ ok: boolean }> {
  await requireActiveUser();
  const clean = (ids ?? []).filter(isUuid).slice(0, 200);
  if (clean.length === 0) return { ok: true };
  const supabase = createClient();
  await supabase.from("notifications").update({ leida: true }).in("id", clean);
  revalidatePath("/notificaciones");
  return { ok: true };
}

export async function markAllRead(): Promise<{ ok: boolean }> {
  await requireActiveUser();
  const supabase = createClient();
  await supabase.from("notifications").update({ leida: true }).eq("leida", false);
  revalidatePath("/notificaciones");
  return { ok: true };
}

export async function saveNotifPref(
  tipo: string,
  pref: { in_app: boolean; email: boolean; whatsapp: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireActiveUser();
  if (!NOTIF_TYPES[tipo]) return { ok: false, error: "Tipo inválido." };

  const supabase = createClient();
  const { error } = await supabase.from("notification_prefs").upsert(
    {
      user_id: user.id,
      tipo,
      in_app: !!pref.in_app,
      email: !!pref.email,
      whatsapp: !!pref.whatsapp,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tipo" },
  );
  if (error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/notificaciones");
  return { ok: true };
}
