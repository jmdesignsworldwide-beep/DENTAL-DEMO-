"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { createInvoice } from "@/app/(app)/facturacion/actions";
import type { Prioridad } from "./estado-config";

const UUID = /^[0-9a-f-]{36}$/i;
const PRIORIDADES = ["urgente", "necesario", "electivo"];

function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Recalcula total_estimado = Σ subtotales − descuento global (nunca < 0). */
async function recomputeTotal(
  supabase: ReturnType<typeof createClient>,
  budgetId: string,
): Promise<void> {
  const { data: b } = await supabase
    .from("treatment_budgets")
    .select("descuento_global, treatment_budget_items(subtotal)")
    .eq("id", budgetId)
    .single();
  if (!b) return;
  const items = ((b as { treatment_budget_items?: { subtotal: number }[] })
    .treatment_budget_items ?? []) as { subtotal: number }[];
  const suma = items.reduce((a, i) => a + Number(i.subtotal), 0);
  const total = Math.max(0, money(suma - Number(b.descuento_global)));
  await supabase
    .from("treatment_budgets")
    .update({ total_estimado: total, updated_at: new Date().toISOString() })
    .eq("id", budgetId);
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  budgetId: string,
  tipo: string,
  detalle: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await supabase
    .from("treatment_budget_events")
    .insert({ budget_id: budgetId, tipo, detalle, meta });
}

// ─── Crear presupuesto ──────────────────────────────────────────────────
export interface NuevoPresupuesto {
  patientId: string;
  titulo: string;
  diagnostico?: string;
  odontologo?: string;
  /** dientes preseleccionados desde el odontograma (FDI) */
  dientes?: number[];
}

