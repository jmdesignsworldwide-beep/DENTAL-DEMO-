import "server-only";

import { createClient } from "@/lib/supabase/server";
import { NOTIF_TYPE_LIST, type Canal } from "@/lib/notification-types";

export interface Notif {
  id: string;
  tipo: string;
  prioridad: "alta" | "media" | "baja";
  titulo: string;
  cuerpo: string | null;
  entity: string | null;
  entityId: string | null;
  meta: Record<string, unknown>;
  leida: boolean;
  createdAt: string;
}

export interface NotifPrefs {
  [tipo: string]: { in_app: boolean; email: boolean; whatsapp: boolean };
}

export async function getNotifications(limit = 60): Promise<Notif[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, tipo, prioridad, titulo, cuerpo, entity, entity_id, meta, leida, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Record<string, unknown>[]).map((n) => ({
    id: n.id as string,
    tipo: n.tipo as string,
    prioridad: (n.prioridad as Notif["prioridad"]) ?? "media",
    titulo: n.titulo as string,
    cuerpo: (n.cuerpo as string | null) ?? null,
    entity: (n.entity as string | null) ?? null,
    entityId: (n.entity_id as string | null) ?? null,
    meta: (n.meta as Record<string, unknown>) ?? {},
    leida: !!n.leida,
    createdAt: n.created_at as string,
  }));
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("leida", false);
  return count ?? 0;
}

export async function getNotifPrefs(): Promise<NotifPrefs> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const prefs: NotifPrefs = {};
  // Default: solo en-app activo.
  for (const t of NOTIF_TYPE_LIST) prefs[t.tipo] = { in_app: true, email: false, whatsapp: false };
  if (!user) return prefs;

  const { data } = await supabase
    .from("notification_prefs")
    .select("tipo, in_app, email, whatsapp")
    .eq("user_id", user.id);
  for (const r of (data ?? []) as { tipo: string; in_app: boolean; email: boolean; whatsapp: boolean }[]) {
    prefs[r.tipo] = { in_app: r.in_app, email: r.email, whatsapp: r.whatsapp };
  }
  return prefs;
}

export type { Canal };
