"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

type Res = { ok: boolean; error?: string };
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const clean = (s: unknown, max = 200) => String(s ?? "").trim().slice(0, max);

async function updateClinic(patch: Record<string, unknown>): Promise<Res> {
  const supabase = createClient();
  const { error } = await supabase
    .from("clinic_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
  return error ? { ok: false, error: "No se pudo guardar." } : { ok: true };
}

export async function saveIdentity(input: {
  nombre: string; eslogan: string; direccion: string; telefono: string;
  email: string; rnc: string; sitioWeb: string; colorAcento: string;
  redes: Record<string, string>;
}): Promise<Res> {
  await requireRole(["owner"]);
  if (clean(input.nombre).length < 2) return { ok: false, error: "El nombre es obligatorio." };
  const color = /^#[0-9a-fA-F]{6}$/.test(input.colorAcento) ? input.colorAcento : "#0066CC";
  const res = await updateClinic({
    nombre: clean(input.nombre, 80), eslogan: clean(input.eslogan, 120),
    direccion: clean(input.direccion), telefono: clean(input.telefono, 40),
    email: clean(input.email, 120), rnc: clean(input.rnc, 40),
    sitio_web: clean(input.sitioWeb, 120), color_acento: color, redes: input.redes ?? {},
  });
  if (res.ok) { await logActivity({ action: "actualizó la identidad de la clínica", entity: "clinic" }); revalidatePath("/configuracion"); }
  return res;
}

export async function saveHorarios(horarioSemanal: Record<string, unknown>): Promise<Res> {
  await requireRole(["owner"]);
  const res = await updateClinic({ horario_semanal: horarioSemanal ?? {} });
  if (res.ok) { await logActivity({ action: "actualizó los horarios de atención", entity: "clinic" }); revalidatePath("/configuracion"); }
  return res;
}

export async function toggleHoliday(id: string, respetado: boolean): Promise<Res> {
  await requireRole(["owner"]);
  if (!isUuid(id)) return { ok: false, error: "Feriado inválido." };
  const supabase = createClient();
  const { error } = await supabase.from("clinic_holidays").update({ respetado: !!respetado }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar." };
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function saveCitasConfig(config: Record<string, unknown>, plantilla: string): Promise<Res> {
  await requireRole(["owner"]);
  const res = await updateClinic({ citas_config: config ?? {}, recordatorio_plantilla: clean(plantilla, 400) });
  if (res.ok) { await logActivity({ action: "actualizó la configuración de citas", entity: "clinic" }); revalidatePath("/configuracion"); }
  return res;
}

export async function updateTreatmentPrice(id: string, precio: number): Promise<Res> {
  await requireRole(["owner"]);
  if (!isUuid(id)) return { ok: false, error: "Tratamiento inválido." };
  const p = Math.max(0, Math.round(Number(precio) * 100) / 100);
  const supabase = createClient();
  const { error } = await supabase.from("treatments").update({ precio: p, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar el precio." };
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function bulkAdjustCategory(categoria: string, pct: number): Promise<Res & { count?: number }> {
  await requireRole(["owner"]);
  const factor = 1 + Number(pct) / 100;
  if (!Number.isFinite(factor) || factor <= 0) return { ok: false, error: "Ajuste inválido." };
  const supabase = createClient();
  const { data } = await supabase.from("treatments").select("id, precio").eq("categoria", categoria);
  const rows = (data ?? []) as { id: string; precio: number }[];
  for (const r of rows) {
    const nuevo = Math.round(Number(r.precio) * factor * 100) / 100;
    await supabase.from("treatments").update({ precio: nuevo, updated_at: new Date().toISOString() }).eq("id", r.id);
  }
  await logActivity({ action: `ajustó los precios de ${categoria} en ${pct}%`, entity: "treatment" });
  revalidatePath("/configuracion");
  return { ok: true, count: rows.length };
}

export async function changeUserRole(id: string, rol: string): Promise<Res> {
  await requireRole(["owner"]);
  if (!isUuid(id) || !["owner", "dentista", "recepcionista", "asistente"].includes(rol))
    return { ok: false, error: "Datos inválidos." };
  const supabase = createClient();
  const { error } = await supabase.from("app_users").update({ rol }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo cambiar el rol." };
  await logActivity({ action: `cambió el rol de un usuario a ${rol}`, entity: "app_user" });
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function toggleUserActive(id: string, estado: "activo" | "inactivo"): Promise<Res> {
  await requireRole(["owner"]);
  if (!isUuid(id)) return { ok: false, error: "Usuario inválido." };
  const supabase = createClient();
  const { error } = await supabase.from("app_users").update({ estado }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar." };
  await logActivity({ action: `${estado === "activo" ? "activó" : "desactivó"} un usuario`, entity: "app_user" });
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function forceLogout(id: string): Promise<Res> {
  await requireRole(["owner"]);
  if (!isUuid(id)) return { ok: false, error: "Usuario inválido." };
  const supabase = createClient();
  await supabase.from("app_users").update({ ultimo_acceso: null }).eq("id", id);
  await logActivity({ action: "forzó el cierre de sesión de un usuario", entity: "app_user" });
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function savePrivacy(nivel: "completo" | "inicial" | "solo_nombre"): Promise<Res> {
  await requireRole(["owner"]);
  if (!["completo", "inicial", "solo_nombre"].includes(nivel)) return { ok: false, error: "Nivel inválido." };
  const res = await updateClinic({ nivel_privacidad: nivel, apellido_inicial: nivel === "inicial" });
  if (res.ok) revalidatePath("/configuracion");
  return res;
}

export async function saveWelcome(mensaje: string): Promise<Res> {
  await requireRole(["owner"]);
  const res = await updateClinic({ mensaje_bienvenida: clean(mensaje, 200) });
  if (res.ok) revalidatePath("/configuracion");
  return res;
}

export async function toggleWaitingContent(id: string, activo: boolean): Promise<Res> {
  await requireRole(["owner"]);
  if (!isUuid(id)) return { ok: false, error: "Contenido inválido." };
  const supabase = createClient();
  const { error } = await supabase.from("waiting_room_content").update({ activo: !!activo }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar." };
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function genScreenToken(nombre: string): Promise<Res & { token?: string }> {
  await requireRole(["owner"]);
  const rand = () => Math.floor(1000 + Math.random() * 9000);
  const token = `SALA-${rand()}-${rand()}`;
  const supabase = createClient();
  const { error } = await supabase.from("screen_tokens").insert({ token, nombre: clean(nombre, 60) || "Pantalla" });
  if (error) return { ok: false, error: "No se pudo generar el token." };
  await logActivity({ action: "generó un token de pantalla de sala", entity: "screen" });
  revalidatePath("/configuracion");
  return { ok: true, token };
}

export async function revokeScreenToken(id: string): Promise<Res> {
  await requireRole(["owner"]);
  if (!isUuid(id)) return { ok: false, error: "Token inválido." };
  const supabase = createClient();
  const { error } = await supabase.from("screen_tokens").update({ activo: false }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo revocar." };
  await logActivity({ action: "revocó un token de pantalla de sala", entity: "screen" });
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function updateNcf(tipo: string, actual: number, final: number): Promise<Res> {
  await requireRole(["owner"]);
  if (!["B01", "B02"].includes(tipo)) return { ok: false, error: "Tipo inválido." };
  const a = Math.max(0, Math.floor(Number(actual)));
  const f = Math.max(a, Math.floor(Number(final)));
  const supabase = createClient();
  const { error } = await supabase.from("ncf_sequences").update({ secuencia_actual: a, secuencia_final: f }).eq("tipo", tipo);
  if (error) return { ok: false, error: "No se pudo actualizar la secuencia." };
  await logActivity({ action: `actualizó la secuencia NCF ${tipo}`, entity: "ncf" });
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function saveNcfUmbral(umbral: number): Promise<Res> {
  await requireRole(["owner"]);
  const u = Math.max(0, Math.floor(Number(umbral)));
  const res = await updateClinic({ ncf_alerta_umbral: u });
  if (res.ok) revalidatePath("/configuracion");
  return res;
}
