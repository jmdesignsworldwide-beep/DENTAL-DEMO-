import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface SerieMes {
  mes: string;
  value: number;
}
export interface Segmento {
  key: string;
  label: string;
  value: number;
  color: string;
}
export interface Barra {
  nombre: string;
  value: number;
}

export interface ReportData {
  from: string;
  to: string;
  kpis: {
    ingresoTotal: number;
    ingresoTotalPrev: number;
    ticket: number;
    ticketPrev: number;
    pacientesNuevos: number;
    pacientesNuevosPrev: number;
    ocupacion: number;
    ocupacionPrev: number;
  };
  ingresosMensuales: SerieMes[];
  pacientesMensuales: SerieMes[];
  noShowTendencia: SerieMes[];
  citasPorEstado: Segmento[];
  ingresosPorMetodo: Segmento[];
  topTratamientos: Barra[];
}

const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const ESTADO_COLOR: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "#F59E0B" },
  confirmada: { label: "Confirmada", color: "#0066CC" },
  sala_espera: { label: "Sala de espera", color: "#0891B2" },
  en_sillon: { label: "En el sillón", color: "#14B8A6" },
  completada: { label: "Completada", color: "#00C896" },
  cancelada: { label: "Cancelada", color: "#EF4444" },
  no_show: { label: "No asistió", color: "#B91C1C" },
  seguimiento: { label: "Seguimiento", color: "#8B5CF6" },
};
const METODO_COLOR: Record<string, { label: string; color: string }> = {
  efectivo: { label: "Efectivo", color: "#00C896" },
  transferencia: { label: "Transferencia", color: "#0066CC" },
  tarjeta: { label: "Tarjeta", color: "#8B5CF6" },
  seguro: { label: "Seguro", color: "#C9A84C" },
  mixto: { label: "Mixto", color: "#F59E0B" },
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addMonthsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

export async function getReports(fromISO: string, toISO: string): Promise<ReportData> {
  const from = new Date(fromISO + "T00:00:00Z");
  const to = new Date(toISO + "T00:00:00Z");

  // 6 buckets de mes terminando en `to`.
  const buckets: { key: string; label: string }[] = [];
  const baseMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  for (let i = 5; i >= 0; i--) {
    const m = addMonthsUTC(baseMonth, -i);
    buckets.push({
      key: `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`,
      label: MESES_CORTO[m.getUTCMonth()],
    });
  }

  const rangeLen = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
  const prevFrom = new Date(from.getTime() - (rangeLen + 1) * 86400000);
  const windowStart = new Date(Math.min(new Date(buckets[0].key + "-01T00:00:00Z").getTime(), prevFrom.getTime()));

  const empty: ReportData = {
    from: fromISO,
    to: toISO,
    kpis: { ingresoTotal: 0, ingresoTotalPrev: 0, ticket: 0, ticketPrev: 0, pacientesNuevos: 0, pacientesNuevosPrev: 0, ocupacion: 0, ocupacionPrev: 0 },
    ingresosMensuales: buckets.map((b) => ({ mes: b.label, value: 0 })),
    pacientesMensuales: buckets.map((b) => ({ mes: b.label, value: 0 })),
    noShowTendencia: buckets.map((b) => ({ mes: b.label, value: 0 })),
    citasPorEstado: [],
    ingresosPorMetodo: [],
    topTratamientos: [],
  };

  try {
    const supabase = createClient();
    const [invRes, aptRes, patRes, payRes] = await Promise.all([
      supabase.from("invoices").select("fecha, total, estado").gte("fecha", ymd(windowStart)).lte("fecha", toISO),
      supabase.from("appointments").select("fecha, estado, tratamiento").gte("fecha", ymd(windowStart)).lte("fecha", toISO),
      supabase.from("patients").select("created_at").gte("created_at", ymd(windowStart)).lte("created_at", toISO + "T23:59:59Z"),
      supabase.from("payments").select("metodo, monto, fecha").gte("fecha", fromISO).lte("fecha", toISO),
    ]);

    const invoices = (invRes.data ?? []) as { fecha: string; total: number; estado: string }[];
    const appointments = (aptRes.data ?? []) as { fecha: string; estado: string; tratamiento: string }[];
    const patients = (patRes.data ?? []) as { created_at: string }[];
    const payments = (payRes.data ?? []) as { metodo: string; monto: number; fecha: string }[];

    const inRange = (f: string) => f >= fromISO && f <= toISO;
    const inPrev = (f: string) => f >= ymd(prevFrom) && f < fromISO;
    const monthKey = (f: string) => f.slice(0, 7);

    // Series mensuales.
    const ingresosMensuales = buckets.map((b) => ({
      mes: b.label,
      value: invoices.filter((i) => i.estado === "pagada" && monthKey(i.fecha) === b.key).reduce((a, i) => a + Number(i.total), 0),
    }));
    const pacientesMensuales = buckets.map((b) => ({
      mes: b.label,
      value: patients.filter((p) => monthKey(p.created_at) === b.key).length,
    }));
    const noShowTendencia = buckets.map((b) => {
      const total = appointments.filter((a) => monthKey(a.fecha) === b.key).length;
      const ns = appointments.filter((a) => monthKey(a.fecha) === b.key && a.estado === "no_show").length;
      return { mes: b.label, value: total ? Math.round((ns / total) * 1000) / 10 : 0 };
    });

    // Distribución en rango.
    const estadoCount = new Map<string, number>();
    appointments.filter((a) => inRange(a.fecha)).forEach((a) => estadoCount.set(a.estado, (estadoCount.get(a.estado) ?? 0) + 1));
    const citasPorEstado: Segmento[] = Array.from(estadoCount.entries())
      .map(([key, value]) => ({ key, label: ESTADO_COLOR[key]?.label ?? key, value, color: ESTADO_COLOR[key]?.color ?? "#94A3B8" }))
      .sort((a, b) => b.value - a.value);

    const tratCount = new Map<string, number>();
    appointments.filter((a) => inRange(a.fecha)).forEach((a) => tratCount.set(a.tratamiento, (tratCount.get(a.tratamiento) ?? 0) + 1));
    const topTratamientos: Barra[] = Array.from(tratCount.entries())
      .map(([nombre, value]) => ({ nombre, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const metodoSum = new Map<string, number>();
    payments.forEach((p) => metodoSum.set(p.metodo, (metodoSum.get(p.metodo) ?? 0) + Number(p.monto)));
    const ingresosPorMetodo: Segmento[] = Array.from(metodoSum.entries())
      .map(([key, value]) => ({ key, label: METODO_COLOR[key]?.label ?? key, value: Math.round(value), color: METODO_COLOR[key]?.color ?? "#94A3B8" }))
      .sort((a, b) => b.value - a.value);

    // KPIs.
    const pagadasRange = invoices.filter((i) => i.estado === "pagada" && inRange(i.fecha));
    const pagadasPrev = invoices.filter((i) => i.estado === "pagada" && inPrev(i.fecha));
    const ingresoTotal = pagadasRange.reduce((a, i) => a + Number(i.total), 0);
    const ingresoTotalPrev = pagadasPrev.reduce((a, i) => a + Number(i.total), 0);
    const ticket = pagadasRange.length ? Math.round(ingresoTotal / pagadasRange.length) : 0;
    const ticketPrev = pagadasPrev.length ? Math.round(ingresoTotalPrev / pagadasPrev.length) : 0;
    const pacientesNuevos = patients.filter((p) => inRange(p.created_at)).length;
    const pacientesNuevosPrev = patients.filter((p) => inPrev(p.created_at)).length;

    const ocup = (pred: (f: string) => boolean) => {
      const total = appointments.filter((a) => pred(a.fecha)).length;
      const at = appointments.filter((a) => pred(a.fecha) && a.estado === "completada").length;
      return total ? Math.round((at / total) * 1000) / 10 : 0;
    };
    const ocupacion = ocup(inRange);
    const ocupacionPrev = ocup(inPrev);

    return {
      from: fromISO,
      to: toISO,
      kpis: { ingresoTotal, ingresoTotalPrev, ticket, ticketPrev, pacientesNuevos, pacientesNuevosPrev, ocupacion, ocupacionPrev },
      ingresosMensuales,
      pacientesMensuales,
      noShowTendencia,
      citasPorEstado,
      ingresosPorMetodo,
      topTratamientos,
    };
  } catch {
    return empty;
  }
}
