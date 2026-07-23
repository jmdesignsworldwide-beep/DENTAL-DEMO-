import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface Patient {
  id: string;
  nombre: string;
  cedula: string | null;
  fecha_nacimiento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  tipo_sangre: string | null;
  alergias: string | null;
  medicamentos: string | null;
  condiciones: string | null;
  seguro: string | null;
  poliza: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  es_vip: boolean;
  activo: boolean;
  notas: string | null;
  foto_path: string | null;
  created_at: string;
}

export interface PatientOverview extends Patient {
  ultima_visita: string | null;
  num_tratamientos: number;
  proxima_cita: string | null;
  total_gastado: number;
}

export interface TreatmentRow {
  id: string;
  fecha: string;
  hora: string;
  tratamiento: string;
  estado: string;
  dentista: string | null;
}

export type EstadoFiltro = "todos" | "activo" | "inactivo" | "vip";
export type EdadFiltro = "todas" | "menor" | "18-39" | "40-59" | "60+";
export type SortKey = "nombre" | "cedula" | "created_at" | "ultima_visita";

export interface ListParams {
  q?: string;
  estado?: EstadoFiltro;
  edad?: EdadFiltro;
  alertas?: boolean;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
}

export const PAGE_SIZE = 12;

/** Quita caracteres que romperían el filtro `.or()` de PostgREST. */
function sanitizeQuery(q: string): string {
  return q.replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
}

function edadToRange(edad: EdadFiltro): { gte?: string; lte?: string } {
  const now = new Date();
  const iso = (y: number) =>
    new Date(now.getFullYear() - y, now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 10);
  switch (edad) {
    case "menor":
      return { gte: iso(18) }; // nacidos hace < 18 años
    case "18-39":
      return { gte: iso(40), lte: iso(18) };
    case "40-59":
      return { gte: iso(60), lte: iso(40) };
    case "60+":
      return { lte: iso(60) };
    default:
      return {};
  }
}

export async function listPatients(params: ListParams): Promise<{
  rows: PatientOverview[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  try {
    const supabase = createClient();
    let query = supabase
      .from("patient_overview")
      .select("*", { count: "exact" });

    if (params.q) {
      const q = sanitizeQuery(params.q);
      if (q) {
        query = query.or(
          `nombre.ilike.%${q}%,cedula.ilike.%${q}%,telefono.ilike.%${q}%`,
        );
      }
    }

    switch (params.estado) {
      case "activo":
        query = query.eq("activo", true).eq("es_vip", false);
        break;
      case "inactivo":
        query = query.eq("activo", false);
        break;
      case "vip":
        query = query.eq("es_vip", true);
        break;
    }

    if (params.alertas) {
      query = query.or(
        "alergias.not.is.null,medicamentos.not.is.null,condiciones.not.is.null",
      );
    }

    if (params.edad && params.edad !== "todas") {
      const r = edadToRange(params.edad);
      if (r.gte) query = query.gte("fecha_nacimiento", r.gte);
      if (r.lte) query = query.lte("fecha_nacimiento", r.lte);
    }

    const sort: SortKey = params.sort ?? "nombre";
    const asc = (params.dir ?? "asc") === "asc";
    query = query
      .order(sort, { ascending: asc, nullsFirst: false })
      .range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    const total = count ?? 0;
    return {
      rows: (data ?? []) as PatientOverview[],
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  } catch {
    return { rows: [], total: 0, page, pageCount: 1 };
  }
}

export async function getPatient(id: string): Promise<PatientOverview | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("patient_overview")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return data as PatientOverview;
  } catch {
    return null;
  }
}

export async function getTreatmentHistory(
  patientId: string,
): Promise<TreatmentRow[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("id, fecha, hora, tratamiento, estado, dentista_nombre")
      .eq("patient_id", patientId)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      fecha: r.fecha as string,
      hora: r.hora as string,
      tratamiento: r.tratamiento as string,
      estado: r.estado as string,
      dentista: (r.dentista_nombre as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}
