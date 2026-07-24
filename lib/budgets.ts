import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getActiveUser, type Role } from "@/lib/auth";
import type {
  BudgetEstado,
  Prioridad,
  ItemEstado,
} from "@/app/(app)/presupuestos/estado-config";

const PAGE_SIZE = 12;

/** Roles que pueden ver diagnóstico y notas clínicas del plan. */
function canSeeClinical(rol: Role | null): boolean {
  return rol === "owner" || rol === "dentista";
}
/** Roles que arman/editan el presupuesto (ítems, precios). */
function canEditBudget(rol: Role | null): boolean {
  return rol === "owner" || rol === "dentista";
}

export interface BudgetListItem {
  id: string;
  paciente: string;
  paciente_id: string;
  titulo: string;
  estado: BudgetEstado;
  total_estimado: number;
  odontologo: string | null;
  fecha_vencimiento: string | null;
  created_at: string;
  presentado_at: string | null;
  version: number;
  es_version: boolean;
  items_count: number;
  /** días para el vencimiento (negativo = ya venció). null si no aplica. */
  expira_en: number | null;
}

export interface BudgetItemDTO {
  id: string;
  tratamiento_id: string | null;
  diente_fdi: number | null;
  superficie: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento_item: number;
  subtotal: number;
  duracion_min: number;
  prioridad: Prioridad;
  fase_nombre: string | null;
  opcion_grupo: string | null;
  orden: number;
  estado_item: ItemEstado;
  motivo_rechazo: string | null;
  cita_id: string | null;
  invoice_item_id: string | null;
}

export interface BudgetEventDTO {
  id: number;
  tipo: string;
  detalle: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface BudgetFull {
  id: string;
  paciente: string;
  paciente_id: string;
  paciente_cedula: string | null;
  paciente_telefono: string | null;
  titulo: string;
  diagnostico_general: string | null;
  estado: BudgetEstado;
  fecha_vencimiento: string | null;
  descuento_global: number;
  total_estimado: number;
  notas: string | null;
  motivo_rechazo: string | null;
  version: number;
  version_de: string | null;
  odontologo: string | null;
  created_at: string;
  presentado_at: string | null;
  respondido_at: string | null;
  items: BudgetItemDTO[];
  events: BudgetEventDTO[];
  canSeeClinical: boolean;
  canEdit: boolean;
}

export interface BudgetKPIs {
  montoPendiente: number;
  pendientesCount: number;
  tasaAceptacion: number; // %
  montoAceptado: number;
  aceptadosCount: number;
  totalCount: number;
}

function pickNombre(p: unknown): string {
  if (Array.isArray(p)) return p[0]?.nombre ?? "Paciente";
  if (p && typeof p === "object" && "nombre" in p)
    return (p as { nombre: string }).nombre;
  return "Paciente";
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export interface ListParams {
  q?: string;
  estado?: BudgetEstado | "todos";
  page?: number;
}

export async function listBudgets(
  params: ListParams,
): Promise<{ rows: BudgetListItem[]; total: number; page: number; pageCount: number }> {
  try {
    const supabase = createClient();
    const page = Math.max(1, params.page ?? 1);
    const from = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from("treatment_budgets")
      .select(
        "id, patient_id, titulo, estado, total_estimado, odontologo_nombre, fecha_vencimiento, created_at, presentado_at, version, version_de, patients(nombre), treatment_budget_items(count)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (params.estado && params.estado !== "todos") {
      query = query.eq("estado", params.estado);
    }
    if (params.q && params.q.trim()) {
      // Filtra por título; el filtro por paciente se hace tras el join.
      query = query.ilike("titulo", `%${params.q.trim()}%`);
    }

    const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error || !data) return { rows: [], total: 0, page: 1, pageCount: 1 };

    const rows: BudgetListItem[] = data.map((r) => {
      const itemsRel = (r as { treatment_budget_items?: { count: number }[] })
        .treatment_budget_items;
      const items_count = Array.isArray(itemsRel) ? itemsRel[0]?.count ?? 0 : 0;
      return {
        id: r.id as string,
        paciente: pickNombre((r as { patients: unknown }).patients),
        paciente_id: r.patient_id as string,
        titulo: r.titulo as string,
        estado: r.estado as BudgetEstado,
        total_estimado: Number(r.total_estimado),
        odontologo: (r.odontologo_nombre as string | null) ?? null,
        fecha_vencimiento: (r.fecha_vencimiento as string | null) ?? null,
        created_at: r.created_at as string,
        presentado_at: (r.presentado_at as string | null) ?? null,
        version: (r.version as number) ?? 1,
        es_version: !!r.version_de,
        items_count,
        expira_en: daysUntil((r.fecha_vencimiento as string | null) ?? null),
      };
    });

    const total = count ?? rows.length;
    return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  } catch {
    return { rows: [], total: 0, page: 1, pageCount: 1 };
  }
}

export async function getBudgetKPIs(): Promise<BudgetKPIs> {
  const empty: BudgetKPIs = {
    montoPendiente: 0,
    pendientesCount: 0,
    tasaAceptacion: 0,
    montoAceptado: 0,
    aceptadosCount: 0,
    totalCount: 0,
  };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("treatment_budgets")
      .select("estado, total_estimado");
    if (error || !data) return empty;

    const GANADO = new Set(["aceptado", "aceptado_parcial", "completado"]);
    const CERRADO = new Set([
      "aceptado",
      "aceptado_parcial",
      "completado",
      "rechazado",
      "vencido",
    ]);

    let montoPendiente = 0;
    let pendientesCount = 0;
    let montoAceptado = 0;
    let aceptadosCount = 0;
    let ganados = 0;
    let cerrados = 0;

    for (const r of data) {
      const estado = r.estado as string;
      const monto = Number(r.total_estimado);
      if (estado === "presentado") {
        montoPendiente += monto;
        pendientesCount += 1;
      }
      if (GANADO.has(estado)) {
        montoAceptado += monto;
        aceptadosCount += 1;
        ganados += 1;
      }
      if (CERRADO.has(estado)) cerrados += 1;
    }

    return {
      montoPendiente,
      pendientesCount,
      tasaAceptacion: cerrados === 0 ? 0 : Math.round((ganados / cerrados) * 100),
      montoAceptado,
      aceptadosCount,
      totalCount: data.length,
    };
  } catch {
    return empty;
  }
}

