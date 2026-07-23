import type { ToothStatus } from "@/lib/odontogram";

export interface EstadoDiente {
  label: string;
  /** color de relleno del diente */
  fill: string;
  /** color de borde */
  stroke: string;
  /** clase de texto para chips */
  text: string;
  /** clase de fondo para chips */
  chip: string;
}

// Colores exactos de la leyenda del spec.
export const ESTADO_DIENTE: Record<ToothStatus, EstadoDiente> = {
  sano: {
    label: "Sano",
    fill: "#FFFFFF",
    stroke: "#CBD5E1",
    text: "text-fg",
    chip: "bg-surface-2 ring-border",
  },
  tratado: {
    label: "Tratado / restaurado",
    fill: "#0066CC",
    stroke: "#0052A3",
    text: "text-white",
    chip: "bg-clinical ring-clinical-700",
  },
  caries: {
    label: "Caries",
    fill: "#F59E0B",
    stroke: "#B45309",
    text: "text-white",
    chip: "bg-amber ring-amber",
  },
  extraccion_necesaria: {
    label: "Extracción necesaria",
    fill: "#EF4444",
    stroke: "#B91C1C",
    text: "text-white",
    chip: "bg-danger ring-danger",
  },
  corona: {
    label: "Corona",
    fill: "#8B5CF6",
    stroke: "#6D28D9",
    text: "text-white",
    chip: "bg-violet-500 ring-violet-600",
  },
  implante: {
    label: "Implante",
    fill: "#00C896",
    stroke: "#059669",
    text: "text-white",
    chip: "bg-mint ring-mint",
  },
  endodoncia: {
    label: "Endodoncia",
    fill: "#F97316",
    stroke: "#C2410C",
    text: "text-white",
    chip: "bg-orange-500 ring-orange-600",
  },
  ausente: {
    label: "Ausente / extraído",
    fill: "#CBD5E1",
    stroke: "#94A3B8",
    text: "text-muted",
    chip: "bg-slate-300 ring-slate-400",
  },
};

export const ESTADOS_ORDEN: ToothStatus[] = [
  "sano",
  "tratado",
  "caries",
  "endodoncia",
  "corona",
  "implante",
  "extraccion_necesaria",
  "ausente",
];
