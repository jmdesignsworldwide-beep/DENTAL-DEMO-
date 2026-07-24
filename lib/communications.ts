import "server-only";

import { createClient } from "@/lib/supabase/server";
import { VARIABLES_DISPONIBLES } from "@/app/(app)/comunicaciones/estado-config";
import type {
  Canal,
  MensajeEstado,
} from "@/app/(app)/comunicaciones/estado-config";

const PAGE_SIZE = 20;

// ─── Motor de plantillas ────────────────────────────────────────────────

/** Reemplaza {variable} por su valor. Tolera acentos en los nombres. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  let out = body;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v ?? "");
  }
  return out;
}

/** Lista las variables {así} presentes en un cuerpo. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  const re = /\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) found.add(m[1].trim());
  return [...found];
}

/** Variables usadas que NO existen en el catálogo (para validar plantillas). */
export function unknownVariables(body: string): string[] {
  const known = new Set<string>(VARIABLES_DISPONIBLES);
  return extractVariables(body).filter((v) => !known.has(v));
}

// ─── Tipos ──────────────────────────────────────────────────────────────

export interface MessageTemplate {
  id: string;
  clave: string;
  nombre: string;
  canal: Canal;
  asunto: string | null;
  cuerpo: string;
  variables_disponibles: string[];
  activa: boolean;
  editable: boolean;
}

export interface QueueItem {
  id: string;
  patient_id: string;
  paciente: string;
  telefono: string | null;
  canal: Canal;
  plantilla_clave: string;
  tipo: string;
  destinatario: string;
  cuerpo: string;
  asunto: string | null;
  programado_para: string;
  estado: MensajeEstado;
  cita_id: string | null;
}

export interface HistoryItem {
  id: number;
  patient_id: string;
  paciente: string;
  canal: string;
  direccion: "saliente" | "entrante";
  plantilla_clave: string | null;
  cuerpo: string;
  estado: string | null;
  created_at: string;
}

export interface CommPrefs {
  patient_id: string;
  acepta_whatsapp: boolean;
  acepta_sms: boolean;
  acepta_email: boolean;
  horario_preferido: string;
  opt_out_fecha: string | null;
  opt_out_motivo: string | null;
}

export interface CommStats {
  pendientesHoy: number;
  programados: number;
  enviadosMes: number;
  tasaRespuesta: number; // %
}

export interface ImpactMetrics {
  noShowBase: number; // % sin recordatorio
  noShowConRecordatorio: number; // % con recordatorio
  citasConRecordatorio: number;
  citasSinRecordatorio: number;
  citasSalvadas: number;
  ticketPromedio: number;
  dineroRecuperado: number;
  recordatoriosEnviados: number;
  tasaRespuesta: number;
  confirmadas: number;
  higieneRecuperados: number;
  presupuestosCerrados: number;
  comparativa: { label: string; pct: number }[];
  porEstado: { estado: string; total: number }[];
}

function pickNombre(p: unknown): string {
  if (Array.isArray(p)) return p[0]?.nombre ?? "Paciente";
  if (p && typeof p === "object" && "nombre" in p) return (p as { nombre: string }).nombre;
  return "Paciente";
}
function pickTelefono(p: unknown): string | null {
  if (Array.isArray(p)) return p[0]?.telefono ?? null;
  if (p && typeof p === "object" && "telefono" in p)
    return (p as { telefono: string | null }).telefono;
  return null;
}

function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// ─── Plantillas ─────────────────────────────────────────────────────────

export async function listTemplates(): Promise<MessageTemplate[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("message_templates")
      .select("id, clave, nombre, canal, asunto, cuerpo, variables_disponibles, activa, editable")
      .order("nombre", { ascending: true });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      clave: r.clave as string,
      nombre: r.nombre as string,
      canal: r.canal as Canal,
      asunto: (r.asunto as string | null) ?? null,
      cuerpo: r.cuerpo as string,
      variables_disponibles: (r.variables_disponibles as string[]) ?? [],
      activa: !!r.activa,
      editable: !!r.editable,
    }));
  } catch {
    return [];
  }
}

// ─── Cola e historial ───────────────────────────────────────────────────

export async function listTodayQueue(): Promise<QueueItem[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scheduled_messages")
      .select(
        "id, patient_id, canal, plantilla_clave, tipo, destinatario, cuerpo_renderizado, asunto_renderizado, programado_para, estado, cita_id, patients(nombre, telefono)",
      )
      .eq("estado", "programado")
      .lte("programado_para", endOfTodayISO())
      .order("programado_para", { ascending: true });
    if (error || !data) return [];
    return data.map(mapQueue);
  } catch {
    return [];
  }
}

