import {
  ShieldCheck,
  Layers,
  Syringe,
  HeartPulse,
  Scissors,
  Braces,
  Sparkles,
  Baby,
  type LucideIcon,
} from "lucide-react";

export type Categoria =
  | "preventiva"
  | "restauradora"
  | "endodoncia"
  | "periodoncia"
  | "cirugia_oral"
  | "ortodoncia"
  | "estetica"
  | "odontopediatria";

export interface CatConfig {
  label: string;
  icon: LucideIcon;
  hex: string;
  chip: string;
  soft: string;
}

export const CATEGORIA: Record<Categoria, CatConfig> = {
  preventiva: {
    label: "Preventiva",
    icon: ShieldCheck,
    hex: "#00C896",
    chip: "bg-mint/10 text-mint ring-mint/30",
    soft: "bg-mint/10 text-mint",
  },
  restauradora: {
    label: "Restauradora",
    icon: Layers,
    hex: "#0066CC",
    chip: "bg-clinical-50 text-clinical-700 ring-clinical-200 dark:bg-clinical-900/40 dark:text-clinical-200 dark:ring-clinical-700/50",
    soft: "bg-clinical-50 text-clinical dark:bg-clinical-900/40 dark:text-clinical-200",
  },
  endodoncia: {
    label: "Endodoncia",
    icon: Syringe,
    hex: "#F97316",
    chip: "bg-orange-500/10 text-orange-600 ring-orange-500/30 dark:text-orange-300",
    soft: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
  },
  periodoncia: {
    label: "Periodoncia",
    icon: HeartPulse,
    hex: "#F43F5E",
    chip: "bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-300",
    soft: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  cirugia_oral: {
    label: "Cirugía oral",
    icon: Scissors,
    hex: "#8B5CF6",
    chip: "bg-violet-500/10 text-violet-600 ring-violet-500/30 dark:text-violet-300",
    soft: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  ortodoncia: {
    label: "Ortodoncia",
    icon: Braces,
    hex: "#0891B2",
    chip: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/30 dark:text-cyan-300",
    soft: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  },
  estetica: {
    label: "Estética",
    icon: Sparkles,
    hex: "#C9A84C",
    chip: "bg-gold/10 text-gold-dark ring-gold/30 dark:text-gold-light",
    soft: "bg-gold/10 text-gold-dark dark:text-gold-light",
  },
  odontopediatria: {
    label: "Odontopediatría",
    icon: Baby,
    hex: "#F59E0B",
    chip: "bg-amber/10 text-amber ring-amber/30",
    soft: "bg-amber/10 text-amber",
  },
};

export const CATEGORIAS_ORDEN: Categoria[] = [
  "preventiva",
  "restauradora",
  "endodoncia",
  "periodoncia",
  "cirugia_oral",
  "ortodoncia",
  "estetica",
  "odontopediatria",
];
