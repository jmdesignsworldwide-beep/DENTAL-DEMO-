"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { scheduleAppointmentReminders } from "@/lib/comm-engine";
import { unknownVariables } from "@/lib/communications";
import {
  confirmByToken,
  requestChangeByToken,
} from "@/lib/confirm";

const WRITE_ROLES = ["owner", "recepcionista", "dentista"] as const;
const UUID = /^[0-9a-f-]{36}$/i;
const CANALES = ["whatsapp", "sms", "email"];

// ─── Despacho de la cola ────────────────────────────────────────────────

/** Marca un mensaje como despachado y lo registra en la bitácora legal. */
export async function markMessageSent(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  const { ok } = rateLimit(`comm-write:${user.id}`, { limit: 120, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones." };
  if (!UUID.test(id)) return { ok: false, error: "Mensaje inválido." };

  const supabase = createClient();
  const { data: msg } = await supabase
    .from("scheduled_messages")
    .select("id, patient_id, cita_id, canal, destinatario, plantilla_clave, cuerpo_renderizado, estado")
    .eq("id", id)
    .single();
  if (!msg) return { ok: false, error: "Mensaje no encontrado." };
  if (msg.estado === "cancelado") return { ok: false, error: "El mensaje fue cancelado." };

  const nowISO = new Date().toISOString();
  const { error } = await supabase
    .from("scheduled_messages")
    .update({ estado: "entregado", enviado_en: nowISO })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo marcar como enviado." };

  await supabase.from("communication_log").insert({
    patient_id: msg.patient_id,
    scheduled_message_id: msg.id,
    cita_id: msg.cita_id,
    canal: msg.canal,
    direccion: "saliente",
    destinatario: msg.destinatario,
    plantilla_clave: msg.plantilla_clave,
    cuerpo: msg.cuerpo_renderizado,
    estado: "entregado",
    usuario_id: user.id,
  });

  await logActivity({
    action: "despachó un recordatorio al paciente",
    entity: "communication",
    entityId: id,
  });
  revalidatePath("/comunicaciones");
  return { ok: true };
}

/** Despacho en lote ("Enviar todos"). Devuelve cuántos se marcaron. */
export async function markManySent(
  ids: string[],
): Promise<{ ok: boolean; enviados: number; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  const { ok } = rateLimit(`comm-bulk:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (!ok) return { ok: false, enviados: 0, error: "Demasiadas operaciones." };

  const valid = (ids ?? []).filter((x) => UUID.test(x)).slice(0, 200);
  let enviados = 0;
  for (const id of valid) {
    const r = await markMessageSent(id);
    if (r.ok) enviados += 1;
  }
  return { ok: true, enviados };
}

export async function cancelMessage(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  if (!UUID.test(id)) return { ok: false, error: "Mensaje inválido." };
  const supabase = createClient();
  const { error } = await supabase
    .from("scheduled_messages")
    .update({ estado: "cancelado" })
    .eq("id", id)
    .eq("estado", "programado");
  if (error) return { ok: false, error: "No se pudo cancelar." };
  void user;
  revalidatePath("/comunicaciones");
  return { ok: true };
}

export async function rescheduleMessage(
  id: string,
  programadoPara: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...WRITE_ROLES]);
  if (!UUID.test(id)) return { ok: false, error: "Mensaje inválido." };
  const when = new Date(programadoPara);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Fecha inválida." };
  const supabase = createClient();
  const { error } = await supabase
    .from("scheduled_messages")
    .update({ programado_para: when.toISOString() })
    .eq("id", id)
    .eq("estado", "programado");
  if (error) return { ok: false, error: "No se pudo reprogramar." };
  revalidatePath("/comunicaciones");
  return { ok: true };
}

// ─── Envío manual ───────────────────────────────────────────────────────

export interface ManualMessage {
  patientId: string;
  plantillaClave: string;
  canal: string;
  destinatario: string;
  cuerpo: string;
  programadoPara?: string;
}

export async function scheduleManualMessage(
  data: ManualMessage,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  const { ok } = rateLimit(`comm-write:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones." };
  if (!UUID.test(data.patientId)) return { ok: false, error: "Paciente inválido." };
  if (!CANALES.includes(data.canal)) return { ok: false, error: "Canal inválido." };
  const cuerpo = (data.cuerpo ?? "").trim();
  if (!cuerpo) return { ok: false, error: "El mensaje está vacío." };
  const destinatario = (data.destinatario ?? "").trim();
  if (!destinatario) return { ok: false, error: "Falta el destinatario." };

  const when = data.programadoPara ? new Date(data.programadoPara) : new Date();
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Fecha inválida." };

  const supabase = createClient();
  const { error } = await supabase.from("scheduled_messages").insert({
    patient_id: data.patientId,
    plantilla_clave: data.plantillaClave || "manual",
    canal: data.canal,
    tipo: "manual",
    destinatario,
    cuerpo_renderizado: cuerpo.slice(0, 1000),
    programado_para: when.toISOString(),
    estado: "programado",
    created_by: user.id,
  });
  if (error) {
    // El trigger de opt-out lo rechaza si el paciente pidió no recibir.
    if (/opt-out|no acepta/i.test(error.message))
      return { ok: false, error: "El paciente optó por no recibir por ese canal." };
    return { ok: false, error: "No se pudo programar el mensaje." };
  }
  await logActivity({ action: "programó un mensaje manual", entity: "communication" });
  revalidatePath("/comunicaciones");
  return { ok: true };
}

/** Dispara manualmente los recordatorios de una cita (motor automático). */
export async function programarRecordatorios(
  citaId: string,
): Promise<{ ok: boolean; creados: number; error?: string }> {
  await requireRole([...WRITE_ROLES]);
  if (!UUID.test(citaId)) return { ok: false, creados: 0, error: "Cita inválida." };
  const creados = await scheduleAppointmentReminders(citaId);
  revalidatePath("/comunicaciones");
  return { ok: creados > 0, creados, error: creados === 0 ? "No se programó nada (¿opt-out o sin teléfono?)." : undefined };
}

// ─── Plantillas ─────────────────────────────────────────────────────────

export async function saveTemplate(
  id: string,
  data: { asunto?: string | null; cuerpo?: string; activa?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["owner"]);
  if (!UUID.test(id)) return { ok: false, error: "Plantilla inválida." };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.cuerpo !== undefined) {
    const cuerpo = data.cuerpo.trim();
    if (!cuerpo) return { ok: false, error: "El cuerpo no puede estar vacío." };
    const unknown = unknownVariables(cuerpo);
    if (unknown.length > 0)
      return { ok: false, error: `Variables no válidas: ${unknown.map((u) => `{${u}}`).join(", ")}` };
    patch.cuerpo = cuerpo.slice(0, 2000);
  }
  if (data.asunto !== undefined) patch.asunto = (data.asunto ?? "").trim().slice(0, 200) || null;
  if (data.activa !== undefined) patch.activa = !!data.activa;

  const supabase = createClient();
  const { error } = await supabase.from("message_templates").update(patch).eq("id", id);
  if (error) return { ok: false, error: "No se pudo guardar la plantilla." };
  await logActivity({ action: "editó una plantilla de comunicación", entity: "template", entityId: id });
  revalidatePath("/comunicaciones");
  return { ok: true };
}

// ─── Preferencias / opt-out ─────────────────────────────────────────────

export async function savePatientPrefs(
  patientId: string,
  data: {
    acepta_whatsapp?: boolean;
    acepta_sms?: boolean;
    acepta_email?: boolean;
    horario_preferido?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...WRITE_ROLES]);
  if (!UUID.test(patientId)) return { ok: false, error: "Paciente inválido." };
  const horarios = ["mañana", "tarde", "cualquiera"];
  const supabase = createClient();
  const { error } = await supabase.from("patient_communication_prefs").upsert(
    {
      patient_id: patientId,
      ...(data.acepta_whatsapp !== undefined ? { acepta_whatsapp: data.acepta_whatsapp } : {}),
      ...(data.acepta_sms !== undefined ? { acepta_sms: data.acepta_sms } : {}),
      ...(data.acepta_email !== undefined ? { acepta_email: data.acepta_email } : {}),
      ...(data.horario_preferido && horarios.includes(data.horario_preferido)
        ? { horario_preferido: data.horario_preferido }
        : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id" },
  );
  if (error) return { ok: false, error: "No se pudieron guardar las preferencias." };
  revalidatePath("/comunicaciones");
  return { ok: true };
}

export async function setOptOut(
  patientId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...WRITE_ROLES]);
  if (!UUID.test(patientId)) return { ok: false, error: "Paciente inválido." };
  const supabase = createClient();
  const { error } = await supabase.from("patient_communication_prefs").upsert(
    {
      patient_id: patientId,
      acepta_whatsapp: false,
      acepta_sms: false,
      acepta_email: false,
      opt_out_fecha: new Date().toISOString(),
      opt_out_motivo: (motivo ?? "").trim().slice(0, 300) || "Solicitud del paciente.",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id" },
  );
  if (error) return { ok: false, error: "No se pudo registrar el opt-out." };
  await logActivity({ action: "registró opt-out de comunicación de un paciente", entity: "patient", entityId: patientId });
  revalidatePath("/comunicaciones");
  return { ok: true };
}

export async function clearOptOut(
  patientId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...WRITE_ROLES]);
  if (!UUID.test(patientId)) return { ok: false, error: "Paciente inválido." };
  const supabase = createClient();
  const { error } = await supabase
    .from("patient_communication_prefs")
    .update({
      acepta_whatsapp: true,
      acepta_sms: true,
      acepta_email: true,
      opt_out_fecha: null,
      opt_out_motivo: null,
      updated_at: new Date().toISOString(),
    })
    .eq("patient_id", patientId);
  if (error) return { ok: false, error: "No se pudo reactivar." };
  revalidatePath("/comunicaciones");
  return { ok: true };
}

// ─── Acciones del paciente (sin login, autenticadas por token) ──────────

export async function confirmAppointment(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const { ok } = rateLimit(`confirm:${token.slice(0, 40)}`, { limit: 10, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiados intentos. Espera un momento." };
  const res = await confirmByToken(token);
  if (res.ok) {
    revalidatePath("/citas");
    revalidatePath("/sala-espera");
  }
  return res;
}

export async function requestChange(
  token: string,
  mensaje: string,
): Promise<{ ok: boolean; error?: string }> {
  const { ok } = rateLimit(`confirm:${token.slice(0, 40)}`, { limit: 10, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiados intentos. Espera un momento." };
  return requestChangeByToken(token, mensaje);
}