export async function createBudget(
  data: NuevoPresupuesto,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireRole(["owner", "dentista"]);
  const { ok } = rateLimit(`budget-write:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones. Intenta en un momento." };

  if (!UUID.test(data.patientId)) return { ok: false, error: "Selecciona un paciente." };
  const titulo = (data.titulo ?? "").trim().slice(0, 120) || "Plan de tratamiento";

  const supabase = createClient();
  const { data: b, error } = await supabase
    .from("treatment_budgets")
    .insert({
      patient_id: data.patientId,
      titulo,
      odontologo_id: user.id,
      odontologo_nombre: (data.odontologo ?? user.nombre).trim().slice(0, 120),
      estado: "borrador",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !b) return { ok: false, error: "No se pudo crear el presupuesto." };

  const budgetId = b.id as string;
  // El diagnóstico clínico va a su tabla protegida (solo owner/dentista).
  const diag = (data.diagnostico ?? "").trim().slice(0, 1000);
  if (diag) {
    await supabase
      .from("treatment_budget_clinical")
      .insert({ budget_id: budgetId, diagnostico_general: diag });
  }
  await logEvent(supabase, budgetId, "creado", "Presupuesto creado");
  await logActivity({
    action: `creó un presupuesto: ${titulo}`,
    entity: "budget",
    entityId: budgetId,
  });
  revalidatePath("/presupuestos");
  return { ok: true, id: budgetId };
}

// ─── Editar cabecera ────────────────────────────────────────────────────
export interface EditPresupuesto {
  titulo?: string;
  diagnostico?: string;
  descuento_global?: number;
  fecha_vencimiento?: string | null;
  notas?: string;
}

export async function updateBudgetMeta(
  id: string,
  data: EditPresupuesto,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["owner", "dentista"]);
  if (!UUID.test(id)) return { ok: false, error: "Presupuesto inválido." };

  const supabase = createClient();
  const { data: cur } = await supabase
    .from("treatment_budgets")
    .select("estado")
    .eq("id", id)
    .single();
  if (!cur) return { ok: false, error: "Presupuesto no encontrado." };
  if (["aceptado", "aceptado_parcial", "completado"].includes(cur.estado as string))
    return { ok: false, error: "Un plan aceptado no se edita: crea una versión nueva." };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.titulo !== undefined) patch.titulo = data.titulo.trim().slice(0, 120) || "Plan de tratamiento";
  if (data.notas !== undefined) patch.notas = data.notas.trim().slice(0, 1000) || null;
  if (data.descuento_global !== undefined)
    patch.descuento_global = Math.max(0, money(data.descuento_global));
  if (data.fecha_vencimiento !== undefined)
    patch.fecha_vencimiento = data.fecha_vencimiento || null;

  const { error } = await supabase.from("treatment_budgets").update(patch).eq("id", id);
  if (error) return { ok: false, error: "No se pudo guardar." };

  // El diagnóstico clínico se guarda en su tabla protegida (owner/dentista).
  if (data.diagnostico !== undefined) {
    await supabase.from("treatment_budget_clinical").upsert(
      {
        budget_id: id,
        diagnostico_general: data.diagnostico.trim().slice(0, 1000) || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "budget_id" },
    );
  }

  if (data.descuento_global !== undefined) await recomputeTotal(supabase, id);
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/presupuestos");
  return { ok: true };
}

// ─── Ítems ──────────────────────────────────────────────────────────────
export interface NuevoItemPresupuesto {
  tratamiento_id?: string | null;
  descripcion: string;
  diente_fdi?: number | null;
  superficie?: string | null;
  cantidad: number;
  precio_unitario: number;
  descuento_item?: number;
  duracion_min?: number;
  prioridad?: Prioridad;
  fase_nombre?: string | null;
  opcion_grupo?: string | null;
}

export async function addBudgetItem(
  budgetId: string,
  item: NuevoItemPresupuesto,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["owner", "dentista"]);
  const { ok } = rateLimit(`budget-write:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones." };
  if (!UUID.test(budgetId)) return { ok: false, error: "Presupuesto inválido." };

  const descripcion = (item.descripcion ?? "").trim().slice(0, 200);
  if (!descripcion) return { ok: false, error: "Describe el servicio." };
  const cantidad = Math.max(1, Math.floor(item.cantidad || 1));
  const precio = Math.max(0, money(item.precio_unitario));
  const desc = Math.max(0, money(item.descuento_item ?? 0));
  const subtotal = Math.max(0, money(precio * cantidad - desc));
  const prioridad = PRIORIDADES.includes(item.prioridad ?? "") ? item.prioridad : "necesario";

  const supabase = createClient();
  const { data: last } = await supabase
    .from("treatment_budget_items")
    .select("orden")
    .eq("budget_id", budgetId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((last?.orden as number | undefined) ?? 0) + 1;

  const { error } = await supabase.from("treatment_budget_items").insert({
    budget_id: budgetId,
    tratamiento_id:
      item.tratamiento_id && UUID.test(item.tratamiento_id) ? item.tratamiento_id : null,
    diente_fdi: item.diente_fdi ?? null,
    superficie: (item.superficie ?? "").trim().slice(0, 20) || null,
    descripcion,
    cantidad,
    precio_unitario: precio,
    descuento_item: desc,
    subtotal,
    duracion_min: Math.max(5, Math.floor(item.duracion_min ?? 30)),
    prioridad,
    fase_nombre: (item.fase_nombre ?? "").trim().slice(0, 60) || null,
    opcion_grupo: (item.opcion_grupo ?? "").trim().slice(0, 40) || null,
    orden,
    estado_item: "pendiente",
  });
  if (error) return { ok: false, error: "No se pudo agregar el servicio." };

  await recomputeTotal(supabase, budgetId);
  revalidatePath(`/presupuestos/${budgetId}`);
  return { ok: true };
}

export async function removeBudgetItem(
  budgetId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["owner", "dentista"]);
  if (!UUID.test(itemId) || !UUID.test(budgetId))
    return { ok: false, error: "Ítem inválido." };

  const supabase = createClient();
  const { error } = await supabase
    .from("treatment_budget_items")
    .delete()
    .eq("id", itemId)
    .eq("budget_id", budgetId);
  if (error) return { ok: false, error: "No se pudo eliminar (¿ya fue aceptado?)." };

  await recomputeTotal(supabase, budgetId);
  void user;
  revalidatePath(`/presupuestos/${budgetId}`);
  return { ok: true };
}

// ─── Presentar ──────────────────────────────────────────────────────────
export async function presentBudget(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["owner", "dentista"]);
  if (!UUID.test(id)) return { ok: false, error: "Presupuesto inválido." };

  const supabase = createClient();
  const { data: b } = await supabase
    .from("treatment_budgets")
    .select("estado, treatment_budget_items(count)")
    .eq("id", id)
    .single();
  if (!b) return { ok: false, error: "Presupuesto no encontrado." };
  const count = ((b as { treatment_budget_items?: { count: number }[] })
    .treatment_budget_items ?? [])[0]?.count ?? 0;
  if (count === 0) return { ok: false, error: "Agrega al menos un servicio antes de presentar." };
  if (b.estado !== "borrador" && b.estado !== "presentado")
    return { ok: false, error: "Este plan ya fue respondido." };

  const { error } = await supabase
    .from("treatment_budgets")
    .update({ estado: "presentado", presentado_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "No se pudo presentar." };

  await logEvent(supabase, id, "presentado", "Presentado al paciente");
  await logActivity({ action: "presentó un presupuesto al paciente", entity: "budget", entityId: id });
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/presupuestos");
  return { ok: true };
}

// ─── Responder (aceptar total/parcial o rechazar) ───────────────────────
export async function respondBudget(
  id: string,
  acceptedItemIds: string[],
  motivo?: string,
): Promise<{ ok: boolean; estado?: string; error?: string }> {
  const user = await requireRole(["owner", "dentista", "recepcionista"]);
  const { ok } = rateLimit(`budget-write:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones." };
  if (!UUID.test(id)) return { ok: false, error: "Presupuesto inválido." };

  const accepted = (acceptedItemIds ?? []).filter((x) => UUID.test(x));
  const supabase = createClient();

  const { data: items } = await supabase
    .from("treatment_budget_items")
    .select("id, estado_item")
    .eq("budget_id", id);
  if (!items) return { ok: false, error: "Presupuesto no encontrado." };

  const pendientes = items.filter((i) => i.estado_item === "pendiente");
  const acceptedSet = new Set(accepted);
  const toAccept = pendientes.filter((i) => acceptedSet.has(i.id as string));
  const toReject = pendientes.filter((i) => !acceptedSet.has(i.id as string));

  const motivoTxt = (motivo ?? "").trim().slice(0, 300) || null;

  if (toAccept.length > 0)
    await supabase
      .from("treatment_budget_items")
      .update({ estado_item: "aceptado" })
      .in("id", toAccept.map((i) => i.id));
  if (toReject.length > 0)
    await supabase
      .from("treatment_budget_items")
      .update({ estado_item: "rechazado", motivo_rechazo: motivoTxt })
      .in("id", toReject.map((i) => i.id));

  // Considera también ítems ya aceptados en respuestas previas.
  const yaAceptados = items.filter((i) => i.estado_item === "aceptado").length;
  const totalAceptados = yaAceptados + toAccept.length;
  const estado =
    totalAceptados === 0
      ? "rechazado"
      : toReject.length > 0
        ? "aceptado_parcial"
        : "aceptado";

  const patch: Record<string, unknown> = {
    estado,
    respondido_at: new Date().toISOString(),
  };
  if (estado === "rechazado") patch.motivo_rechazo = motivoTxt;

  const { error } = await supabase.from("treatment_budgets").update(patch).eq("id", id);
  if (error) return { ok: false, error: "No se pudo registrar la respuesta." };

  await logEvent(
    supabase,
    id,
    estado,
    estado === "rechazado"
      ? `Rechazado${motivoTxt ? ` — ${motivoTxt}` : ""}`
      : `Aceptó ${toAccept.length} servicio(s)`,
    { aceptados: totalAceptados, rechazados: toReject.length },
  );
  await logActivity({
    action:
      estado === "rechazado"
        ? "registró el rechazo de un presupuesto"
        : `registró la aceptación de un presupuesto (${estado})`,
    entity: "budget",
    entityId: id,
  });
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/presupuestos");
  return { ok: true, estado };
}

// ─── Generar citas desde los ítems aceptados ────────────────────────────
function nextBusinessDate(base: Date, addDays: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1); // salta domingos
  return d.toISOString().slice(0, 10);
}

export async function generateAppointmentsFromBudget(
  id: string,
): Promise<{ ok: boolean; creadas?: number; error?: string }> {
  const user = await requireRole(["owner", "dentista", "recepcionista"]);
  if (!UUID.test(id)) return { ok: false, error: "Presupuesto inválido." };

  const supabase = createClient();
  const { data: b } = await supabase
    .from("treatment_budgets")
    .select("patient_id, odontologo_nombre")
    .eq("id", id)
    .single();
  if (!b) return { ok: false, error: "Presupuesto no encontrado." };

  const { data: items } = await supabase
    .from("treatment_budget_items")
    .select("id, descripcion, tratamiento_id, duracion_min, estado_item, cita_id")
    .eq("budget_id", id)
    .eq("estado_item", "aceptado")
    .is("cita_id", null)
    .order("orden", { ascending: true });
  if (!items || items.length === 0)
    return { ok: false, error: "No hay servicios aceptados pendientes de agendar." };

  const dentista = (b.odontologo_nombre as string | null) ?? user.nombre;
  const now = new Date();
  let creadas = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    // Cada servicio en un día distinto → nunca solapa para el mismo odontólogo.
    const fecha = nextBusinessDate(now, i + 1);
    const { data: cita, error } = await supabase
      .from("appointments")
      .insert({
        patient_id: b.patient_id,
        dentista_nombre: dentista,
        fecha,
        hora: "09:00",
        duracion_min: Math.max(10, Math.min(480, (it.duracion_min as number) ?? 30)),
        tratamiento: (it.descripcion as string).slice(0, 120),
        tratamiento_id: (it.tratamiento_id as string | null) ?? null,
        estado: "pendiente",
        notas: "Generada desde presupuesto",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (!error && cita) {
      await supabase
        .from("treatment_budget_items")
        .update({ estado_item: "agendado", cita_id: cita.id })
        .eq("id", it.id);
      creadas += 1;
    }
  }

  if (creadas === 0) return { ok: false, error: "No se pudieron generar las citas." };
  await logEvent(supabase, id, "citas_generadas", `Se generaron ${creadas} cita(s)`, { creadas });
  await logActivity({
    action: `generó ${creadas} cita(s) desde un presupuesto`,
    entity: "budget",
    entityId: id,
  });
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/citas");
  return { ok: true, creadas };
}

// ─── Generar factura desde los ítems aceptados ──────────────────────────
export async function generateInvoiceFromBudget(
  id: string,
): Promise<{ ok: boolean; invoiceId?: string; error?: string }> {
  const user = await requireRole(["owner", "recepcionista"]);
  if (!UUID.test(id)) return { ok: false, error: "Presupuesto inválido." };

  const supabase = createClient();
  const { data: b } = await supabase
    .from("treatment_budgets")
    .select("patient_id, descuento_global, titulo")
    .eq("id", id)
    .single();
  if (!b) return { ok: false, error: "Presupuesto no encontrado." };

  const { data: items } = await supabase
    .from("treatment_budget_items")
    .select("descripcion, tratamiento_id, cantidad, precio_unitario, descuento_item, estado_item")
    .eq("budget_id", id)
    .in("estado_item", ["aceptado", "agendado", "completado"]);
  if (!items || items.length === 0)
    return { ok: false, error: "No hay servicios aceptados para facturar." };

  const res = await createInvoice({
    patientId: b.patient_id as string,
    tipo_ncf: "B02",
    descuento_global: Number(b.descuento_global),
    items: items.map((i) => ({
      descripcion: i.descripcion as string,
      cantidad: (i.cantidad as number) ?? 1,
      precio_unitario: Number(i.precio_unitario),
      descuento_item: Number(i.descuento_item),
      tratamiento_id: (i.tratamiento_id as string | null) ?? null,
    })),
    notas: `Generada desde presupuesto: ${(b.titulo as string) ?? ""}`.slice(0, 500),
  });
  if (!res.ok || !res.id) return { ok: false, error: res.error ?? "No se pudo facturar." };

  await logEvent(supabase, id, "factura_generada", "Factura emitida desde el presupuesto", {
    invoice_id: res.id,
  });
  await logActivity({
    action: "generó una factura desde un presupuesto",
    entity: "budget",
    entityId: id,
  });
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/facturacion");
  return { ok: true, invoiceId: res.id };
}

// ─── Marcar como completado ─────────────────────────────────────────────
export async function completeBudget(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(["owner", "dentista"]);
  if (!UUID.test(id)) return { ok: false, error: "Presupuesto inválido." };

  const supabase = createClient();
  await supabase
    .from("treatment_budget_items")
    .update({ estado_item: "completado" })
    .eq("budget_id", id)
    .in("estado_item", ["aceptado", "agendado"]);
  const { error } = await supabase
    .from("treatment_budgets")
    .update({ estado: "completado" })
    .eq("id", id)
    .in("estado", ["aceptado", "aceptado_parcial"]);
  if (error) return { ok: false, error: "No se pudo completar el plan." };

  await logEvent(supabase, id, "completado", "Tratamiento completado");
  await logActivity({ action: "marcó un presupuesto como completado", entity: "budget", entityId: id });
  void user;
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/presupuestos");
  return { ok: true };
}

// ─── Nueva versión (clona, sin sobrescribir el histórico) ───────────────
export async function newBudgetVersion(
  id: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireRole(["owner", "dentista"]);
  if (!UUID.test(id)) return { ok: false, error: "Presupuesto inválido." };

  const supabase = createClient();
  const { data: src } = await supabase
    .from("treatment_budgets")
    .select("patient_id, titulo, descuento_global, version, odontologo_nombre")
    .eq("id", id)
    .single();
  if (!src) return { ok: false, error: "Presupuesto no encontrado." };

  const { data: nb, error } = await supabase
    .from("treatment_budgets")
    .insert({
      patient_id: src.patient_id,
      titulo: `${(src.titulo as string).slice(0, 100)} (v${(src.version as number) + 1})`,
      descuento_global: src.descuento_global,
      odontologo_id: user.id,
      odontologo_nombre: src.odontologo_nombre ?? user.nombre,
      estado: "borrador",
      version: (src.version as number) + 1,
      version_de: id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !nb) return { ok: false, error: "No se pudo crear la versión." };
  const newId = nb.id as string;

  // Copia el diagnóstico clínico a la versión nueva (tabla protegida).
  const { data: cl } = await supabase
    .from("treatment_budget_clinical")
    .select("diagnostico_general")
    .eq("budget_id", id)
    .maybeSingle();
  if (cl?.diagnostico_general) {
    await supabase
      .from("treatment_budget_clinical")
      .insert({ budget_id: newId, diagnostico_general: cl.diagnostico_general });
  }

  // Clona los ítems (todos vuelven a 'pendiente').
  const { data: items } = await supabase
    .from("treatment_budget_items")
    .select(
      "tratamiento_id, diente_fdi, superficie, descripcion, cantidad, precio_unitario, descuento_item, subtotal, duracion_min, prioridad, fase_nombre, opcion_grupo, orden",
    )
    .eq("budget_id", id)
    .order("orden", { ascending: true });
  if (items && items.length > 0)
    await supabase.from("treatment_budget_items").insert(
      items.map((i) => ({ ...i, budget_id: newId, estado_item: "pendiente" })),
    );

  await recomputeTotal(supabase, newId);
  await logEvent(supabase, newId, "version_creada", "Nueva versión creada", {
    version: (src.version as number) + 1,
    version_de: id,
  });
  await logActivity({ action: "creó una nueva versión de un presupuesto", entity: "budget", entityId: newId });
  revalidatePath("/presupuestos");
  return { ok: true, id: newId };
}
