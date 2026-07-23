"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { CATEGORIAS_ORDEN, type Categoria } from "./categoria-config";

export interface TreatmentInput {
  nombre: string;
  descripcion: string;
  categoria: Categoria;
  duracion_min: number;
  precio: number;
}

function validate(input: TreatmentInput): string | null {
  if (!input.nombre || input.nombre.trim().length < 3) return "El nombre es requerido.";
  if (!CATEGORIAS_ORDEN.includes(input.categoria)) return "Categoría inválida.";
  if (!(input.precio >= 0)) return "Precio inválido.";
  if (!(input.duracion_min >= 5 && input.duracion_min <= 600)) return "Duración inválida.";
  return null;
}

function clean(input: TreatmentInput) {
  return {
    nombre: input.nombre.trim().slice(0, 120),
    descripcion: input.descripcion.trim().slice(0, 400) || null,
    categoria: input.categoria,
    duracion_min: Math.round(input.duracion_min),
    precio: Math.round(input.precio * 100) / 100,
  };
}

export async function createTreatment(
  input: TreatmentInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["owner"]);
  const { ok } = rateLimit(`treat-write:${user.id}`, { limit: 40, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones." };
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("treatments")
    .insert({ ...clean(input), created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo crear el tratamiento." };

  await logActivity({
    action: `creó el tratamiento ${input.nombre.trim()}`,
    entity: "treatment",
    entityId: data.id as string,
  });
  revalidatePath("/tratamientos");
  return { ok: true };
}

export async function updateTreatment(
  id: string,
  input: TreatmentInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["owner"]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Tratamiento inválido." };
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const supabase = createClient();
  const { error } = await supabase
    .from("treatments")
    .update({ ...clean(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar." };

  await logActivity({
    action: `actualizó el tratamiento ${input.nombre.trim()}`,
    entity: "treatment",
    entityId: id,
  });
  revalidatePath("/tratamientos");
  return { ok: true };
}

export async function setTreatmentActivo(
  id: string,
  activo: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["owner"]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Tratamiento inválido." };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("treatments")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("nombre")
    .single();
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };

  await logActivity({
    action: `${activo ? "activó" : "desactivó"} el tratamiento ${data?.nombre ?? ""}`.trim(),
    entity: "treatment",
    entityId: id,
  });
  revalidatePath("/tratamientos");
  return { ok: true };
}
