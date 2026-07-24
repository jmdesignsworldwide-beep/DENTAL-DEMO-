"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import { Wordmark } from "@/components/brand/logo";
import { visibleFor } from "./nav-config";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function SidebarNav({
  role,
  esRealOwner = false,
  onNavigate,
}: {
  role: Role;
  esRealOwner?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = visibleFor(role, esRealOwner);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Wordmark />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 no-scrollbar">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          if (!item.ready) {
            return (
              <div
                key={item.href}
                title={`Disponible en la Tanda ${item.tanda}`}
                className="group flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted/60"
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "text-clinical-700 dark:text-white"
                  : "text-fg/80 hover:bg-surface-2 hover:text-fg dark:hover:bg-navy-lighter",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 -z-10 rounded-xl bg-clinical-50 ring-1 ring-clinical-200 dark:bg-clinical-900/40 dark:ring-clinical-700/50"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  active && "text-clinical",
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-3">
        <p className="text-[11px] font-medium text-muted">
          Demo · v0.1 — Fundación
        </p>
      </div>
    </div>
  );
}
