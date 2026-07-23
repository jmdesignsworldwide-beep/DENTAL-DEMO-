"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check, MessageCircle, Armchair, PackagePlus, BellOff } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { typeMeta } from "@/lib/notification-types";
import type { Notif } from "@/lib/notifications";
import type { NotifBucket, NotifGroup } from "@/lib/notif-group";
import { notifIcon } from "./notif-icon";
import { markNotificationsRead } from "@/app/(app)/notificaciones/actions";

const ACCION_META: Record<string, { label: string; icon: React.ElementType }> = {
  pasar_sillon: { label: "Pasar a sillón", icon: Armchair },
  recordatorio_wa: { label: "Recordar por WhatsApp", icon: MessageCircle },
  registrar_reposicion: { label: "Registrar reposición", icon: PackagePlus },
};

export function NotificationList({
  buckets,
  onChange,
  dense = false,
}: {
  buckets: NotifBucket[];
  onChange?: () => void;
  dense?: boolean;
}) {
  const [resolved, setResolved] = React.useState<Set<string>>(new Set());
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const resolve = React.useCallback(
    (ids: string[]) => {
      setResolved((prev) => {
        const next = new Set(prev);
        ids.forEach((i) => next.add(i));
        return next;
      });
      void markNotificationsRead(ids).then(() => onChange?.());
    },
    [onChange],
  );

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const total = buckets.reduce((s, b) => s + b.groups.length, 0);
  if (total === 0) return <EmptyState />;

  return (
    <div className={dense ? "space-y-3" : "space-y-5"}>
      {buckets.map((bucket) => (
        <div key={bucket.key}>
          <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">{bucket.label}</p>
          <div className="space-y-1.5">
            {bucket.groups.map((g) =>
              g.aggregated ? (
                <AggregatedGroup
                  key={g.key}
                  group={g}
                  open={expanded.has(g.key)}
                  onToggle={() => toggle(g.key)}
                  resolved={resolved}
                  onResolve={resolve}
                  dense={dense}
                />
              ) : (
                <ItemRow key={g.key} item={g.items[0]} resolved={resolved.has(g.items[0].id)} onResolve={resolve} dense={dense} />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AggregatedGroup({
  group, open, onToggle, resolved, onResolve, dense,
}: {
  group: NotifGroup; open: boolean; onToggle: () => void; resolved: Set<string>; onResolve: (ids: string[]) => void; dense: boolean;
}) {
  const meta = typeMeta(group.tipo);
  const Icon = notifIcon(group.tipo);
  const pendientes = group.items.filter((n) => !resolved.has(n.id) && !n.leida).length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2/50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.color}1a`, color: meta.color }}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-fg">
            {group.items.length} {meta.grupo}
          </p>
          <p className="truncate text-[11px] text-muted">
            {group.items.slice(0, 2).map((n) => (n.meta.paciente as string) ?? (n.meta.material as string) ?? n.titulo).join(", ")}
            {group.items.length > 2 ? ` y ${group.items.length - 2} más` : ""}
          </p>
        </div>
        {pendientes > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black text-white" style={{ background: meta.color }}>
            {pendientes}
          </span>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-muted">
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-1 border-t border-border p-1.5">
              {group.items.map((n) => (
                <ItemRow key={n.id} item={n} resolved={resolved.has(n.id)} onResolve={onResolve} dense={dense} nested />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemRow({
  item, resolved, onResolve, dense, nested = false,
}: {
  item: Notif; resolved: boolean; onResolve: (ids: string[]) => void; dense: boolean; nested?: boolean;
}) {
  const meta = typeMeta(item.tipo);
  const Icon = notifIcon(item.tipo);
  const accion = meta.accion ? ACCION_META[meta.accion] : null;
  const [done, setDone] = React.useState(false);
  const leida = item.leida || resolved;

  const doAccion = () => {
    if (meta.accion === "recordatorio_wa") {
      const tel = String(item.meta.telefono ?? "").replace(/\D/g, "");
      if (tel) window.open(`https://wa.me/1${tel}`, "_blank", "noopener");
    }
    setDone(true);
    window.setTimeout(() => onResolve([item.id]), 800);
  };

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        nested ? "bg-surface-2/40" : "border border-border bg-surface"
      } ${leida ? "opacity-60" : ""}`}
    >
      {!leida && !nested && <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ background: meta.color }} />}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.color}1a`, color: meta.color }}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[13px] font-bold leading-snug ${leida ? "text-muted" : "text-fg"}`}>{item.titulo}</p>
          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted">{relativeTime(item.createdAt)}</span>
        </div>
        {item.cuerpo && <p className="mt-0.5 text-[12px] leading-snug text-muted">{item.cuerpo}</p>}

        <AnimatePresence mode="wait">
          {done ? (
            <motion.p key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-mint">
              <Check className="h-3.5 w-3.5" /> Hecho
            </motion.p>
          ) : accion && !leida ? (
            <motion.button
              key="act"
              exit={{ opacity: 0 }}
              onClick={doAccion}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold text-white transition-transform active:scale-95"
              style={{ background: meta.color }}
            >
              <accion.icon className="h-3.5 w-3.5" /> {accion.label}
            </motion.button>
          ) : !leida && !dense ? (
            <motion.button key="read" exit={{ opacity: 0 }} onClick={() => onResolve([item.id])} className="mt-1.5 text-[11px] font-semibold text-muted hover:text-fg">
              Marcar como leída
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint/10"
      >
        <BellOff className="h-8 w-8 text-mint" />
      </motion.span>
      <p className="mt-4 text-[15px] font-extrabold text-fg">Todo bajo control</p>
      <p className="mt-1 max-w-[240px] text-[13px] text-muted">
        No tienes notificaciones pendientes. Cuando algo necesite tu atención, aparecerá aquí primero.
      </p>
    </div>
  );
}
