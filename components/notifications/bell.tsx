"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, CheckCheck, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { groupNotifications } from "@/lib/notif-group";
import type { Notif } from "@/lib/notifications";
import { NotificationList } from "./notification-list";
import { markAllRead } from "@/app/(app)/notificaciones/actions";

export function NotificationBell() {
  const reduce = useReducedMotion();
  const [notifs, setNotifs] = React.useState<Notif[]>([]);
  const [open, setOpen] = React.useState(false);
  const [shake, setShake] = React.useState(0);
  const prevUnread = React.useRef(0);
  const [nowMs, setNowMs] = React.useState<number>(0);

  const unread = notifs.filter((n) => !n.leida).length;

  const fetchNotifs = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { notifications: Notif[] };
      const list = json.notifications ?? [];
      const nowU = list.filter((n) => !n.leida).length;
      if (nowU > prevUnread.current) setShake((s) => s + 1);
      prevUnread.current = nowU;
      setNotifs(list);
      setNowMs(Date.now());
    } catch {
      /* silencioso */
    }
  }, []);

  React.useEffect(() => {
    setNowMs(Date.now());
    fetchNotifs();
    const t = setInterval(fetchNotifs, 30_000);
    let removed = false;
    try {
      const supabase = createClient();
      const ch = supabase
        .channel("notif-bell")
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchNotifs())
        .subscribe();
      return () => {
        removed = true;
        clearInterval(t);
        supabase.removeChannel(ch);
      };
    } catch {
      /* fallback: polling */
    }
    return () => {
      clearInterval(t);
      void removed;
    };
  }, [fetchNotifs]);

  const buckets = groupNotifications(notifs, nowMs || Date.now());

  const onMarkAll = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
    prevUnread.current = 0;
    void markAllRead().then(fetchNotifs);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg transition-colors hover:bg-surface-2 dark:hover:bg-navy-lighter"
        aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ""}`}
      >
        <motion.span
          key={shake}
          animate={reduce || shake === 0 ? {} : { rotate: [0, -14, 12, -8, 6, 0] }}
          transition={{ duration: 0.6 }}
          style={{ transformOrigin: "top center" }}
        >
          <Bell className="h-[18px] w-[18px]" />
        </motion.span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center">
            {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger/60" />}
            <span className="relative inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white ring-2 ring-surface">
              {unread > 9 ? "9+" : unread}
            </span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-navy/30 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-0"
            />
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: reduce ? 0 : 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : 24 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col rounded-t-3xl border border-border bg-surface shadow-card-hover sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[68px] sm:max-h-[560px] sm:w-[400px] sm:rounded-2xl"
            >
              <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden" />
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-[15px] font-extrabold text-fg">
                  Notificaciones {unread > 0 && <span className="text-muted">· {unread}</span>}
                </p>
                {unread > 0 && (
                  <button onClick={onMarkAll} className="inline-flex items-center gap-1 text-[12px] font-bold text-clinical hover:text-clinical-600">
                    <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <NotificationList buckets={buckets} onChange={fetchNotifs} dense />
              </div>

              <Link
                href="/notificaciones"
                onClick={() => setOpen(false)}
                className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border py-3 text-[13px] font-bold text-clinical hover:bg-surface-2"
              >
                Ver todas las notificaciones <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
