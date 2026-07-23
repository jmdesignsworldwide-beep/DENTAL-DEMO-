"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Smartphone, Mail, MessageCircle } from "lucide-react";
import { NOTIF_TYPE_LIST, type Canal } from "@/lib/notification-types";
import type { NotifPrefs } from "@/lib/notifications";
import { notifIcon } from "@/components/notifications/notif-icon";
import { saveNotifPref } from "./actions";

const CANALES: { key: Canal; label: string; icon: React.ElementType }[] = [
  { key: "in_app", label: "App", icon: Smartphone },
  { key: "email", label: "Correo", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

export function PrefsPanel({ initialPrefs }: { initialPrefs: NotifPrefs }) {
  const [prefs, setPrefs] = React.useState<NotifPrefs>(initialPrefs);

  const toggle = (tipo: string, canal: Canal) => {
    setPrefs((prev) => {
      const cur = prev[tipo] ?? { in_app: true, email: false, whatsapp: false };
      const next = { ...cur, [canal]: !cur[canal] };
      const merged = { ...prev, [tipo]: next };
      void saveNotifPref(tipo, next);
      return merged;
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card">
      <div className="hidden items-center gap-2 border-b border-border px-4 py-2.5 sm:flex">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-muted">Tipo de notificación</span>
        {CANALES.map((c) => (
          <span key={c.key} className="flex w-16 items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted">
            <c.icon className="h-3.5 w-3.5" /> {c.label}
          </span>
        ))}
      </div>

      <div className="divide-y divide-border">
        {NOTIF_TYPE_LIST.map((t) => {
          const Icon = notifIcon(t.tipo);
          const p = prefs[t.tipo] ?? { in_app: true, email: false, whatsapp: false };
          return (
            <div key={t.tipo} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${t.color}1a`, color: t.color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-bold text-fg">{t.label}</span>
              </div>
              <div className="flex items-center gap-2 pl-11 sm:gap-0 sm:pl-0">
                {CANALES.map((c) => (
                  <div key={c.key} className="flex w-16 items-center justify-start gap-1.5 sm:justify-center">
                    <Switch on={p[c.key]} onClick={() => toggle(t.tipo, c.key)} label={`${c.label} — ${t.label}`} />
                    <span className="text-[11px] font-semibold text-muted sm:hidden">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-border px-4 py-3 text-[11px] text-muted">
        Cada quien configura sus propias notificaciones. Los canales de correo y WhatsApp son demostrativos en esta versión.
      </p>
    </div>
  );
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-clinical" : "bg-surface-2 border border-border"}`}
    >
      <motion.span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow"
        animate={{ x: on ? 18 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  );
}