/** Suma de presupuestos presentados (pendientes de decisión) — para el dashboard. */
export async function getPendingBudgetAmount(): Promise<number> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("treatment_budgets")
      .select("total_estimado")
      .eq("estado", "presentado");
    if (error || !data) return 0;
    return data.reduce((a, r) => a + Number(r.total_estimado), 0);
  } catch {
    return 0;
  }
}

export async function getBudget(id: string): Promise<BudgetFull | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const user = await getActiveUser();
    const clinical = canSeeClinical(user?.rol ?? null);
    const edit = canEditBudget(user?.rol ?? null);
    const supabase = createClient();

    const { data: b, error } = await supabase
      .from("treatment_budgets")
      .select(
        "id, patient_id, titulo, estado, fecha_vencimiento, descuento_global, total_estimado, notas, motivo_rechazo, version, version_de, odontologo_nombre, created_at, presentado_at, respondido_at, patients(nombre, cedula, telefono)",
      )
      .eq("id", id)
      .single();
    if (error || !b) return null;

    // El diagnóstico clínico vive en una tabla aparte cuya RLS solo deja leer
    // a owner/dentista (endurecimiento Tanda 21). Recepción/asistente reciben
    // null desde la propia base de datos, no solo por filtro de la app.
    let diagnostico: string | null = null;
    if (clinical) {
      const { data: cl } = await supabase
        .from("treatment_budget_clinical")
        .select("diagnostico_general")
        .eq("budget_id", id)
        .maybeSingle();
      diagnostico = (cl?.diagnostico_general as string | null) ?? null;
    }

    const [itemsRes, eventsRes] = await Promise.all([
      supabase
        .from("treatment_budget_items")
        .select(
          "id, tratamiento_id, diente_fdi, superficie, descripcion, cantidad, precio_unitario, descuento_item, subtotal, duracion_min, prioridad, fase_nombre, opcion_grupo, orden, estado_item, motivo_rechazo, cita_id, invoice_item_id",
        )
        .eq("budget_id", id)
        .order("orden", { ascending: true }),
      supabase
        .from("treatment_budget_events")
        .select("id, tipo, detalle, meta, created_at")
        .eq("budget_id", id)
        .order("created_at", { ascending: false }),
    ]);

    const pac = (b as { patients: unknown }).patients as
      | { nombre?: string; cedula?: string | null; telefono?: string | null }
      | { nombre?: string; cedula?: string | null; telefono?: string | null }[]
      | null;
    const pacObj = Array.isArray(pac) ? pac[0] : pac;

    const items: BudgetItemDTO[] = (itemsRes.data ?? []).map((r) => ({
      id: r.id as string,
      tratamiento_id: (r.tratamiento_id as string | null) ?? null,
      diente_fdi: (r.diente_fdi as number | null) ?? null,
      superficie: (r.superficie as string | null) ?? null,
      descripcion: r.descripcion as string,
      cantidad: (r.cantidad as number) ?? 1,
      precio_unitario: Number(r.precio_unitario),
      descuento_item: Number(r.descuento_item),
      subtotal: Number(r.subtotal),
      duracion_min: (r.duracion_min as number) ?? 30,
      prioridad: r.prioridad as Prioridad,
      fase_nombre: (r.fase_nombre as string | null) ?? null,
      opcion_grupo: (r.opcion_grupo as string | null) ?? null,
      orden: (r.orden as number) ?? 0,
      estado_item: r.estado_item as ItemEstado,
      motivo_rechazo: (r.motivo_rechazo as string | null) ?? null,
      cita_id: (r.cita_id as string | null) ?? null,
      invoice_item_id: (r.invoice_item_id as string | null) ?? null,
    }));

    const events: BudgetEventDTO[] = (eventsRes.data ?? []).map((r) => ({
      id: r.id as number,
      tipo: r.tipo as string,
      detalle: (r.detalle as string | null) ?? null,
      meta: (r.meta ?? {}) as Record<string, unknown>,
      created_at: r.created_at as string,
    }));

    return {
      id: b.id as string,
      paciente: pacObj?.nombre ?? "Paciente",
      paciente_id: b.patient_id as string,
      paciente_cedula: pacObj?.cedula ?? null,
      paciente_telefono: pacObj?.telefono ?? null,
      titulo: b.titulo as string,
      diagnostico_general: diagnostico,
      estado: b.estado as BudgetEstado,
      fecha_vencimiento: (b.fecha_vencimiento as string | null) ?? null,
      descuento_global: Number(b.descuento_global),
      total_estimado: Number(b.total_estimado),
      notas: (b.notas as string | null) ?? null,
      motivo_rechazo: (b.motivo_rechazo as string | null) ?? null,
      version: (b.version as number) ?? 1,
      version_de: (b.version_de as string | null) ?? null,
      odontologo: (b.odontologo_nombre as string | null) ?? null,
      created_at: b.created_at as string,
      presentado_at: (b.presentado_at as string | null) ?? null,
      respondido_at: (b.respondido_at as string | null) ?? null,
      items,
      events,
      canSeeClinical: clinical,
      canEdit: edit,
    };
  } catch {
    return null;
  }
}
