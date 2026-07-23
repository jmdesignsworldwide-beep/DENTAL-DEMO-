"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export async function setEmergency(
  active: boolean,
  message: string,
  severity: "warning" | "danger",
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["owner", "recepcionista"]);
  const sev = severity === "danger" ? "danger" : "warning";
  const msg = (message ?? "").trim().slice(0, 200);
  if (active && msg.length < 3) return { ok: false, error: "Escribe el mensaje de emergencia." };

  const supabase = createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({
      emergency_active: active,
      emergency_message: active ? msg : null,
      emergency_severity: sev,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, error: "No se pudo actualizar." };

  await logActivity({
    action: active ? `activó el modo emergencia en sala: ${msg}` : "desactivó el modo emergencia en sala",
    entity: "clinic",
  });
  revalidatePath("/sala-espera");
  return { ok: true };
}
