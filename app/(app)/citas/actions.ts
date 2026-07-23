"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { timeToMinutes } from "@/lib/dates";
import { ESTADO_CITA, type CitaEstado } from "./estado-config";

const WRITE_ROLES = ["owner", "recepcionista", "dentista"] as const;
const ACTIVOS: CitaEstado[] = [
  "pendiente",
  "confirmada",
  "sala_espera",
  "en_sillon",
  "seguimiento",
];

export interface CitaFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function s(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

/** Verifica solape con otra cita del mismo odontólogo (misma fecha). */
async function haySolape(
  supabase: ReturnType<typeof createClient>,
  args: {
    dentista: string;
    fecha: string;
    hora: string;
    duracion: number;
    excludeId?: string;
  },
): Promise<boolean> {
  if (!args.dentista) return false;
  const { data } = await supabase
    .from("appointments")
    .select("id, hora, duracion_min, estado")
    .eq("dentista_nombre", args.dentista)
    .eq("fecha", args.fecha)
    .in("estado", ACTIVOS as string[]);

  const inicio = timeToMinutes(args.hora);
  const fin = inicio + args.duracion;
  return (data ?? []).some((r) => {
    if (args.excludeId && (r.id as string) === args.excludeId) return false;
    const rs = timeToMinutes((r.hora as string).slice(0, 5));
    const re = rs + ((r.duracion_min as number) ?? 30);
    return inicio < re && rs < fin; // solapan
  });
}

function parseCita(fd: FormData) {
  return {
    patient_id: s(fd, "patient_id"),
    dentista_nombre: s(fd, "dentista_nombre") || null,
    fecha: s(fd, "fecha"),
    hora: s(fd, "hora"),
    duracion_min: Math.max(10, Math.min(480, parseInt(s(fd, "duracion_min") || "30", 10) || 30)),
    tratamiento: s(fd, "tratamiento"),
    estado: (s(fd, "estado") || "pendiente") as CitaEstado,
    notas: s(fd, "notas") || null,
  };
}

function validarCita(c: ReturnType<typeof parseCita>) {
  const e: Record<string, string> = {};
  if (!/^[0-9a-f-]{36}$/i.test(c.patient_id)) e.patient_id = "Selecciona un paciente.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) e.fecha = "Fecha inválida.";
  if (!/^\d{2}:\d{2}/.test(c.hora)) e.hora = "Hora inválida.";
  if (!c.tratamiento) e.tratamiento = "Indica el tratamiento.";
  if (!ESTADO_CITA[c.estado]) e.estado = "Estado inválido.";
  return e;
}

export async function createAppointment(
  _prev: CitaFormState,
  fd: FormData,
): Promise<CitaFormState> {
  const user = await requireRole([...WRITE_ROLES]);
  const { ok } = rateLimit(`cita-write:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!ok) return { error: "Demasiadas operaciones. Espera un momento." };

  const c = parseCita(fd);
  const fieldErrors = validarCita(c);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = createClient();
  if (c.dentista_nombre && (await haySolape(supabase, {
    dentista: c.dentista_nombre,
    fecha: c.fecha,
    hora: c.hora,
    duracion: c.duracion_min,
  }))) {
    return {
      error: `${c.dentista_nombre} ya tiene una cita que se solapa con ese horario.`,
    };
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: c.patient_id,
      dentista_nombre: c.dentista_nombre,
      fecha: c.fecha,
      hora: c.hora,
      duracion_min: c.duracion_min,
      tratamiento: c.tratamiento,
      estado: c.estado,
      notas: c.notas,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23P01")
      return { error: "Ese horario se solapa con otra cita del odontólogo." };
    return { error: "No se pudo crear la cita. Intenta de nuevo." };
  }

  await logActivity({
    action: `agendó una cita (${c.tratamiento})`,
    entity: "appointment",
    entityId: data.id,
  });
  revalidatePath("/citas");
  return { ok: true };
}

export async function updateAppointment(
  _prev: CitaFormState,
  fd: FormData,
): Promise<CitaFormState> {
  const user = await requireRole([...WRITE_ROLES]);
  const id = s(fd, "id");
  if (!id) return { error: "Cita no identificada." };

  const c = parseCita(fd);
  const fieldErrors = validarCita(c);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = createClient();
  if (c.dentista_nombre && (await haySolape(supabase, {
    dentista: c.dentista_nombre,
    fecha: c.fecha,
    hora: c.hora,
    duracion: c.duracion_min,
    excludeId: id,
  }))) {
    return { error: `${c.dentista_nombre} ya tiene una cita en ese horario.` };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: c.patient_id,
      dentista_nombre: c.dentista_nombre,
      fecha: c.fecha,
      hora: c.hora,
      duracion_min: c.duracion_min,
      tratamiento: c.tratamiento,
      estado: c.estado,
      notas: c.notas,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23P01")
      return { error: "Ese horario se solapa con otra cita del odontólogo." };
    return { error: "No se pudo actualizar la cita." };
  }

  await logActivity({
    action: `actualizó una cita (${c.tratamiento})`,
    entity: "appointment",
    entityId: id,
  });
  revalidatePath("/citas");
  return { ok: true };
}

export async function changeStatus(
  id: string,
  estado: CitaEstado,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  if (!id || !ESTADO_CITA[estado]) return { ok: false, error: "Datos inválidos." };
  const supabase = createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ estado })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };
  await logActivity({
    action: `cambió el estado de una cita a "${ESTADO_CITA[estado].label}"`,
    entity: "appointment",
    entityId: id,
  });
  revalidatePath("/citas");
  return { ok: true };
}

export async function cancelAppointment(
  id: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  const m = motivo.trim();
  if (!id) return { ok: false, error: "Cita no identificada." };
  if (m.length < 3) return { ok: false, error: "Indica el motivo de la cancelación." };
  const supabase = createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ estado: "cancelada", motivo_cancelacion: m.slice(0, 300) })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo cancelar la cita." };
  await logActivity({
    action: `canceló una cita — motivo: ${m.slice(0, 120)}`,
    entity: "appointment",
    entityId: id,
  });
  revalidatePath("/citas");
  return { ok: true };
}

export async function rescheduleAppointment(
  id: string,
  fecha: string,
  hora: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}/.test(hora))
    return { ok: false, error: "Datos inválidos." };

  const supabase = createClient();
  const { data: cur } = await supabase
    .from("appointments")
    .select("dentista_nombre, duracion_min")
    .eq("id", id)
    .single();

  const dentista = (cur?.dentista_nombre as string | null) ?? null;
  const duracion = (cur?.duracion_min as number) ?? 30;

  if (dentista && (await haySolape(supabase, { dentista, fecha, hora, duracion, excludeId: id }))) {
    return { ok: false, error: "Ese horario se solapa con otra cita." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ fecha, hora })
    .eq("id", id);
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Horario solapado." };
    return { ok: false, error: "No se pudo reagendar." };
  }
  await logActivity({
    action: `reagendó una cita para ${fecha} ${hora}`,
    entity: "appointment",
    entityId: id,
  });
  revalidatePath("/citas");
  return { ok: true };
}

export async function quickCreatePatient(
  nombre: string,
  telefono: string,
): Promise<{ id?: string; nombre?: string; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  const n = nombre.trim();
  if (n.length < 3) return { error: "El nombre es muy corto." };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({ nombre: n, telefono: telefono.trim() || null, created_by: user.id })
    .select("id, nombre")
    .single();
  if (error || !data) return { error: "No se pudo crear el paciente." };
  await logActivity({
    action: `creó el paciente ${n} (desde citas)`,
    entity: "patient",
    entityId: data.id,
  });
  revalidatePath("/pacientes");
  return { id: data.id as string, nombre: data.nombre as string };
}
