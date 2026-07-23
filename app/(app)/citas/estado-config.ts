export type CitaEstado =
  | "pendiente"
  | "confirmada"
  | "sala_espera"
  | "en_sillon"
  | "completada"
  | "cancelada"
  | "no_show"
  | "seguimiento";

export interface EstadoCita {
  label: string;
  /** color sólido (hex) para puntos del calendario */
  hex: string;
  /** clases del chip de evento */
  chip: string;
  /** clases del badge */
  badge: string;
  dot: string;
}

export const ESTADO_CITA: Record<CitaEstado, EstadoCita> = {
  pendiente: {
    label: "Pendiente",
    hex: "#F59E0B",
    chip: "bg-amber/15 text-amber border-amber/40",
    badge: "bg-amber/10 text-amber ring-amber/30",
    dot: "bg-amber",
  },
  confirmada: {
    label: "Confirmada",
    hex: "#0066CC",
    chip: "bg-clinical-50 text-clinical-700 border-clinical-300 dark:bg-clinical-900/40 dark:text-clinical-200 dark:border-clinical-700/60",
    badge: "bg-clinical-50 text-clinical-700 ring-clinical-200 dark:bg-clinical-900/40 dark:text-clinical-200 dark:ring-clinical-700/50",
    dot: "bg-clinical",
  },
  sala_espera: {
    label: "En sala de espera",
    hex: "#0891B2",
    chip: "bg-cyan-500/15 text-cyan-700 border-cyan-500/40 dark:text-cyan-300",
    badge: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/30 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  en_sillon: {
    label: "En el sillón",
    hex: "#14B8A6",
    chip: "bg-teal-500/15 text-teal-700 border-teal-500/40 dark:text-teal-300",
    badge: "bg-teal-500/10 text-teal-600 ring-teal-500/30 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  completada: {
    label: "Completada",
    hex: "#00C896",
    chip: "bg-mint/15 text-emerald-700 border-mint/40 dark:text-mint",
    badge: "bg-mint/10 text-mint ring-mint/30",
    dot: "bg-mint",
  },
  cancelada: {
    label: "Cancelada",
    hex: "#EF4444",
    chip: "bg-danger/10 text-danger border-danger/40 line-through decoration-danger/50",
    badge: "bg-danger/10 text-danger ring-danger/30",
    dot: "bg-danger",
  },
  no_show: {
    label: "No asistió",
    hex: "#B91C1C",
    chip: "bg-danger/10 text-danger border-danger/40 border-dashed",
    badge: "bg-danger/10 text-danger ring-danger/30",
    dot: "bg-danger",
  },
  seguimiento: {
    label: "Seguimiento",
    hex: "#8B5CF6",
    chip: "bg-violet-500/15 text-violet-700 border-violet-500/40 dark:text-violet-300",
    badge: "bg-violet-500/10 text-violet-600 ring-violet-500/30 dark:text-violet-300",
    dot: "bg-violet-500",
  },
};

/** Estados en el orden de la leyenda. */
export const ESTADOS_LEYENDA: CitaEstado[] = [
  "pendiente",
  "confirmada",
  "sala_espera",
  "en_sillon",
  "completada",
  "seguimiento",
  "cancelada",
  "no_show",
];

/** Estados a los que se puede transicionar (para el panel de detalle). */
export const TRANSICIONES: CitaEstado[] = [
  "pendiente",
  "confirmada",
  "sala_espera",
  "en_sillon",
  "completada",
  "seguimiento",
  "no_show",
];
