import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge condicional de clases Tailwind sin conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formato de moneda dominicana: RD$ 1,234.56 */
export function formatRD(amount: number): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace("DOP", "RD$");
}

/** Fecha larga en español: 23 de julio de 2026 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Iniciales para avatares fallback. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Saludo según la hora local. */
export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** "hace 12 min", "hace 3 h", "ayer", etc. */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return formatDateLong(d);
}

/** "08:30" a partir de un time de Postgres ("08:30:00") o Date. */
export function formatHora(time: string): string {
  const [h, m] = time.split(":");
  return `${h}:${m}`;
}

/** Cambio porcentual seguro (evita división por cero). */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
