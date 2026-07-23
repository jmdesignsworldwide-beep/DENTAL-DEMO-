import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ActiveUser } from "@/lib/auth";
import { pctChange } from "@/lib/utils";

export type AppointmentEstado =
  | "confirmada"
  | "sala_espera"
  | "en_sillon"
  | "completada"
  | "cancelada"
  | "no_show";

export interface CitaHoy {
  id: string;
  hora: string;
  paciente: string;
  tratamiento: string;
  dentista: string | null;
  estado: AppointmentEstado;
}

export interface ProximaCita {
  id: string;
  fecha: string;
  hora: string;
  paciente: string;
  tratamiento: string;
}

export interface ActividadItem {
  id: number;
  actor: string;
  action: string;
  entity: string | null;
  created_at: string;
}

export interface DashboardData {
  kpis: {
    pacientesMes: number;
    pacientesMesTrend: number;
    citasHoy: number;
    ingresosMes: number | null;
    ingresosMesTrend: number | null;
    tratamientosPendientes: number;
    pacientesActivos: number;
  };
  citasHoy: CitaHoy[];
  proximas: ProximaCita[];
  actividad: ActividadItem[];
  canSeeIncome: boolean;
}

const EMPTY: DashboardData = {
  kpis: {
    pacientesMes: 0,
    pacientesMesTrend: 0,
    citasHoy: 0,
    ingresosMes: null,
    ingresosMesTrend: null,
    tratamientosPendientes: 0,
    pacientesActivos: 0,
  },
  citasHoy: [],
  proximas: [],
  actividad: [],
  canSeeIncome: false,
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonthISO(offset = 0) {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 10);
}

/**
 * Reúne todos los datos del dashboard respetando RLS con la sesión del
 * usuario. Cualquier fallo (Supabase no configurado, red) degrada a vacío
 * sin romper la página — el UI muestra estados vacíos elegantes.
 */
export async function getDashboardData(
  user: ActiveUser,
): Promise<DashboardData> {
  try {
    const supabase = createClient();
    const today = todayISO();
    const monthStart = startOfMonthISO(0);
    const prevMonthStart = startOfMonthISO(-1);

    const canSeeIncome = user.rol === "owner" || user.rol === "recepcionista";

    const [
      pacientesMesRes,
      pacientesPrevRes,
      pacientesActivosRes,
      citasHoyCountRes,
      pendientesRes,
      citasHoyListRes,
      proximasRes,
      actividadRes,
    ] = await Promise.all([
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .gte("created_at", prevMonthStart)
        .lt("created_at", monthStart),
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("fecha", today),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("estado", "confirmada")
        .gte("fecha", today),
      supabase
        .from("appointments")
        .select("id, hora, tratamiento, dentista_nombre, estado, patients(nombre)")
        .eq("fecha", today)
        .order("hora", { ascending: true }),
      supabase
        .from("appointments")
        .select("id, fecha, hora, tratamiento, patients(nombre)")
        .gte("fecha", today)
        .in("estado", ["confirmada", "sala_espera", "en_sillon"])
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true })
        .limit(5),
      supabase
        .from("activity_log")
        .select("id, action, entity, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Ingresos: solo si el rol tiene acceso (RLS también lo protege).
    let ingresosMes: number | null = null;
    let ingresosMesTrend: number | null = null;
    if (canSeeIncome) {
      const [thisMonth, lastMonth] = await Promise.all([
        supabase
          .from("invoices")
          .select("monto")
          .eq("estado", "pagada")
          .gte("fecha", monthStart),
        supabase
          .from("invoices")
          .select("monto")
          .eq("estado", "pagada")
          .gte("fecha", prevMonthStart)
          .lt("fecha", monthStart),
      ]);
      const sum = (rows: { monto: number }[] | null) =>
        (rows ?? []).reduce((a, r) => a + Number(r.monto), 0);
      ingresosMes = sum(thisMonth.data);
      ingresosMesTrend = pctChange(ingresosMes, sum(lastMonth.data));
    }

    const pacientesMes = pacientesMesRes.count ?? 0;
    const pacientesPrev = pacientesPrevRes.count ?? 0;

    const pickNombre = (p: unknown): string => {
      // patients() puede venir como objeto o arreglo según el join.
      if (Array.isArray(p)) return p[0]?.nombre ?? "Paciente";
      if (p && typeof p === "object" && "nombre" in p)
        return (p as { nombre: string }).nombre;
      return "Paciente";
    };

    const citasHoy: CitaHoy[] = (citasHoyListRes.data ?? []).map((r) => ({
      id: r.id as string,
      hora: r.hora as string,
      tratamiento: r.tratamiento as string,
      dentista: (r.dentista_nombre as string | null) ?? null,
      estado: r.estado as AppointmentEstado,
      paciente: pickNombre((r as { patients: unknown }).patients),
    }));

    const proximas: ProximaCita[] = (proximasRes.data ?? []).map((r) => ({
      id: r.id as string,
      fecha: r.fecha as string,
      hora: r.hora as string,
      tratamiento: r.tratamiento as string,
      paciente: pickNombre((r as { patients: unknown }).patients),
    }));

    const actividad: ActividadItem[] = (actividadRes.data ?? []).map((r) => {
      const meta = (r.meta ?? {}) as { actor?: string };
      return {
        id: r.id as number,
        actor: meta.actor ?? "Sistema",
        action: r.action as string,
        entity: (r.entity as string | null) ?? null,
        created_at: r.created_at as string,
      };
    });

    return {
      kpis: {
        pacientesMes,
        pacientesMesTrend: pctChange(pacientesMes, pacientesPrev),
        citasHoy: citasHoyCountRes.count ?? 0,
        ingresosMes,
        ingresosMesTrend,
        tratamientosPendientes: pendientesRes.count ?? 0,
        pacientesActivos: pacientesActivosRes.count ?? 0,
      },
      citasHoy,
      proximas,
      actividad,
      canSeeIncome,
    };
  } catch {
    return EMPTY;
  }
}
