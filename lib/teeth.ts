// Datos dentales puros (FDI). Sin dependencias — cliente y servidor.

export type ToothType = "incisivo" | "canino" | "premolar" | "molar";
export type Denticion = "adulto" | "pediatrico";
export type Superficie = "M" | "D" | "V" | "L" | "O";

export const SUPERFICIES: { code: Superficie; label: string }[] = [
  { code: "M", label: "Mesial" },
  { code: "D", label: "Distal" },
  { code: "V", label: "Vestibular" },
  { code: "L", label: "Lingual/Palatino" },
  { code: "O", label: "Oclusal/Incisal" },
];

// Cuadrantes en orden de carta dental (izq→der en pantalla).
export const ADULTO_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const ADULTO_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const PEDIATRICO_SUPERIOR = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
export const PEDIATRICO_INFERIOR = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

export function dientesDe(d: Denticion): { superior: number[]; inferior: number[] } {
  return d === "adulto"
    ? { superior: ADULTO_SUPERIOR, inferior: ADULTO_INFERIOR }
    : { superior: PEDIATRICO_SUPERIOR, inferior: PEDIATRICO_INFERIOR };
}

export function toothType(fdi: number): ToothType {
  const d = fdi % 10;
  const q = Math.floor(fdi / 10);
  const esPediatrico = q >= 5;
  if (d === 1 || d === 2) return "incisivo";
  if (d === 3) return "canino";
  if (esPediatrico) return "molar"; // primarios: 4,5 son molares
  return d === 4 || d === 5 ? "premolar" : "molar";
}

export function toothName(fdi: number): string {
  const d = fdi % 10;
  const q = Math.floor(fdi / 10);
  const superior = q === 1 || q === 2 || q === 5 || q === 6;
  const derecho = q === 1 || q === 4 || q === 5 || q === 8;
  const arcada = superior ? "Superior" : "Inferior";
  const lado = derecho ? "Derecho" : "Izquierdo";
  const temporal = q >= 5;

  let base: string;
  const type = toothType(fdi);
  if (type === "incisivo") base = d === 1 ? "Incisivo Central" : "Incisivo Lateral";
  else if (type === "canino") base = "Canino";
  else if (type === "premolar") base = d === 4 ? "Primer Premolar" : "Segundo Premolar";
  else {
    if (temporal) base = d === 4 ? "Primer Molar" : "Segundo Molar";
    else base = d === 6 ? "Primer Molar" : d === 7 ? "Segundo Molar" : "Tercer Molar";
  }
  return `${base} ${arcada} ${lado}${temporal ? " (temporal)" : ""}`;
}
