"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Inbox, SlidersHorizontal, Search, CheckCheck, ChevronDown } from "lucide-react";
import { NOTIF_TYPE_LIST } from "@/lib/notification-types";
import { groupNotifications } from "@/lib/notif-group";
import type { Notif, NotifPrefs } from "@/lib/notifications";
import { NotificationList } from "@/components/notifications/notification-list";
import { PrefsPanel } from "./prefs-panel";
import { markAllRead } from "./actions";

type Tab = "bandeja" | "preferencias";
type EstadoF = "todas" | "no_leidas" | "leidas";
type FechaF = "todas" | "hoy" | "7d" | "30d";

export function NotificacionesClient({ initial, prefs }: { initial: Notif[]; prefs: NotifPrefs }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("bandeja");
  const [q, setQ] = React.useState("");
  const [tipo, setTipo] = React.useState<string>("todos");
  const [estado, setEstado] = React.useState<EstadoF>("todas");
  const [fecha, setFecha] = React.useState<FechaF>("todas");
  const [nowMs, setNowMs] = React.useState(0);

  React.useEffect(() => setNowMs(Date.now()), []);

  const filtered = React.useMemo(() => {
    const now = nowMs || Date.now();
    const ventana: Record<FechaF, number> = { todas: Infinity, hoy: 0, "7d": 7 * 864e5, "30d": 30 * 864e5 };
    const query = q.trim().toLowerCase();
    return initial.filter((n) => {
      if (tipo !== "todos" && n.tipo !== tipo) return false;
      if (estado === "no_leidas" && n.leida) return false;
      if (estado === "leidas" && !n.leida) return false;
      if (fecha !== "todas") {
        const age = now - new Date(n.createdAt).getTime();
        if (fecha === "hoy") {
          const start = new Date(now); start.setHours(0, 0, 0, 0);
          if (new Date(n.createdAt).getTime() < start.getTime()) return false;
        } else if (age > ventana[fecha]) return false;
      }
      if (query && !(`${n.titulo} ${n.cuerpo ?? ""}`.toLowerCase().includes(query))) return false;
      return true;
    });
  }, [initial, q, tipo, estado, fecha, nowMs]);

  const buckets = groupNotifications(filtered, nowMs || Date.now());
  const unread = initial.filter((n) => !n.leida).length;
  const refresh = () => router.refresh();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">Notificaciones</h1>
          <p className="mt-1 text-sm text-muted">Todo lo que necesita tu atención, en un solo lugar.</p>
        </div>
        {tab === "bandeja" && unread > 0 && (
          <button
            onClick={() => { void markAllRead().then(refresh); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold text-clinical hover:bg-surface-2"
          >
            <CheckCheck className="h-4 w-4" /> Marcar todas como leídas
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-surface p-1">
        {([["bandeja", "Bandeja", Inbox], ["preferencias", "Preferencias", SlidersHorizontal]] as const).map(([k, label, Icon]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${active ? "text-white" : "text-muted hover:text-fg"}`}
            >
              {active && <motion.span layoutId="notif-tab" className="absolute inset-0 rounded-lg bg-clinical" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <span className="relative flex items-center gap-2"><Icon className="h-4 w-4" /> {label}</span>
            </button>
          );
        })}
      </div>

      {tab === "preferencias" ? (
        <PrefsPanel initialPrefs={prefs} />
      ) : (
        <>
          {/* Filtros */}
          <div className="mb-4 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder="Buscar en notificaciones…"
                className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterSelect value={tipo} onChange={setTipo} options={[["todos", "Todos los tipos"], ...NOTIF_TYPE_LIST.map((t) => [t.tipo, t.label] as [string, string])]} />
              <FilterSelect value={estado} onChange={(v) => setEstado(v as EstadoF)} options={[["todas", "Todas"], ["no_leidas", "No leídas"], ["leidas", "Leídas"]]} />
              <FilterSelect value={fecha} onChange={(v) => setFecha(v as FechaF)} options={[["todas", "Cualquier fecha"], ["hoy", "Hoy"], ["7d", "Últimos 7 días"], ["30d", "Últimos 30 días"]]} />
            </div>
          </div>

          <NotificationList buckets={buckets} onChange={refresh} />
        </>
      )}
    </div>
  );
}

function FilterSelect({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-lg border border-border bg-surface pl-3 pr-8 text-[13px] font-semibold text-fg outline-none ring-clinical/30 focus:ring-2"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
