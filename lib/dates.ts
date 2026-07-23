// Helpers de fecha/hora puros para el calendario. Semana inicia lunes.

export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DIAS_LARGOS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

/** Lunes de la semana que contiene d. */
export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7; // 0 = lunes
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Matriz del mes (semanas completas de lunes a domingo). */
export function monthMatrix(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const weeks: Date[][] = [];
  let cur = start;
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, i) => addDays(cur, i));
    weeks.push(row);
    cur = addDays(cur, 7);
    // Corta si ya pasamos el mes y completamos la semana.
    if (cur.getMonth() !== anchor.getMonth() && w >= 4) {
      const stillInMonth = row.some((d) => d.getMonth() === anchor.getMonth());
      if (!stillInMonth) {
        weeks.pop();
        break;
      }
    }
  }
  return weeks;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function timeToMinutes(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "08:30" desde un time de Postgres. */
export function fmtHora(hora: string): string {
  return hora.slice(0, 5);
}

/** "8:30 AM" en formato 12h. */
export function fmtHora12(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

export function tituloRango(view: "mes" | "semana" | "dia", anchor: Date): string {
  if (view === "mes") return `${MESES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  if (view === "dia")
    return `${anchor.getDate()} de ${MESES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const days = weekDays(anchor);
  const a = days[0];
  const b = days[6];
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()} – ${b.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()}`;
  return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
}

export const CLINIC_START_HOUR = 8;
export const CLINIC_END_HOUR = 18;

export function timeSlots(stepMin = 30): string[] {
  const out: string[] = [];
  for (let m = CLINIC_START_HOUR * 60; m < CLINIC_END_HOUR * 60; m += stepMin) {
    out.push(minutesToTime(m));
  }
  return out;
}
