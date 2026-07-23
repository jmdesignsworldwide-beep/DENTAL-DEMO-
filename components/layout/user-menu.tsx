"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ActiveUser } from "@/lib/auth";

const roleLabel: Record<string, string> = {
  owner: "Propietaria",
  dentista: "Odontólogo/a",
  recepcionista: "Recepción",
  asistente: "Asistente",
};

export function UserMenu({ user }: { user: ActiveUser }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const signOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-transparent p-1 pr-2 transition-colors hover:bg-surface-2 dark:hover:bg-navy-lighter"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-clinical-400 to-clinical-700 text-xs font-bold text-white ring-2 ring-surface">
          {initials(user.nombre)}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted sm:block" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-border bg-surface shadow-card-hover"
          >
            <div className="flex items-center gap-3 border-b border-border p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-clinical-400 to-clinical-700 text-sm font-bold text-white">
                {initials(user.nombre)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-fg">
                  {user.nombre}
                </p>
                <div className="mt-0.5">
                  <Badge variant={user.rol === "owner" ? "vip" : "clinical"}>
                    {roleLabel[user.rol]}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="p-1.5">
              <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2 dark:hover:bg-navy-lighter">
                <UserIcon className="h-4 w-4 text-muted" />
                Mi perfil
              </button>
              <button
                onClick={signOut}
                disabled={loading}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {loading ? "Cerrando…" : "Cerrar sesión"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
