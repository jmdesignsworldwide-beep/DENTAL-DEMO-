import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CitaEstado } from "@/app/(app)/citas/estado-config";

export interface AppointmentRow {
  id: string;
  patient_id: string;
  paciente: string;
  dentista_nombre: string | null;
  fecha: string;
  hora: string;
  duracion_min: number;
  tratamiento: string;
  estado: CitaEstado;
  notas: string | null;
  motivo_cancelacion: string | null;
}

export interface PatientBasic {
  id: string;
  nombre: string;
  telefono: string | null;
}

function mapRow(r: Record<string, unknown>): AppointmentRow {
  const p = r.patients as { nombre?: string } | { nombre?: string }[] | null;
  const paciente = Array.isArray(p)
    ? p[0]?.nombre ?? "Paciente"
    : p?.nombre ?? "Paciente";
  return {
    id: r.id as string,
    patient_id: r.patient_id as string,
    paciente,
    dentista_nombre: (r.dentista_nombre as string | null) ?? null,
    fecha: r.fecha as string,
    hora: (r.hora as string).slice(0, 5),
    duracion_min: (r.duracion_min as number) ?? 30,
    tratamiento: r.tratamiento as string,
    estado: r.estado as CitaEstado,
    notas: (r.notas as string | null) ?? null,
    motivo_cancelacion: (r.motivo_cancelacion as string | null) ?? null,
  };
}

export async function getAppointmentsRange(
  fromISO: string,
  toISO: string,
  dentista?: string,
): Promise<AppointmentRow[]> {
  try {
    const supabase = createClient();
    let q = supabase
      .from("appointments")
      .select(
        "id, patient_id, dentista_nombre, fecha, hora, duracion_min, tratamiento, estado, notas, motivo_cancelacion, patients(nombre)",
      )
      .gte("fecha", fromISO)
      .lte("fecha", toISO)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true });

    if (dentista) q = q.eq("dentista_nombre", dentista);

    const { data, error } = await q;
    if (error || !data) return [];
    return data.map((r) => mapRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getAppointment(
  id: string,
): Promise<AppointmentRow | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, patient_id, dentista_nombre, fecha, hora, duracion_min, tratamiento, estado, notas, motivo_cancelacion, patients(nombre)",
      )
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function listDentists(): Promise<string[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("appointments")
      .select("dentista_nombre")
      .not("dentista_nombre", "is", null)
      .limit(1000);
    const set = new Set<string>();
    (data ?? []).forEach((r) => {
      const n = (r as { dentista_nombre: string }).dentista_nombre;
      if (n) set.add(n);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  } catch {
    return [];
  }
}

export async function listPatientsBasic(): Promise<PatientBasic[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("patients")
      .select("id, nombre, telefono")
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .limit(500);
    return (data ?? []) as PatientBasic[];
  } catch {
    return [];
  }
}
