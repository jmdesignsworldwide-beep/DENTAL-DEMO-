"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";

const MOVE_ROLES = ["owner", "recepcionista", "asistente"] as const;
const EDIT_ROLES = ["owner", "recepcionista"] as const;

export async function registerMovement(
  materialId: string,
  tipo: "entrada" | "salida",
  cantidad: number,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...MOVE_ROLES]);
  if (!/^[0-9a-f-]{36}$/i.test(materialId)) return { ok: false, error: "Material inválido." };
  if (tipo !== "entrada" && tipo !== "salida") return { ok: false, error: "Tipo inválido." };
  const c = Math.round((Number(cantidad) || 0) * 100) / 100;
  if (c <= 0) return { ok: false, error: "La cantidad debe ser mayor que cero." };

  const { ok } = rateLimit(`inv-write:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones." };

  const supabase = createClient();
  const { data: mat } = await supabase
    .from("materials")
    .select("stock_actual, nombre")
    .eq("id", materialId)
    .single();
  if (!mat) return { ok: false, error: "Material no encontrado." };

  const actual = Number(mat.stock_actual);
  const nuevo = tipo === "entrada" ? actual + c : Math.max(0, actual - c);

  const { error: movErr } = await supabase.from("material_movements").insert({
    material_id: materialId,
    tipo,
    cantidad: c,
    motivo: (motivo ?? "").trim().slice(0, 200) || null,
    created_by: user.id,
  });
  if (movErr) return { ok: false, error: "No se pudo registrar el movimiento." };

  await supabase
    .from("materials")
    .update({
      stock_actual: nuevo,
      updated_at: new Date().toISOString(),
      ...(tipo === "entrada" ? { ultima_reposicion: new Date().toISOString().slice(0, 10) } : {}),
    })
    .eq("id", materialId);

  await logActivity({
    action: `registró ${tipo} de ${c} en ${mat.nombre}`,
    entity: "material",
    entityId: materialId,
  });
  revalidatePath("/inventario");
  return { ok: true };
}

export async function updateMaterial(
  materialId: string,
  stockMinimo: number,
  costo: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...EDIT_ROLES]);
  if (!/^[0-9a-f-]{36}$/i.test(materialId)) return { ok: false, error: "Material inválido." };
  const min = Math.max(0, Math.round((Number(stockMinimo) || 0) * 100) / 100);
  const cost = Math.max(0, Math.round((Number(costo) || 0) * 100) / 100);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("materials")
    .update({ stock_minimo: min, costo_unitario: cost, updated_at: new Date().toISOString() })
    .eq("id", materialId)
    .select("nombre")
    .single();
  if (error) return { ok: false, error: "No se pudo actualizar." };

  await logActivity({
    action: `actualizó el material ${data?.nombre ?? ""}`.trim(),
    entity: "material",
    entityId: materialId,
  });
  revalidatePath("/inventario");
  return { ok: true };
}
