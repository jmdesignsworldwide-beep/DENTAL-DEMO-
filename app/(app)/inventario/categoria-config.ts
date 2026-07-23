import {
  Syringe,
  Layers,
  Package,
  Wrench,
  Bolt,
  Braces,
  ShieldPlus,
  Scissors,
  Scan,
  Droplet,
  type LucideIcon,
} from "lucide-react";

export type MaterialCategoria =
  | "anestesia"
  | "restauracion"
  | "impresion"
  | "endodoncia"
  | "implantes"
  | "ortodoncia"
  | "bioseguridad"
  | "instrumental"
  | "radiologia"
  | "consumibles";

export const MAT_CATEGORIA: Record<
  MaterialCategoria,
  { label: string; icon: LucideIcon; hex: string }
> = {
  anestesia: { label: "Anestesia", icon: Syringe, hex: "#0891B2" },
  restauracion: { label: "Restauración", icon: Layers, hex: "#0066CC" },
  impresion: { label: "Impresión", icon: Package, hex: "#8B5CF6" },
  endodoncia: { label: "Endodoncia", icon: Wrench, hex: "#F97316" },
  implantes: { label: "Implantes", icon: Bolt, hex: "#14B8A6" },
  ortodoncia: { label: "Ortodoncia", icon: Braces, hex: "#F43F5E" },
  bioseguridad: { label: "Bioseguridad", icon: ShieldPlus, hex: "#00C896" },
  instrumental: { label: "Instrumental", icon: Scissors, hex: "#64748B" },
  radiologia: { label: "Radiología", icon: Scan, hex: "#C9A84C" },
  consumibles: { label: "Consumibles", icon: Droplet, hex: "#F59E0B" },
};

export const MAT_CATEGORIAS_ORDEN: MaterialCategoria[] = [
  "anestesia",
  "restauracion",
  "impresion",
  "endodoncia",
  "implantes",
  "ortodoncia",
  "bioseguridad",
  "instrumental",
  "radiologia",
  "consumibles",
];

/** Nivel de stock: critico (<50% del mínimo), bajo (<= mínimo), ok. */
export function stockNivel(actual: number, minimo: number): "critico" | "bajo" | "ok" {
  if (minimo <= 0) return "ok";
  if (actual <= minimo * 0.5) return "critico";
  if (actual <= minimo) return "bajo";
  return "ok";
}
