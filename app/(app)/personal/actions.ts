"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export async function markPayrollPaid(
  staffId: string,
  mes: string,
  neto: number,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["owner"]);

  if (!/^[0-9a-f-]{36}$/i.test(staffId)) return { ok: false, error: "Empleado inválido." };
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, error: "Período inválido." };
  const monto = Number.isFinite(neto) ? Math.round(neto * 100) / 100 : 0;

  const supabase = createClient();
  const { error } = await supabase.from("payroll_status").upsert(
    {
      staff_id: staffId,
      periodo: `mensual:${mes}`,
      estado: "pagada",
      monto_neto: monto,
      pagada_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "staff_id,periodo" },
  );
  if (error) return { ok: false, error: "No se pudo registrar el pago." };

  await logActivity({ action: "registró el pago de nómina de un empleado", entity: "staff" });
  revalidatePath("/personal");
  return { ok: true };
}
