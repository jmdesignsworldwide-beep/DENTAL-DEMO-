// ══════════════════════════════════════════════════════════════════════
//  Nómina dominicana — cálculos correctos (TSS + ISR).
//  Funciones puras y deterministas. Referencia:
//   · TSS empleado: AFP (pensión) 2.87% + SFS (salud) 3.04%.
//     Topes: AFP hasta 20 salarios mínimos cotizables, SFS hasta 10.
//   · ISR: escala anual vigente DGII (retención asalariados).
// ══════════════════════════════════════════════════════════════════════

export const AFP_RATE = 0.0287; // pensión (empleado)
export const SFS_RATE = 0.0304; // salud (empleado)

// Salario mínimo cotizable de referencia para los topes de TSS.
export const SALARIO_MINIMO_COTIZABLE = 15_000;
export const AFP_TOPE = 20 * SALARIO_MINIMO_COTIZABLE; // base máxima AFP
export const SFS_TOPE = 10 * SALARIO_MINIMO_COTIZABLE; // base máxima SFS

// Escala anual del ISR (DGII).
export const ISR_EXENTO = 416_220.0;
const ISR_T2 = 624_329.0;
const ISR_T3 = 867_123.0;

export type Periodo = "mensual" | "quincenal" | "semanal";

export const PERIODO_FACTOR: Record<Periodo, number> = {
  mensual: 1,
  quincenal: 1 / 2,
  semanal: 12 / 52,
};

export const PERIODO_LABEL: Record<Periodo, string> = {
  mensual: "Mensual",
  quincenal: "Quincenal",
  semanal: "Semanal",
};

/** ISR anual según la escala vigente. */
export function isrAnual(baseAnualGravable: number): number {
  const b = Math.max(0, baseAnualGravable);
  if (b <= ISR_EXENTO) return 0;
  if (b <= ISR_T2) return (b - ISR_EXENTO) * 0.15;
  if (b <= ISR_T3) return 31_216.0 + (b - ISR_T2) * 0.2;
  return 79_776.0 + (b - ISR_T3) * 0.25;
}

export interface PayrollInput {
  salarioBase: number; // mensual
  comisiones: number; // mensual
  horasExtra: number; // monto mensual (ya calculado)
  otrasDeducciones: number; // adelantos/préstamos, mensual
}

export interface PayrollCalc {
  // Ingresos
  salarioBase: number;
  comisiones: number;
  horasExtra: number;
  bruto: number;
  // Deducciones
  afp: number;
  sfs: number;
  tss: number;
  isr: number;
  otrasDeducciones: number;
  totalDeducciones: number;
  // Resultado
  neto: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cálculo MENSUAL correcto. La AFP/SFS se calculan sobre el salario
 *  cotizable (salario base) con sus topes; el ISR sobre el gravable menos TSS. */
export function calcularNominaMensual(input: PayrollInput): PayrollCalc {
  const salarioBase = Math.max(0, input.salarioBase);
  const comisiones = Math.max(0, input.comisiones);
  const horasExtra = Math.max(0, input.horasExtra);
  const otras = Math.max(0, input.otrasDeducciones);

  const bruto = salarioBase + comisiones + horasExtra;

  const afp = r2(Math.min(salarioBase, AFP_TOPE) * AFP_RATE);
  const sfs = r2(Math.min(salarioBase, SFS_TOPE) * SFS_RATE);
  const tss = r2(afp + sfs);

  const gravableMensual = bruto - tss;
  const isr = r2(isrAnual(gravableMensual * 12) / 12);

  const totalDeducciones = r2(tss + isr + otras);
  const neto = r2(bruto - totalDeducciones);

  return {
    salarioBase: r2(salarioBase),
    comisiones: r2(comisiones),
    horasExtra: r2(horasExtra),
    bruto: r2(bruto),
    afp,
    sfs,
    tss,
    isr,
    otrasDeducciones: r2(otras),
    totalDeducciones,
    neto,
  };
}

/** Escala un cálculo mensual al período elegido (para mostrar el volante). */
export function escalarPeriodo(calc: PayrollCalc, periodo: Periodo): PayrollCalc {
  const f = PERIODO_FACTOR[periodo];
  if (f === 1) return calc;
  const s = (n: number) => r2(n * f);
  return {
    salarioBase: s(calc.salarioBase),
    comisiones: s(calc.comisiones),
    horasExtra: s(calc.horasExtra),
    bruto: s(calc.bruto),
    afp: s(calc.afp),
    sfs: s(calc.sfs),
    tss: s(calc.tss),
    isr: s(calc.isr),
    otrasDeducciones: s(calc.otrasDeducciones),
    totalDeducciones: s(calc.totalDeducciones),
    neto: s(calc.neto),
  };
}

// ─── Número a letras (español, para el volante) ───────────────────────
const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const ESPECIALES = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const DECENAS = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function seccion(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  let out = "";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) out += CENTENAS[c] + " ";
  if (resto >= 10 && resto < 20) {
    out += ESPECIALES[resto - 10];
  } else if (resto === 20) {
    out += "VEINTE";
  } else if (resto > 20 && resto < 30) {
    out += "VEINTI" + UNIDADES[resto - 20];
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d > 0) out += DECENAS[d];
    if (d > 0 && u > 0) out += " Y ";
    if (u > 0) out += UNIDADES[u];
  }
  return out.trim();
}

/** Convierte un entero (0–999,999,999) a palabras en español. */
export function enteroALetras(num: number): string {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? "UN MILLÓN" : `${seccion(millones)} MILLONES`);
  if (miles > 0) partes.push(miles === 1 ? "MIL" : `${seccion(miles)} MIL`);
  if (resto > 0) partes.push(seccion(resto));
  return partes.join(" ").replace(/\s+/g, " ").trim();
}

/** "SETENTA Y CINCO MIL DOSCIENTOS PESOS CON 00/100" */
export function montoALetras(monto: number): string {
  const entero = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - entero) * 100);
  const cc = String(centavos).padStart(2, "0");
  return `${enteroALetras(entero)} PESOS CON ${cc}/100`;
}
