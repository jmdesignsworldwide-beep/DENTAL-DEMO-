"use client";

import { Menu, Search, Bell } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserMenu } from "./user-menu";
import type { ActiveUser } from "@/lib/auth";

export function Header({
  user,
  onMenu,
}: {
  user: ActiveUser;
  onMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-xl lg:px-6 print:hidden">
      <button
        onClick={onMenu}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg transition-colors hover:bg-surface-2 lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Buscador global */}
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Buscar paciente, cita, factura…"
          className="h-10 w-full rounded-xl border border-border bg-surface-2/60 pl-10 pr-4 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/40 dark:bg-navy-light"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg transition-colors hover:bg-surface-2 dark:hover:bg-navy-lighter"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
        </button>
        <ThemeToggle />
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
