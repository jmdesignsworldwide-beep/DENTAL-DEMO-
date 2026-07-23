"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { PATIENT_PHOTOS_BUCKET } from "@/lib/storage";
import {
  validarPaciente,
  type FieldErrors,
  type PatientInput,
} from "@/lib/validation";

const WRITE_ROLES = ["owner", "recepcionista", "dentista"] as const;
const MAX_PHOTO = 5 * 1024 * 1024; // 5 MB

export interface PatientFormState {
  errors?: FieldErrors;
  formError?: string;
}

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

function parseForm(fd: FormData): PatientInput {
  return {
    nombre: str(fd, "nombre"),
    cedula: str(fd, "cedula"),
    fecha_nacimiento: str(fd, "fecha_nacimiento"),
    telefono: str(fd, "telefono"),
    email: str(fd, "email"),
    direccion: str(fd, "direccion"),
    tipo_sangre: str(fd, "tipo_sangre"),
    alergias: str(fd, "alergias"),
    medicamentos: str(fd, "medicamentos"),
    condiciones: str(fd, "condiciones"),
    seguro: str(fd, "seguro"),
    poliza: str(fd, "poliza"),
    contacto_emergencia_nombre: str(fd, "contacto_emergencia_nombre"),
    contacto_emergencia_telefono: str(fd, "contacto_emergencia_telefono"),
    es_vip: fd.get("es_vip") === "on" || fd.get("es_vip") === "true",
    notas: str(fd, "notas"),
  };
}

/** Normaliza a null los strings vacíos para no ensuciar la DB. */
function nn(v: string): string | null {
  return v ? v : null;
}

function toRow(input: PatientInput) {
  return {
    nombre: input.nombre,
    cedula: nn(input.cedula.replace(/\D/g, "").length ? input.cedula : ""),
    fecha_nacimiento: nn(input.fecha_nacimiento),
    telefono: nn(input.telefono),
    email: nn(input.email),
    direccion: nn(input.direccion),
    tipo_sangre: nn(input.tipo_sangre),
    alergias: nn(input.alergias),
    medicamentos: nn(input.medicamentos),
    condiciones: nn(input.condiciones),
    seguro: nn(input.seguro),
    poliza: nn(input.poliza),
    contacto_emergencia_nombre: nn(input.contacto_emergencia_nombre),
    contacto_emergencia_telefono: nn(input.contacto_emergencia_telefono),
    es_vip: input.es_vip,
    notas: nn(input.notas),
  };
}

async function uploadPhoto(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  file: File,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PHOTO) return null;
  if (!file.type.startsWith("image/")) return null;
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${patientId}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PATIENT_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return null;
  return path;
}

export async function createPatient(
  _prev: PatientFormState,
  fd: FormData,
): Promise<PatientFormState> {
  const user = await requireRole([...WRITE_ROLES]);

  const { ok } = rateLimit(`patient-write:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!ok) return { formError: "Demasiadas operaciones. Espera un momento." };

  const input = parseForm(fd);
  const errors = validarPaciente(input);
  if (Object.keys(errors).length) return { errors };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({ ...toRow(input), created_by: user.id })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505")
      return { errors: { cedula: "Ya existe un paciente con esa cédula." } };
    return { formError: "No se pudo guardar el paciente. Intenta de nuevo." };
  }

  const foto = fd.get("foto");
  if (foto instanceof File && foto.size > 0) {
    const path = await uploadPhoto(supabase, data.id, foto);
    if (path)
      await supabase.from("patients").update({ foto_path: path }).eq("id", data.id);
  }

  await logActivity({
    action: `creó el paciente ${input.nombre}`,
    entity: "patient",
    entityId: data.id,
  });

  revalidatePath("/pacientes");
  redirect(`/pacientes/${data.id}`);
}

export async function updatePatient(
  _prev: PatientFormState,
  fd: FormData,
): Promise<PatientFormState> {
  const user = await requireRole([...WRITE_ROLES]);
  const id = str(fd, "id");
  if (!id) return { formError: "Paciente no identificado." };

  const { ok } = rateLimit(`patient-write:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!ok) return { formError: "Demasiadas operaciones. Espera un momento." };

  const input = parseForm(fd);
  const errors = validarPaciente(input);
  if (Object.keys(errors).length) return { errors };

  const supabase = createClient();

  const foto = fd.get("foto");
  let foto_path: string | undefined;
  if (foto instanceof File && foto.size > 0) {
    const path = await uploadPhoto(supabase, id, foto);
    if (path) foto_path = path;
  }

  const { error } = await supabase
    .from("patients")
    .update({ ...toRow(input), ...(foto_path ? { foto_path } : {}) })
    .eq("id", id);

  if (error) {
    if (error.code === "23505")
      return { errors: { cedula: "Ya existe un paciente con esa cédula." } };
    return { formError: "No se pudo actualizar el paciente." };
  }

  await logActivity({
    action: `actualizó el paciente ${input.nombre}`,
    entity: "patient",
    entityId: id,
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${id}`);
  redirect(`/pacientes/${id}`);
}

export async function setPatientActivo(id: string, activo: boolean) {
  const user = await requireRole([...WRITE_ROLES]);
  if (!id) return;
  const supabase = createClient();
  const { data } = await supabase
    .from("patients")
    .update({ activo })
    .eq("id", id)
    .select("nombre")
    .single();

  await logActivity({
    action: `${activo ? "reactivó" : "desactivó"} el paciente ${data?.nombre ?? ""}`.trim(),
    entity: "patient",
    entityId: id,
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${id}`);
}