export async function listUpcoming(days = 14): Promise<QueueItem[]> {
  try {
    const supabase = createClient();
    const to = new Date();
    to.setDate(to.getDate() + days);
    const { data, error } = await supabase
      .from("scheduled_messages")
      .select(
        "id, patient_id, canal, plantilla_clave, tipo, destinatario, cuerpo_renderizado, asunto_renderizado, programado_para, estado, cita_id, patients(nombre, telefono)",
      )
      .eq("estado", "programado")
      .gt("programado_para", endOfTodayISO())
      .lte("programado_para", to.toISOString())
      .order("programado_para", { ascending: true })
      .limit(100);
    if (error || !data) return [];
    return data.map(mapQueue);
  } catch {
    return [];
  }
}

function mapQueue(r: Record<string, unknown>): QueueItem {
  return {
    id: r.id as string,
    patient_id: r.patient_id as string,
    paciente: pickNombre(r.patients),
    telefono: pickTelefono(r.patients),
    canal: r.canal as Canal,
    plantilla_clave: r.plantilla_clave as string,
    tipo: (r.tipo as string) ?? "manual",
    destinatario: r.destinatario as string,
    cuerpo: r.cuerpo_renderizado as string,
    asunto: (r.asunto_renderizado as string | null) ?? null,
    programado_para: r.programado_para as string,
    estado: r.estado as MensajeEstado,
    cita_id: (r.cita_id as string | null) ?? null,
  };
}

