import { typeMeta, PRIORIDAD_PESO } from "@/lib/notification-types";
import type { Notif } from "@/lib/notifications";

export interface NotifGroup {
  key: string;
  tipo: string;
  aggregated: boolean;
  items: Notif[];
  maxPeso: number;
  latest: number;
}
export interface NotifBucket {
  key: "ahora" | "hoy" | "semana" | "anteriores";
  label: string;
  groups: NotifGroup[];
}

const BUCKET_LABEL: Record<NotifBucket["key"], string> = {
  ahora: "Ahora",
  hoy: "Hoy",
  semana: "Esta semana",
  anteriores: "Anteriores",
};

function bucketOf(createdMs: number, nowMs: number): NotifBucket["key"] {
  const diff = nowMs - createdMs;
  if (diff < 60 * 60 * 1000) return "ahora";
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  if (createdMs >= start.getTime()) return "hoy";
  if (diff < 7 * 24 * 60 * 60 * 1000) return "semana";
  return "anteriores";
}

/** Agrupa notificaciones por tramo temporal y, dentro, agrega por tipo. */
export function groupNotifications(notifs: Notif[], nowMs: number): NotifBucket[] {
  const buckets: Record<NotifBucket["key"], Notif[]> = { ahora: [], hoy: [], semana: [], anteriores: [] };
  for (const n of notifs) {
    buckets[bucketOf(new Date(n.createdAt).getTime(), nowMs)].push(n);
  }

  const order: NotifBucket["key"][] = ["ahora", "hoy", "semana", "anteriores"];
  const out: NotifBucket[] = [];

  for (const key of order) {
    const items = buckets[key];
    if (items.length === 0) continue;

    // Agrupa por tipo.
    const byTipo = new Map<string, Notif[]>();
    for (const n of items) {
      const arr = byTipo.get(n.tipo) ?? [];
      arr.push(n);
      byTipo.set(n.tipo, arr);
    }

    const groups: NotifGroup[] = [];
    for (const [tipo, arr] of byTipo) {
      const meta = typeMeta(tipo);
      const sorted = arr.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const maxPeso = Math.max(...sorted.map((n) => PRIORIDAD_PESO[n.prioridad]));
      const latest = new Date(sorted[0].createdAt).getTime();
      if (sorted.length >= 2 && meta.grupo) {
        groups.push({ key: `${key}-${tipo}`, tipo, aggregated: true, items: sorted, maxPeso, latest });
      } else {
        for (const n of sorted) {
          groups.push({ key: `${key}-${n.id}`, tipo, aggregated: false, items: [n], maxPeso: PRIORIDAD_PESO[n.prioridad], latest: new Date(n.createdAt).getTime() });
        }
      }
    }

    // Prioridad alta arriba; luego más reciente.
    groups.sort((a, b) => (b.maxPeso - a.maxPeso) || (b.latest - a.latest));
    out.push({ key, label: BUCKET_LABEL[key], groups });
  }

  return out;
}

export function unreadCount(notifs: Notif[]): number {
  return notifs.filter((n) => !n.leida).length;
}
