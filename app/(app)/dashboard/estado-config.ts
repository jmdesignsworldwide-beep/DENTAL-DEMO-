import type { AppointmentEstado } from "@/lib/dashboard";

export interface EstadoStyle {
  label: string;
  /** color de barra/acento */
  bar: string;
  /** clases del badge */
  badge: string;
  /** color del punto */
  dot: string;
}

export const ESTADO: Record<AppointmentEstado, EstadoStyle> = {
  confirmada: {
    label: "Confirmada",
    bar: "bg-clinical",
    badge:
      "bg-clinical-50 text-clinical-700 ring-clinical-200 dark:bg-clinical-900/40 dark:text-clinical-200 dark:ring-clinical-700/50",
    dot: "bg-clinical",
  },
  sala_espera: {
    label: "En sala de espera",
    bar: "bg-amber",
    badge: "bg-amber/10 text-amber ring-amber/30",
    dot: "bg-amber",
  },
  en_sillon: {
    label: "En el sillón",
    bar: "bg-mint",
    badge: "bg-mint/10 text-mint ring-mint/30",
    dot: "bg-mint",
  },
  completada: {
    label: "Completada",
    bar: "bg-muted/50",
    badge: "bg-surface-2 text-muted ring-border dark:bg-navy-lighter",
    dot: "bg-muted/60",
  },
  cancelada: {
    label: "Cancelada",
    bar: "bg-danger",
    badge: "bg-danger/10 text-danger ring-danger/30",
    dot: "bg-danger",
  },
  no_show: {
    label: "No asistió",
    bar: "bg-danger",
    badge: "bg-danger/10 text-danger ring-danger/30",
    dot: "bg-danger",
  },
};
