import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTemplate } from "@/lib/communications";
import { formatDateLong } from "@/lib/utils";

/**
 * ─── Motor de programación automática ─────────────────────────────────
 *
 * Cuando ocurre un evento (cita creada, tratamiento completado, presupuesto
 * sin respuesta…), el sistema programa el mensaje SOLO. Toda la lógica vive
 * en el servidor. Nunca programa fuera del horario de la clínica.
 *
 * Aquí está el evento de mayor impacto — "cita creada" — que dispara la
 * confirmación + recordatorio 24h + recordatorio 2h. Es la palanca directa
 * contra el no-show. Los demás eventos reutilizan `scheduleFromTemplate`.
 */

const CLINICA = {
  nombre: "Clínica Dental",
  telefono: "809-555-0100",
  direccion: "Av. Winston Churchill #90, Santo Domingo",
};

/** Ventana de envío de la clínica (defensivo: nunca de madrugada). */
const HORA_MIN = 9;
const HORA_MAX = 18;

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  );
}

function to12h(hhmm: string): string {
  const [hStr, m] = hhmm.slice(0, 5).split(":");
  let h = parseInt(hStr, 10);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

/** Clampa una fecha/hora de envío a la ventana de la clínica. */
function clampToClinicHours(d: Date): Date {
  const out = new Date(d);
  if (out.getHours() < HORA_MIN) out.setHours(HORA_MIN, 0, 0, 0);
  if (out.getHours() >= HORA_MAX) out.setHours(HORA_MAX - 1, 0, 0, 0);
  return out;
}

function firstName(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

interface Vars {
  paciente: string;
  primer_nombre: string;
  fecha: string;
  hora: string;
  odontólogo: string;
  tratamiento: string;
  clínica: string;
  teléfono_clínica: string;
  dirección: string;
  monto: string;
  consultorio: string;
}

function buildVars(over: Partial<Vars>): Record<string, string> {
  return {
    paciente: "",
    primer_nombre: "",
    fecha: "",
    hora: "",
    odontólogo: "",
    tratamiento: "",
    clínica: CLINICA.nombre,
    "teléfono_clínica": CLINICA.telefono,
    dirección: CLINICA.direccion,
    monto: "",
    consultorio: "",
    ...over,
  };
}

/**
 * Programa (o intenta programar) un mensaje. Si el paciente hizo opt-out, el
 * trigger de la DB lo rechaza y aquí lo tratamos como "omitido" — el opt-out
 * se respeta a nivel base de datos, no solo en la app.
 */
async function insertScheduled(row: Record<string, unknown>): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("scheduled_messages").insert(row);
  return !error;
}

/** Crea (con cliente admin) un token de confirmación para la cita. */
async function ensureConfirmToken(citaId: string, patientId: string, fecha: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("appointment_confirmations")
      .select("token")
      .eq("cita_id", citaId)
      .maybeSingle();
    if (existing?.token) return existing.token as string;

    const token = `cfm_${citaId.replace(/-/g, "")}`;
    const expira = new Date(`${fecha}T23:59:00`);
    const { error } = await admin.from("appointment_confirmations").insert({
      cita_id: citaId,
      patient_id: patientId,
      token,
      estado: "pendiente",
      expira_at: expira.toISOString(),
    });
    return error ? null : token;
  } catch {
    return null;
  }
}

/**
 * Evento "cita creada": confirmación inmediata + recordatorio 24h + 2h.
 * Best-effort: cualquier fallo (opt-out, plantilla ausente) se omite sin
 * romper la creación de la cita.
 */
export async function scheduleAppointmentReminders(citaId: string): Promise<number> {
  try {
    const supabase = createClient();
    const { data: cita } = await supabase
      .from("appointments")
      .select("id, patient_id, dentista_nombre, fecha, hora, tratamiento, patients(nombre, telefono)")
      .eq("id", citaId)
      .maybeSingle();
    if (!cita || !cita.fecha) return 0;

    const pac = cita.patients as { nombre?: string; telefono?: string | null } | { nombre?: string; telefono?: string | null }[] | null;
    const pacObj = Array.isArray(pac) ? pac[0] : pac;
    const nombre = pacObj?.nombre ?? "Paciente";
    const telefono = pacObj?.telefono ?? null;
    if (!telefono) return 0;

    const { data: tpls } = await supabase
      .from("message_templates")
      .select("clave, canal, cuerpo, asunto")
      .in("clave", ["confirmacion_cita", "recordatorio_24h", "recordatorio_2h"])
      .eq("activa", true);
    const byClave = new Map((tpls ?? []).map((t) => [t.clave as string, t]));

    const fechaISO = cita.fecha as string;
    const horaStr = (cita.hora as string).slice(0, 5);
    const vars = buildVars({
      paciente: nombre,
      primer_nombre: firstName(nombre),
      fecha: formatDateLong(fechaISO),
      hora: to12h(horaStr),
      "odontólogo": (cita.dentista_nombre as string | null) ?? "su odontólogo",
      tratamiento: (cita.tratamiento as string) ?? "su tratamiento",
    });

    const token = await ensureConfirmToken(citaId, cita.patient_id as string, fechaISO);
    const link = token && baseUrl() ? `\n\nConfirme aquí: ${baseUrl()}/confirmar/${token}` : "";

    const now = new Date();
    const citaDate = new Date(`${fechaISO}T${horaStr}:00`);

    const plan: { clave: string; cuando: Date; tipo: string; conLink: boolean }[] = [
      { clave: "confirmacion_cita", cuando: now, tipo: "confirmacion_cita", conLink: false },
      {
        clave: "recordatorio_24h",
        cuando: clampToClinicHours(new Date(citaDate.getTime() - 24 * 3600_000)),
        tipo: "recordatorio_24h",
        conLink: true,
      },
      {
        clave: "recordatorio_2h",
        cuando: new Date(citaDate.getTime() - 2 * 3600_000),
        tipo: "recordatorio_2h",
        conLink: true,
      },
    ];

    let creados = 0;
    for (const p of plan) {
      const tpl = byClave.get(p.clave);
      if (!tpl) continue;
      // No programar en el pasado: si ya pasó, se despacha "ahora".
      const cuando = p.cuando.getTime() < now.getTime() ? now : p.cuando;
      const cuerpo = renderTemplate(tpl.cuerpo as string, vars) + (p.conLink ? link : "");
      const ok = await insertScheduled({
        patient_id: cita.patient_id,
        cita_id: citaId,
        plantilla_clave: p.clave,
        canal: (tpl.canal as string) ?? "whatsapp",
        tipo: p.tipo,
        destinatario: telefono,
        cuerpo_renderizado: cuerpo,
        programado_para: cuando.toISOString(),
        estado: "programado",
      });
      if (ok) creados += 1;
    }
    return creados;
  } catch {
    return 0;
  }
}
