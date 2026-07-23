"use client";

import { CalendarPlus, UserPlus, Stethoscope, type LucideIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Action {
  label: string;
  sub: string;
  icon: LucideIcon;
  accent: string;
  tanda: number;
}

const ACTIONS: Action[] = [
  {
    label: "Nueva cita",
    sub: "Agendar en el calendario",
    icon: CalendarPlus,
    accent:
      "from-clinical-400 to-clinical-700 shadow-[0_8px_24px_rgba(0,102,204,0.35)]",
    tanda: 4,
  },
  {
    label: "Nuevo paciente",
    sub: "Registrar en el CRM",
    icon: UserPlus,
    accent: "from-mint to-emerald-600 shadow-[0_8px_24px_rgba(0,200,150,0.30)]",
    tanda: 3,
  },
  {
    label: "Nuevo tratamiento",
    sub: "Añadir al catálogo",
    icon: Stethoscope,
    accent: "from-gold-light to-gold-dark shadow-glow-gold",
    tanda: 9,
  },
];

export function QuickActions() {
  const toast = useToast();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            onClick={() =>
              toast.toast({
                type: "info",
                title: a.label,
                description: `Este flujo se activa en la Tanda ${a.tanda}.`,
              })
            }
            className="group flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-4 text-left shadow-card transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-surface/80"
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white transition-transform duration-300 group-hover:scale-110 ${a.accent}`}
            >
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-fg">{a.label}</span>
              <span className="block truncate text-xs text-muted">{a.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
