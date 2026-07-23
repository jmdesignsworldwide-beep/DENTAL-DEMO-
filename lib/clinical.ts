import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSignedUrl, CLINICAL_FILES_BUCKET } from "@/lib/storage";

export type AttachmentTipo =
  | "foto_antes"
  | "foto_despues"
  | "radiografia"
  | "consentimiento";

export interface Attachment {
  id: string;
  tipo: AttachmentTipo;
  storage_path: string;
  descripcion: string | null;
  url: string | null;
}

export interface ClinicalRecord {
  id: string;
  patient_id: string;
  odontologo_nombre: string | null;
  fecha: string;
  motivo_consulta: string | null;
  diagnostico: string | null;
  tratamiento_realizado: string | null;
  materiales_usados: string | null;
  notas_clinicas: string | null;
  presion_arterial: string | null;
  frecuencia_cardiaca: number | null;
  medicamentos_recetados: string | null;
  proxima_cita_recomendada: string | null;
  firmada: boolean;
  es_enmienda: boolean;
  created_at: string;
  attachments: Attachment[];
}

export async function getPatientRecords(
  patientId: string,
): Promise<ClinicalRecord[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clinical_records")
      .select(
        "id, patient_id, odontologo_nombre, fecha, motivo_consulta, diagnostico, tratamiento_realizado, materiales_usados, notas_clinicas, presion_arterial, frecuencia_cardiaca, medicamentos_recetados, proxima_cita_recomendada, firmada, es_enmienda, created_at, clinical_attachments(id, tipo, storage_path, descripcion)",
      )
      .eq("patient_id", patientId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    const records: ClinicalRecord[] = await Promise.all(
      data.map(async (r) => {
        const rawAtt = ((r as { clinical_attachments?: unknown })
          .clinical_attachments ?? []) as {
          id: string;
          tipo: AttachmentTipo;
          storage_path: string;
          descripcion: string | null;
        }[];
        const attachments: Attachment[] = await Promise.all(
          rawAtt.map(async (a) => ({
            id: a.id,
            tipo: a.tipo,
            storage_path: a.storage_path,
            descripcion: a.descripcion,
            url: await getSignedUrl(CLINICAL_FILES_BUCKET, a.storage_path),
          })),
        );
        return {
          id: r.id as string,
          patient_id: r.patient_id as string,
          odontologo_nombre: (r.odontologo_nombre as string | null) ?? null,
          fecha: r.fecha as string,
          motivo_consulta: (r.motivo_consulta as string | null) ?? null,
          diagnostico: (r.diagnostico as string | null) ?? null,
          tratamiento_realizado: (r.tratamiento_realizado as string | null) ?? null,
          materiales_usados: (r.materiales_usados as string | null) ?? null,
          notas_clinicas: (r.notas_clinicas as string | null) ?? null,
          presion_arterial: (r.presion_arterial as string | null) ?? null,
          frecuencia_cardiaca: (r.frecuencia_cardiaca as number | null) ?? null,
          medicamentos_recetados: (r.medicamentos_recetados as string | null) ?? null,
          proxima_cita_recomendada:
            (r.proxima_cita_recomendada as string | null) ?? null,
          firmada: !!r.firmada,
          es_enmienda: !!r.es_enmienda,
          created_at: r.created_at as string,
          attachments,
        };
      }),
    );
    return records;
  } catch {
    return [];
  }
}
