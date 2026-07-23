import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { fmtHora12 } from "@/lib/dates";

export interface ColaItem {
  id: string;
  display: string;
  hora: string;
  estado: string;
  esperaMin: number;
}
export interface WaitingScreen {
  clinic: {
    nombre: string;
    eslogan: string | null;
    mensajeBienvenida: string | null;
    colorAcento: string;
    consultorios: number;
    mostrarFoto: boolean;
  };
  emergency: { message: string; severity: "warning" | "danger" } | null;
  content: { tipo: string; titulo: string; cuerpo: string }[];
  enTurno: { display: string; hora: string; consultorio: number | null; fotoUrl: string | null } | null;
  siguiente: { display: string; hora: string } | null;
  cola: ColaItem[];
  abierto: boolean;
  proximaApertura: string;
  horaApertura: string;
}

const HHMM = (t: string) => t.slice(0, 5);

function displayName(nombre: string, inicial: boolean): string {
  const parts = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "Paciente";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const apellido = inicial ? (last ? last[0] + "." : "") : last;
  return `${first} ${apellido}`.trim();
}

function hashNum(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % mod) + 1;
}

export async function validateScreenToken(token: string): Promise<boolean> {
  if (!token || token.length > 120) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("screen_tokens")
      .select("id")
      .eq("token", token)
      .eq("activo", true)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

async function buildScreen(supabase: SupabaseClient): Promise<WaitingScreen | null> {
  const today = new Date().toISOString().slice(0, 10);

  const [setRes, contentRes, aptRes] = await Promise.all([
    supabase.from("clinic_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("waiting_room_content")
      .select("tipo, titulo, cuerpo")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, hora, duracion_min, estado, dentista_nombre, patients(nombre, foto_path)")
      .eq("fecha", today)
      .order("hora", { ascending: true }),
  ]);

  const s = (setRes.data ?? {}) as Record<string, unknown>;
  const nombre = (s.nombre as string) ?? "Clínica Dental";
  const inicial = !!s.apellido_inicial;
  const mostrarFoto = !!s.mostrar_foto;
  const consultorios = Number(s.consultorios ?? 1);
  const apertura = (s.hora_apertura as string) ?? "08:00";
  const cierre = (s.hora_cierre as string) ?? "18:00";

  const patName = (p: unknown): { nombre: string; foto: string | null } => {
    const o = Array.isArray(p) ? p[0] : p;
    return { nombre: (o?.nombre as string) ?? "Paciente", foto: (o?.foto_path as string | null) ?? null };
  };

  type Row = {
    id: string; hora: string; duracion_min: number; estado: string;
    dentista_nombre: string | null; patients: unknown;
  };
  const rows = (aptRes.data ?? []) as unknown as Row[];

  const enTurnoRow = rows.find((r) => r.estado === "en_sillon") ?? null;
  const colaRows = rows.filter((r) => ["sala_espera", "confirmada", "pendiente"].includes(r.estado));

  let acc = enTurnoRow ? Number(enTurnoRow.duracion_min) : 0;
  const cola: ColaItem[] = colaRows.map((r) => {
    const espera = acc;
    acc += Number(r.duracion_min);
    return {
      id: r.id,
      display: displayName(patName(r.patients).nombre, inicial),
      hora: HHMM(r.hora),
      estado: r.estado,
      esperaMin: espera,
    };
  });

  let fotoUrl: string | null = null;
  if (enTurnoRow && mostrarFoto) {
    const foto = patName(enTurnoRow.patients).foto;
    if (foto) {
      try {
        const { data } = await supabase.storage.from("patient-photos").createSignedUrl(foto, 300);
        fotoUrl = data?.signedUrl ?? null;
      } catch {
        fotoUrl = null;
      }
    }
  }

  const enTurno = enTurnoRow
    ? {
        display: displayName(patName(enTurnoRow.patients).nombre, inicial),
        hora: HHMM(enTurnoRow.hora),
        consultorio: consultorios > 1 ? hashNum(enTurnoRow.dentista_nombre ?? enTurnoRow.id, consultorios) : null,
        fotoUrl,
      }
    : null;

  // Horario en tiempo de RD (UTC-4).
  const rd = new Date(Date.now() - 4 * 3600 * 1000);
  const dow = rd.getUTCDay();
  const nowMin = rd.getUTCHours() * 60 + rd.getUTCMinutes();
  const aMin = Number(apertura.slice(0, 2)) * 60 + Number(apertura.slice(3, 5));
  const cMin = Number(cierre.slice(0, 2)) * 60 + Number(cierre.slice(3, 5));
  const abierto = dow !== 0 && nowMin >= aMin && nowMin < cMin;

  const cuando =
    dow === 0 ? "hoy" : dow === 6 && nowMin >= cMin ? "el lunes" : nowMin < aMin ? "hoy" : "mañana";
  const proximaApertura = `La clínica abre ${cuando} a las ${fmtHora12(apertura)}`;

  return {
    clinic: {
      nombre,
      eslogan: (s.eslogan as string | null) ?? null,
      mensajeBienvenida: (s.mensaje_bienvenida as string | null) ?? null,
      colorAcento: (s.color_acento as string) ?? "#0066CC",
      consultorios,
      mostrarFoto,
    },
    emergency: s.emergency_active
      ? {
          message: (s.emergency_message as string) || "Atención",
          severity: ((s.emergency_severity as string) === "danger" ? "danger" : "warning"),
        }
      : null,
    content: (contentRes.data ?? []) as WaitingScreen["content"],
    enTurno,
    siguiente: cola[0] ? { display: cola[0].display, hora: cola[0].hora } : null,
    cola,
    abierto,
    proximaApertura,
    horaApertura: fmtHora12(apertura),
  };
}

/** Kiosco por token: usa cliente admin (sin sesión). Devuelve solo lo mínimo. */
export async function getWaitingScreenByToken(): Promise<WaitingScreen | null> {
  try {
    return await buildScreen(createAdminClient());
  } catch {
    return null;
  }
}

/** Vista por sesión de personal: respeta RLS del usuario. */
export async function getWaitingScreenBySession(): Promise<WaitingScreen | null> {
  try {
    return await buildScreen(createServerClient() as unknown as SupabaseClient);
  } catch {
    return null;
  }
}
