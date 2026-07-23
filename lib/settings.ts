import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ClinicSettings {
  nombre: string;
  eslogan: string | null;
  mensajeBienvenida: string | null;
  colorAcento: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  rnc: string | null;
  sitioWeb: string | null;
  redes: Record<string, string>;
  nivelPrivacidad: "completo" | "inicial" | "solo_nombre";
  horarioSemanal: Record<string, { abre: string; cierra: string; desc: [string, string] | null } | null>;
  citasConfig: {
    duracion_default: number;
    intervalo_slot: number;
    dias_anticipacion: number;
    buffer_min: number;
    cancelacion_horas: number;
    recordatorio_horas: number;
    recordatorio_canal: string;
  };
  recordatorioPlantilla: string;
  ncfAlertaUmbral: number;
  lastBackupAt: string | null;
  emergencyActive: boolean;
  emergencyMessage: string | null;
  emergencySeverity: "warning" | "danger";
  consultorios: number;
  mostrarFoto: boolean;
}
export interface Holiday { id: string; fecha: string; nombre: string; respetado: boolean }
export interface AppUser { id: string; nombre: string; email: string; rol: string; estado: string; ultimoAcceso: string | null; dispositivo: string | null }
export interface NcfSeq { tipo: string; prefijo: string; actual: number; final: number }
export interface TreatmentLite { id: string; nombre: string; categoria: string; precio: number; activo: boolean }
export interface WaitingContent { id: string; tipo: string; titulo: string; cuerpo: string; orden: number; activo: boolean }
export interface ScreenToken { id: string; token: string; nombre: string | null; activo: boolean; createdAt: string }
export interface AuditEntry { id: number; action: string; entity: string | null; actor: string | null; createdAt: string; meta: Record<string, unknown> }

export interface SettingsData {
  clinic: ClinicSettings;
  holidays: Holiday[];
  users: AppUser[];
  ncf: NcfSeq[];
  treatments: TreatmentLite[];
  waiting: WaitingContent[];
  tokens: ScreenToken[];
  audit: AuditEntry[];
}

const DEFAULT_CITAS = {
  duracion_default: 30, intervalo_slot: 30, dias_anticipacion: 60,
  buffer_min: 10, cancelacion_horas: 24, recordatorio_horas: 24, recordatorio_canal: "whatsapp",
};

export async function getSettingsData(): Promise<SettingsData> {
  const supabase = createClient();

  const [setRes, holRes, usrRes, ncfRes, tratRes, wcRes, tokRes, audRes] = await Promise.all([
    supabase.from("clinic_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("clinic_holidays").select("id, fecha, nombre, respetado").order("fecha", { ascending: true }),
    supabase.from("app_users").select("id, nombre, email, rol, estado, ultimo_acceso, dispositivo").order("created_at", { ascending: true }),
    supabase.from("ncf_sequences").select("tipo, prefijo, secuencia_actual, secuencia_final").order("tipo", { ascending: true }),
    supabase.from("treatments").select("id, nombre, categoria, precio, activo").order("categoria", { ascending: true }).order("nombre", { ascending: true }),
    supabase.from("waiting_room_content").select("id, tipo, titulo, cuerpo, orden, activo").order("orden", { ascending: true }),
    supabase.from("screen_tokens").select("id, token, nombre, activo, created_at").order("created_at", { ascending: false }),
    supabase.from("activity_log").select("id, action, entity, created_at, meta, profiles(nombre)").order("created_at", { ascending: false }).limit(120),
  ]);

  const s = (setRes.data ?? {}) as Record<string, unknown>;
  const clinic: ClinicSettings = {
    nombre: (s.nombre as string) ?? "Clínica Dental",
    eslogan: (s.eslogan as string | null) ?? null,
    mensajeBienvenida: (s.mensaje_bienvenida as string | null) ?? null,
    colorAcento: (s.color_acento as string) ?? "#0066CC",
    direccion: (s.direccion as string | null) ?? null,
    telefono: (s.telefono as string | null) ?? null,
    email: (s.email as string | null) ?? null,
    rnc: (s.rnc as string | null) ?? null,
    sitioWeb: (s.sitio_web as string | null) ?? null,
    redes: (s.redes as Record<string, string>) ?? {},
    nivelPrivacidad: ((s.nivel_privacidad as string) as ClinicSettings["nivelPrivacidad"]) ?? "inicial",
    horarioSemanal: (s.horario_semanal as ClinicSettings["horarioSemanal"]) ?? {},
    citasConfig: { ...DEFAULT_CITAS, ...((s.citas_config as object) ?? {}) },
    recordatorioPlantilla: (s.recordatorio_plantilla as string) ?? "",
    ncfAlertaUmbral: Number(s.ncf_alerta_umbral ?? 1000),
    lastBackupAt: (s.last_backup_at as string | null) ?? null,
    emergencyActive: !!s.emergency_active,
    emergencyMessage: (s.emergency_message as string | null) ?? null,
    emergencySeverity: ((s.emergency_severity as string) === "danger" ? "danger" : "warning"),
    consultorios: Number(s.consultorios ?? 1),
    mostrarFoto: !!s.mostrar_foto,
  };

  const holidays = ((holRes.data ?? []) as Record<string, unknown>[]).map((h) => ({
    id: h.id as string, fecha: h.fecha as string, nombre: h.nombre as string, respetado: !!h.respetado,
  }));
  const users = ((usrRes.data ?? []) as Record<string, unknown>[]).map((u) => ({
    id: u.id as string, nombre: u.nombre as string, email: u.email as string, rol: u.rol as string,
    estado: u.estado as string, ultimoAcceso: (u.ultimo_acceso as string | null) ?? null, dispositivo: (u.dispositivo as string | null) ?? null,
  }));
  const ncf = ((ncfRes.data ?? []) as Record<string, unknown>[]).map((n) => ({
    tipo: n.tipo as string, prefijo: n.prefijo as string, actual: Number(n.secuencia_actual ?? 0), final: Number(n.secuencia_final ?? 0),
  }));
  const treatments = ((tratRes.data ?? []) as Record<string, unknown>[]).map((t) => ({
    id: t.id as string, nombre: t.nombre as string, categoria: t.categoria as string, precio: Number(t.precio ?? 0), activo: !!t.activo,
  }));
  const waiting = ((wcRes.data ?? []) as Record<string, unknown>[]).map((w) => ({
    id: w.id as string, tipo: w.tipo as string, titulo: w.titulo as string, cuerpo: w.cuerpo as string, orden: Number(w.orden ?? 0), activo: !!w.activo,
  }));
  const tokens = ((tokRes.data ?? []) as Record<string, unknown>[]).map((t) => ({
    id: t.id as string, token: t.token as string, nombre: (t.nombre as string | null) ?? null, activo: !!t.activo, createdAt: t.created_at as string,
  }));
  const audit = ((audRes.data ?? []) as Record<string, unknown>[]).map((a) => {
    const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    return {
      id: Number(a.id), action: a.action as string, entity: (a.entity as string | null) ?? null,
      actor: ((prof as { nombre?: string } | null)?.nombre) ?? null,
      createdAt: a.created_at as string, meta: (a.meta as Record<string, unknown>) ?? {},
    };
  });

  return { clinic, holidays, users, ncf, treatments, waiting, tokens, audit };
}
