import type { AffectationType } from "@/lib/odontogram";

export const AFFECTATION: Record<
  AffectationType,
  { label: string; color: string }
> = {
  caries_superficial: { label: "Caries superficial", color: "#F59E0B" },
  caries_profunda: { label: "Caries profunda", color: "#EA580C" },
  pulpitis: { label: "Pulpitis", color: "#EF4444" },
  absceso: { label: "Absceso", color: "#8B5CF6" },
  fractura: { label: "Fractura", color: "#64748B" },
  desgaste: { label: "Desgaste", color: "#0891B2" },
};

export const AFFECTATION_ORDEN: AffectationType[] = [
  "caries_superficial",
  "caries_profunda",
  "pulpitis",
  "absceso",
  "fractura",
  "desgaste",
];

export type ZonaCode =
  | "esmalte"
  | "dentina"
  | "camara_pulpar"
  | "conducto"
  | "raiz"
  | "apice";

export const ZONA_LABEL: Record<ZonaCode, string> = {
  esmalte: "Esmalte",
  dentina: "Dentina",
  camara_pulpar: "Cámara pulpar",
  conducto: "Conducto radicular",
  raiz: "Raíz / cemento",
  apice: "Ápice",
};

// Capas anatómicas etiquetadas (informativas, con hover).
export const CAPAS: { code: string; label: string }[] = [
  { code: "encia", label: "Encía" },
  { code: "esmalte", label: "Esmalte" },
  { code: "dentina", label: "Dentina" },
  { code: "camara_pulpar", label: "Pulpa (cámara y conductos)" },
  { code: "raiz", label: "Cemento" },
  { code: "ligamento", label: "Ligamento periodontal" },
  { code: "hueso", label: "Hueso alveolar" },
];
