"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { SidebarNav } from "./sidebar";
import { Header } from "./header";
import type { ActiveUser } from "@/lib/auth";

export function AppShell({
  user,
  children,
}: {
  user: ActiveUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar desktop */}
      <aside className="hidden w-[264px] shrink-0 border-r border-border bg-surface lg:block print:hidden">
        <div className="sticky top-0 h-screen">
          <SidebarNav role={user.rol} />
        </div>
      </aside>

      {/* Sidebar móvil (drawer + backdrop) */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="absolute left-0 top-0 h-full w-[280px] border-r border-border bg-surface"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarNav
                role={user.rol}
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
