import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Confirmación de cita SIN login. Igual que el kiosco de sala de espera
 * (Tanda 12): un token aleatorio en DB, validado en el servidor con el
 * cliente admin (service_role hace bypass de RLS). El token nunca es un id
 * adivinable y expira. La tabla `appointment_confirmations` no tiene
 * políticas → ningún usuario autenticado la toca directo.
 */

export interface ConfirmView {
  token: string;
  estado: "pendiente" | "confirmada" | "cambio_solicitado";
  expirado: boolean;
  cita: {
    fecha: string;
    hora: string;
    dentista: string | null;
    tratamiento: string;
    estado_cita: string;
  } | null;
  paciente: string;
  mensaje_cambio: string | null;
}

function isValidToken(t: string): boolean {
  return typeof t === "string" && t.length >= 8 && t.length <= 120 && /^[A-Za-z0-9_-]+$/.test(t);
}

/** Lee la confirmación por token (para pintar la página del paciente). */
export async function getConfirmView(token: string): Promise<ConfirmView | null> {
  if (!isValidToken(token)) return null;
  try {
    const admin = createAdminClient();
    const { data: conf } = await admin
      .from("appointment_confirmations")
      .select("token, estado, expira_at, mensaje_cambio, cita_id, patient_id")
      .eq("token", token)
      .maybeSingle();
    if (!conf) return null;

    const [{ data: cita }, { data: pac }] = await Promise.all([
      admin
        .from("appointments")
        .select("fecha, hora, dentista_nombre, tratamiento, estado")
        .eq("id", conf.cita_id)
        .maybeSingle(),
      admin.from("patients").select("nombre").eq("id", conf.patient_id).maybeSingle(),
    ]);

    return {
      token: conf.token as string,
      estado: conf.estado as ConfirmView["estado"],
      expirado: new Date(conf.expira_at as string).getTime() < Date.now(),
      cita: cita
        ? {
            fecha: cita.fecha as string,
            hora: (cita.hora as string).slice(0, 5),
            dentista: (cita.dentista_nombre as string | null) ?? null,
            tratamiento: cita.tratamiento as string,
            estado_cita: cita.estado as string,
          }
        : null,
      paciente: (pac?.nombre as string) ?? "Paciente",
      mensaje_cambio: (conf.mensaje_cambio as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Confirma la cita (estado='confirmada') y avisa al personal. */
export async function confirmByToken(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidToken(token)) return { ok: false, error: "Enlace inválido." };
  try {
    const admin = createAdminClient();
    const { data: conf } = await admin
      .from("appointment_confirmations")
      .select("id, estado, expira_at, cita_id, patient_id")
      .eq("token", token)
      .maybeSingle();
    if (!conf) return { ok: false, error: "Enlace no encontrado." };
    if (new Date(conf.expira_at as string).getTime() < Date.now())
      return { ok: false, error: "El enlace expiró." };
    if (conf.estado === "confirmada") return { ok: true };

    const nowISO = new Date().toISOString();
    await admin
      .from("appointments")
      .update({ estado: "confirmada" })
      .eq("id", conf.cita_id)
      .in("estado", ["pendiente", "confirmada"]);
    await admin
      .from("appointment_confirmations")
      .update({ estado: "confirmada", respondido_at: nowISO })
      .eq("id", conf.id);

    const { data: pac } = await admin
      .from("patients")
      .select("nombre")
      .eq("id", conf.patient_id)
      .maybeSingle();

    await admin.from("notifications").insert({
      tipo: "cita_confirmada",
      prioridad: "media",
      titulo: `${(pac?.nombre as string) ?? "Un paciente"} confirmó su cita`,
      cuerpo: "El paciente confirmó su asistencia desde el recordatorio.",
      entity: "appointment",
      entity_id: conf.cita_id,
      meta: { via: "recordatorio" },
    });
    await admin.from("communication_log").insert({
      patient_id: conf.patient_id,
      cita_id: conf.cita_id,
      canal: "whatsapp",
      direccion: "entrante",
      cuerpo: "CONFIRMO (confirmó su cita desde el enlace)",
      estado: "respondido",
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo confirmar. Intenta de nuevo." };
  }
}

/** El paciente pide reprogramar; queda registrado y el personal se entera. */
export async function requestChangeByToken(
  token: string,
  mensaje: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidToken(token)) return { ok: false, error: "Enlace inválido." };
  try {
    const admin = createAdminClient();
    const { data: conf } = await admin
      .from("appointment_confirmations")
      .select("id, expira_at, cita_id, patient_id")
      .eq("token", token)
      .maybeSingle();
    if (!conf) return { ok: false, error: "Enlace no encontrado." };
    if (new Date(conf.expira_at as string).getTime() < Date.now())
      return { ok: false, error: "El enlace expiró." };

    const msg = (mensaje ?? "").trim().slice(0, 300);
    await admin
      .from("appointment_confirmations")
      .update({
        estado: "cambio_solicitado",
        respondido_at: new Date().toISOString(),
        mensaje_cambio: msg || null,
      })
      .eq("id", conf.id);

    const { data: pac } = await admin
      .from("patients")
      .select("nombre")
      .eq("id", conf.patient_id)
      .maybeSingle();

    await admin.from("notifications").insert({
      tipo: "cambio_solicitado",
      prioridad: "alta",
      titulo: `${(pac?.nombre as string) ?? "Un paciente"} pide reprogramar`,
      cuerpo: msg || "El paciente solicitó cambiar su cita.",
      entity: "appointment",
      entity_id: conf.cita_id,
      meta: { via: "recordatorio" },
    });
    await admin.from("communication_log").insert({
      patient_id: conf.patient_id,
      cita_id: conf.cita_id,
      canal: "whatsapp",
      direccion: "entrante",
      cuerpo: `CAMBIAR — ${msg || "solicitó reprogramar"}`,
      estado: "respondido",
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo registrar. Intenta de nuevo." };
  }
}
