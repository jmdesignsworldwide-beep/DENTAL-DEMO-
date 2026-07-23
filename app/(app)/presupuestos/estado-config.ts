import {
  FileEdit,
  Send,
  CheckCircle2,
  CheckCheck,
  XCircle,
  Clock,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/** Estados del ciclo de venta de un presupuesto. */
export type BudgetEstado =
  | "borrador"
  | "presentado"
  | "aceptado"
  | "aceptado_parcial"
  | "rechazado"
  | "vencido"
  | "completado";

export interface EstadoConfig {
  label: string;
  icon: LucideIcon;
  /** clase de chip (fondo + texto + ring) */
  chip: string;
  /** color sólido para acentos e impresión */
  hex: string;
  /** ¿cuenta como "cerrado ganado" para la tasa de aceptación? */
  ganado: boolean;
  /** ¿sigue esperando decisión del paciente? */
  pendiente: boolean;
}

export const ESTADO_PRESUPUESTO: Record<BudgetEstado, EstadoConfig> = {
  borrador: {
    label: "Borrador",
    icon: FileEdit,
    chip: "bg-surface-2 text-muted ring-border",
    hex: "#64748B",
    ganado: false,
    pendiente: false,
  },
  presentado: {
    label: "Presentado",
    icon: Send,
    chip: "bg-clinical/10 text-clinical ring-clinical/30",
    hex: "#0066CC",
    ganado: false,
    pendiente: true,
  },
  aceptado: {
    label: "Aceptado",
    icon: CheckCircle2,
    chip: "bg-mint/10 text-mint ring-mint/30",
    hex: "#00C896",
    ganado: true,
    pendiente: false,
  },
  aceptado_parcial: {
    label: "Aceptado parcial",
    icon: CheckCheck,
    chip: "bg-mint/10 text-mint ring-mint/30",
    hex: "#0EA5A0",
    ganado: true,
    pendiente: false,
  },
  rechazado: {
    label: "Rechazado",
    icon: XCircle,
    chip: "bg-danger/10 text-danger ring-danger/30",
    hex: "#EF4444",
    ganado: false,
    pendiente: false,
  },
  vencido: {
    label: "Vencido",
    icon: Clock,
    chip: "bg-amber/10 text-amber ring-amber/30",
    hex: "#F59E0B",
    ganado: false,
    pendiente: false,
  },
  completado: {
    label: "Completado",
    icon: Trophy,
    chip: "bg-gold/10 text-gold-dark ring-gold/40 dark:text-gold-light",
    hex: "#C9A84C",
    ganado: true,
    pendiente: false,
  },
};

export const ESTADOS_ORDEN: BudgetEstado[] = [
  "borrador",
  "presentado",
  "aceptado",
  "aceptado_parcial",
  "vencido",
  "rechazado",
  "completado",
];

/** Prioridad clínica de cada ítem. */
export type Prioridad = "urgente" | "necesario" | "electivo";

export interface PrioridadConfig {
  label: string;
  chip: string;
  hex: string;
}

export const PRIORIDAD: Record<Prioridad, PrioridadConfig> = {
  urgente: {
    label: "Urgente",
    chip: "bg-danger/10 text-danger ring-danger/30",
    hex: "#EF4444",
  },
  necesario: {
    label: "Necesario",
    chip: "bg-clinical/10 text-clinical ring-clinical/30",
    hex: "#0066CC",
  },
  electivo: {
    label: "Electivo",
    chip: "bg-surface-2 text-muted ring-border",
    hex: "#64748B",
  },
};

/** Estado de un ítem individual dentro del presupuesto. */
export type ItemEstado =
  | "pendiente"
  | "aceptado"
  | "rechazado"
  | "agendado"
  | "completado";

export const ITEM_ESTADO: Record<ItemEstado, { label: string; chip: string }> = {
  pendiente: { label: "Pendiente", chip: "bg-surface-2 text-muted ring-border" },
  aceptado: { label: "Aceptado", chip: "bg-mint/10 text-mint ring-mint/30" },
  rechazado: { label: "Rechazado", chip: "bg-danger/10 text-danger ring-danger/30" },
  agendado: { label: "Agendado", chip: "bg-clinical/10 text-clinical ring-clinical/30" },
  completado: { label: "Completado", chip: "bg-gold/10 text-gold-dark ring-gold/40 dark:text-gold-light" },
};
