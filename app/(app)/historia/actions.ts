"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { CLINICAL_FILES_BUCKET } from "@/lib/storage";

const WRITE_ROLES = ["owner", "dentista"] as const;
const MAX_FILE = 10 * 1024 * 1024; // 10 MB
const TIPOS = ["foto_antes", "foto_despues", "radiografia", "consentimiento"];

export interface RecordState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function s(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}
function nn(v: string): string | null {
  return v ? v : null;
}

export async function createRecord(fd: FormData): Promise<RecordState> {
  const user = await requireRole([...WRITE_ROLES]);
  const { ok } = rateLimit(`clinical-write:${user.id}`, {
    limit: 15,
    windowMs: 60_000,
  });
  if (!ok) return { error: "Demasiadas operaciones. Espera un momento." };

  const patient_id = s(fd, "patient_id");
  const fecha = s(fd, "fecha");
  const fieldErrors: Record<string, string> = {};
  if (!/^[0-9a-f-]{36}$/i.test(patient_id)) fieldErrors.patient_id = "Paciente inválido.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fieldErrors.fecha = "Fecha inválida.";
  const motivo = s(fd, "motivo_consulta");
  const diagnostico = s(fd, "diagnostico");
  const tratamiento = s(fd, "tratamiento_realizado");
  if (!motivo && !diagnostico && !tratamiento)
    fieldErrors.motivo_consulta = "Registra al menos motivo, diagnóstico o tratamiento.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const fcRaw = s(fd, "frecuencia_cardiaca");
  const fc = fcRaw ? Math.max(20, Math.min(250, parseInt(fcRaw, 10) || 0)) : null;
  const firmar = s(fd, "firmar") === "true";

  const supabase = createClient();
  const { data: rec, error } = await supabase
    .from("clinical_records")
    .insert({
      patient_id,
      odontologo_nombre: nn(s(fd, "odontologo_nombre")),
      fecha,
      motivo_consulta: nn(motivo),
      diagnostico: nn(diagnostico),
      tratamiento_realizado: nn(tratamiento),
      materiales_usados: nn(s(fd, "materiales_usados")),
      notas_clinicas: nn(s(fd, "notas_clinicas")),
      presion_arterial: nn(s(fd, "presion_arterial")),
      frecuencia_cardiaca: fc,
      medicamentos_recetados: nn(s(fd, "medicamentos_recetados")),
      proxima_cita_recomendada: nn(s(fd, "proxima_cita_recomendada")),
      firmada: firmar,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !rec) return { error: "No se pudo guardar la entrada." };

  // Adjuntos (subida a Storage privado).
  const count = parseInt(s(fd, "fileCount") || "0", 10) || 0;
  for (let i = 0; i < count && i < 12; i++) {
    const file = fd.get(`file_${i}`);
    const tipo = s(fd, `tipo_${i}`);
    if (
      file instanceof File &&
      file.size > 0 &&
      file.size <= MAX_FILE &&
      TIPOS.includes(tipo)
    ) {
      const ext =
        file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${rec.id}/${randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from(CLINICAL_FILES_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (!up.error) {
        await supabase.from("clinical_attachments").insert({
          record_id: rec.id,
          tipo,
          storage_path: path,
          descripcion: nn(s(fd, `desc_${i}`)),
          created_by: user.id,
        });
      }
    }
  }

  await logActivity({
    action: `registró una entrada de historia clínica${firmar ? " (firmada)" : ""}`,
    entity: "patient",
    entityId: patient_id,
  });

  revalidatePath(`/historia/${patient_id}`);
  return { ok: true };
}
