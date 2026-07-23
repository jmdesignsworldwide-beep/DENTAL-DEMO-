"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { toothName } from "@/lib/teeth";
import type { ToothStatus } from "@/lib/odontogram";

const ROLES = ["owner", "dentista", "asistente"] as const;
const ESTADOS: ToothStatus[] = [
  "sano",
  "tratado",
  "caries",
  "extraccion_necesaria",
  "corona",
  "implante",
  "endodoncia",
  "ausente",
];
const SUP = ["M", "D", "V", "L", "O"];

export async function setToothState(
  patientId: string,
  fdi: number,
  estado: ToothStatus,
  superficies: string[],
  nota: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...ROLES]);
  if (!/^[0-9a-f-]{36}$/i.test(patientId) || !Number.isInteger(fdi))
    return { ok: false, error: "Datos inválidos." };
  if (!ESTADOS.includes(estado)) return { ok: false, error: "Estado inválido." };

  const { ok } = rateLimit(`odo-write:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones." };

  const supf = (superficies ?? []).filter((s) => SUP.includes(s)).slice(0, 5);
  const notaClean = (nota ?? "").trim().slice(0, 500) || null;

  const supabase = createClient();
  const { error } = await supabase.from("tooth_states").upsert(
    {
      patient_id: patientId,
      fdi,
      estado,
      superficies: supf,
      nota: notaClean,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id,fdi" },
  );
  if (error) return { ok: false, error: "No se pudo guardar el estado." };

  // Historial inmutable por diente.
  await supabase.from("tooth_events").insert({
    patient_id: patientId,
    fdi,
    estado,
    superficies: supf,
    nota: notaClean,
    created_by: user.id,
  });

  await logActivity({
    action: `actualizó el odontograma — ${toothName(fdi)} (${estado})`,
    entity: "patient",
    entityId: patientId,
  });

  revalidatePath(`/odontograma/${patientId}`);
  return { ok: true };
}

export async function saveSnapshot(
  patientId: string,
  etiqueta: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...ROLES]);
  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return { ok: false, error: "Paciente inválido." };

  const supabase = createClient();
  const { data } = await supabase
    .from("tooth_states")
    .select("fdi, estado, superficies")
    .eq("patient_id", patientId);

  const snapshot = (data ?? []).map((r) => ({
    fdi: r.fdi,
    estado: r.estado,
    superficies: r.superficies ?? [],
  }));

  const { error } = await supabase.from("odontogram_snapshots").insert({
    patient_id: patientId,
    etiqueta: etiqueta.trim().slice(0, 100) || null,
    snapshot,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "No se pudo guardar el snapshot." };

  await logActivity({
    action: "guardó un snapshot del odontograma",
    entity: "patient",
    entityId: patientId,
  });
  revalidatePath(`/odontograma/${patientId}`);
  return { ok: true };
}