/** Historial reciente completo (para filtrar/paginar en el cliente). */
export async function listRecentHistory(limit = 300): Promise<HistoryItem[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("communication_log")
      .select("id, patient_id, canal, direccion, plantilla_clave, cuerpo, estado, created_at, patients(nombre)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as number,
      patient_id: r.patient_id as string,
      paciente: pickNombre(r.patients),
      canal: r.canal as string,
      direccion: r.direccion as "saliente" | "entrante",
      plantilla_clave: (r.plantilla_clave as string | null) ?? null,
      cuerpo: r.cuerpo as string,
      estado: (r.estado as string | null) ?? null,
      created_at: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

export interface HistoryParams {
  q?: string;
  canal?: Canal | "todos";
  estado?: MensajeEstado | "todos";
  page?: number;
}

export async function listHistory(
  params: HistoryParams,
): Promise<{ rows: HistoryItem[]; total: number; page: number; pageCount: number }> {
  try {
    const supabase = createClient();
    const page = Math.max(1, params.page ?? 1);
    const from = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from("communication_log")
      .select(
        "id, patient_id, canal, direccion, plantilla_clave, cuerpo, estado, created_at, patients(nombre)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (params.canal && params.canal !== "todos") query = query.eq("canal", params.canal);
    if (params.estado && params.estado !== "todos") query = query.eq("estado", params.estado);

    const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error || !data) return { rows: [], total: 0, page: 1, pageCount: 1 };

    const rows: HistoryItem[] = data.map((r) => ({
      id: r.id as number,
      patient_id: r.patient_id as string,
      paciente: pickNombre(r.patients),
      canal: r.canal as string,
      direccion: r.direccion as "saliente" | "entrante",
      plantilla_clave: (r.plantilla_clave as string | null) ?? null,
      cuerpo: r.cuerpo as string,
      estado: (r.estado as string | null) ?? null,
      created_at: r.created_at as string,
    }));
    const total = count ?? rows.length;
    return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  } catch {
    return { rows: [], total: 0, page: 1, pageCount: 1 };
  }
}

// ─── KPIs ligeros ───────────────────────────────────────────────────────

export async function getCommStats(): Promise<CommStats> {
  const empty: CommStats = { pendientesHoy: 0, programados: 0, enviadosMes: 0, tasaRespuesta: 0 };
  try {
    const supabase = createClient();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [hoy, prog, enviados, respondidos] = await Promise.all([
      supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("estado", "programado")
        .lte("programado_para", endOfTodayISO()),
      supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("estado", "programado"),
      supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .in("estado", ["enviado", "entregado", "leido", "respondido"])
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("scheduled_messages")
        .select("id", { count: "exact", head: true })
        .eq("estado", "respondido")
        .gte("created_at", monthStart.toISOString()),
    ]);
    const env = enviados.count ?? 0;
    return {
      pendientesHoy: hoy.count ?? 0,
      programados: prog.count ?? 0,
      enviadosMes: env,
      tasaRespuesta: env === 0 ? 0 : Math.round(((respondidos.count ?? 0) / env) * 100),
    };
  } catch {
    return empty;
  }
}

/** Para el dashboard: mensajes por despachar hoy. */
export async function getPendingTodayCount(): Promise<number> {
  try {
    const supabase = createClient();
    const { count } = await supabase
      .from("scheduled_messages")
      .select("id", { count: "exact", head: true })
      .eq("estado", "programado")
      .lte("programado_para", endOfTodayISO());
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Preferencias ───────────────────────────────────────────────────────

export async function getCommPrefs(patientId: string): Promise<CommPrefs | null> {
  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return null;
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("patient_communication_prefs")
      .select("patient_id, acepta_whatsapp, acepta_sms, acepta_email, horario_preferido, opt_out_fecha, opt_out_motivo")
      .eq("patient_id", patientId)
      .maybeSingle();
    if (!data) return null;
    return data as CommPrefs;
  } catch {
    return null;
  }
}

// ─── Panel de impacto (el argumento de venta) ───────────────────────────

export async function getImpactMetrics(): Promise<ImpactMetrics> {
  const empty: ImpactMetrics = {
    noShowBase: 0,
    noShowConRecordatorio: 0,
    citasConRecordatorio: 0,
    citasSinRecordatorio: 0,
    citasSalvadas: 0,
    ticketPromedio: 0,
    dineroRecuperado: 0,
    recordatoriosEnviados: 0,
    tasaRespuesta: 0,
    confirmadas: 0,
    higieneRecuperados: 0,
    presupuestosCerrados: 0,
    comparativa: [],
    porEstado: [],
  };
  try {
    const supabase = createClient();

    const [citasRes, remindersRes, msgsRes, invoicesRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, estado, fecha")
        .lt("fecha", new Date().toISOString().slice(0, 10))
        .in("estado", ["completada", "no_show", "cancelada"]),
      supabase
        .from("scheduled_messages")
        .select("cita_id, tipo")
        .not("cita_id", "is", null)
        .like("tipo", "recordatorio%"),
      supabase.from("scheduled_messages").select("estado, tipo, respuesta_paciente"),
      supabase.from("invoices").select("total").eq("estado", "pagada"),
    ]);

    const reminded = new Set(
      (remindersRes.data ?? []).map((r) => r.cita_id as string).filter(Boolean),
    );
    const citas = citasRes.data ?? [];

    let remTotal = 0,
      remNoShow = 0,
      baseTotal = 0,
      baseNoShow = 0;
    for (const c of citas) {
      const isNoShow = c.estado === "no_show";
      if (reminded.has(c.id as string)) {
        remTotal += 1;
        if (isNoShow) remNoShow += 1;
      } else {
        baseTotal += 1;
        if (isNoShow) baseNoShow += 1;
      }
    }
    const noShowBase = baseTotal === 0 ? 0 : (baseNoShow / baseTotal) * 100;
    const noShowRem = remTotal === 0 ? 0 : (remNoShow / remTotal) * 100;

    const invoices = invoicesRes.data ?? [];
    const ticketPromedio =
      invoices.length === 0
        ? 0
        : invoices.reduce((a, r) => a + Number(r.total), 0) / invoices.length;

    // Citas salvadas = diferencia de tasa de no-show aplicada al volumen con recordatorio.
    const citasSalvadas = Math.max(
      0,
      Math.round(((noShowBase - noShowRem) / 100) * remTotal),
    );

    const msgs = msgsRes.data ?? [];
    const enviados = msgs.filter((m) =>
      ["enviado", "entregado", "leido", "respondido"].includes(m.estado as string),
    ).length;
    const respondidos = msgs.filter((m) => m.estado === "respondido").length;
    const confirmadas = msgs.filter(
      (m) => m.estado === "respondido" && (m.respuesta_paciente as string | null) === "CONFIRMO",
    ).length;
    const higieneRecuperados = msgs.filter(
      (m) => m.tipo === "higiene_6meses" && m.estado === "respondido",
    ).length;
    const presupuestosCerrados = msgs.filter(
      (m) => m.tipo === "seguimiento_presupuesto" && m.estado === "respondido",
    ).length;

    const porEstadoMap = new Map<string, number>();
    for (const m of msgs) {
      const e = m.estado as string;
      porEstadoMap.set(e, (porEstadoMap.get(e) ?? 0) + 1);
    }

    return {
      noShowBase: Math.round(noShowBase * 10) / 10,
      noShowConRecordatorio: Math.round(noShowRem * 10) / 10,
      citasConRecordatorio: remTotal,
      citasSinRecordatorio: baseTotal,
      citasSalvadas,
      ticketPromedio: Math.round(ticketPromedio),
      dineroRecuperado: Math.round(citasSalvadas * ticketPromedio),
      recordatoriosEnviados: enviados,
      tasaRespuesta: enviados === 0 ? 0 : Math.round((respondidos / enviados) * 100),
      confirmadas,
      higieneRecuperados,
      presupuestosCerrados,
      comparativa: [
        { label: "Sin recordatorio", pct: Math.round(noShowBase * 10) / 10 },
        { label: "Con recordatorio", pct: Math.round(noShowRem * 10) / 10 },
      ],
      porEstado: [...porEstadoMap.entries()].map(([estado, total]) => ({ estado, total })),
    };
  } catch {
    return empty;
  }
}
