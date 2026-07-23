import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  InvoiceEstado,
  MetodoPago,
} from "@/app/(app)/facturacion/estado-config";

export interface InvoiceRow {
  id: string;
  ncf: string | null;
  tipo_ncf: string;
  fecha: string;
  total: number;
  estado: InvoiceEstado;
  metodo_pago: MetodoPago | null;
  patient_id: string;
  paciente: string;
}

export interface InvoiceItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento_item: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  metodo: MetodoPago;
  monto: number;
  referencia: string | null;
  fecha: string;
}

export interface InvoiceFull extends InvoiceRow {
  subtotal: number;
  descuento_global: number;
  itbis: number;
  notas: string | null;
  motivo_cancelacion: string | null;
  paciente_telefono: string | null;
  paciente_cedula: string | null;
  items: InvoiceItem[];
  payments: Payment[];
  pagado: number;
  saldo: number;
}

export interface ListParams {
  q?: string;
  estado?: InvoiceEstado | "todos";
  metodo?: MetodoPago | "todos";
  desde?: string;
  hasta?: string;
  page?: number;
}

export const PAGE_SIZE = 15;

function sanitize(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
}

function nombreOf(p: unknown): string {
  if (Array.isArray(p)) return p[0]?.nombre ?? "Paciente";
  if (p && typeof p === "object" && "nombre" in p)
    return (p as { nombre: string }).nombre;
  return "Paciente";
}

export async function listInvoices(params: ListParams): Promise<{
  rows: InvoiceRow[];
  total: number;
  page: number;
  pageCount: number;
  periodo: { count: number; total: number; cobrado: number };
}> {
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const empty = {
    rows: [],
    total: 0,
    page,
    pageCount: 1,
    periodo: { count: 0, total: 0, cobrado: 0 },
  };

  try {
    const supabase = createClient();

    // IDs de pacientes que coinciden con la búsqueda por nombre.
    let patientIds: string[] | null = null;
    let ncfLike: string | null = null;
    if (params.q) {
      const q = sanitize(params.q);
      if (q) {
        ncfLike = q;
        const { data: pats } = await supabase
          .from("patients")
          .select("id")
          .ilike("nombre", `%${q}%`)
          .limit(200);
        patientIds = (pats ?? []).map((p) => p.id as string);
      }
    }

    const applyFilters = (qb: any): any => {
      let x = qb;
      if (params.estado && params.estado !== "todos") x = x.eq("estado", params.estado);
      if (params.metodo && params.metodo !== "todos") x = x.eq("metodo_pago", params.metodo);
      if (params.desde) x = x.gte("fecha", params.desde);
      if (params.hasta) x = x.lte("fecha", params.hasta);
      if (ncfLike !== null) {
        const ors = [`ncf.ilike.%${ncfLike}%`];
        if (patientIds && patientIds.length)
          ors.push(`patient_id.in.(${patientIds.join(",")})`);
        x = x.or(ors.join(","));
      }
      return x;
    };

    // Totales del período (sobre el conjunto filtrado completo).
    const totalsRes = await applyFilters(
      supabase.from("invoices").select("total, estado"),
    );
    const totRows = (totalsRes.data ?? []) as { total: number; estado: string }[];
    const periodo = {
      count: totRows.length,
      total: totRows
        .filter((r) => r.estado !== "anulada")
        .reduce((a, r) => a + Number(r.total), 0),
      cobrado: totRows
        .filter((r) => r.estado === "pagada")
        .reduce((a, r) => a + Number(r.total), 0),
    };

    // Página.
    const pageRes = await applyFilters(
      supabase
        .from("invoices")
        .select(
          "id, ncf, tipo_ncf, fecha, total, estado, metodo_pago, patient_id, patients(nombre)",
          { count: "exact" },
        ),
    )
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    const rows: InvoiceRow[] = ((pageRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      ncf: (r.ncf as string | null) ?? null,
      tipo_ncf: (r.tipo_ncf as string) ?? "B02",
      fecha: r.fecha as string,
      total: Number(r.total),
      estado: r.estado as InvoiceEstado,
      metodo_pago: (r.metodo_pago as MetodoPago | null) ?? null,
      patient_id: r.patient_id as string,
      paciente: nombreOf((r as { patients: unknown }).patients),
    }));

    const total = pageRes.count ?? rows.length;
    return {
      rows,
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      periodo,
    };
  } catch {
    return empty;
  }
}

export async function getInvoice(id: string): Promise<InvoiceFull | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, ncf, tipo_ncf, fecha, subtotal, descuento_global, itbis, total, estado, metodo_pago, notas, motivo_cancelacion, patient_id, patients(nombre, telefono, cedula), invoice_items(id, descripcion, cantidad, precio_unitario, descuento_item, subtotal), payments(id, metodo, monto, referencia, fecha)",
      )
      .eq("id", id)
      .single();
    if (error || !data) return null;

    const pat = (data as { patients: unknown }).patients as
      | { nombre: string; telefono: string | null; cedula: string | null }
      | null;
    const items = ((data as { invoice_items?: InvoiceItem[] }).invoice_items ?? []) as InvoiceItem[];
    const payments = ((data as { payments?: Payment[] }).payments ?? []) as Payment[];
    const pagado = payments.reduce((a, p) => a + Number(p.monto), 0);
    const total = Number(data.total);

    return {
      id: data.id as string,
      ncf: (data.ncf as string | null) ?? null,
      tipo_ncf: (data.tipo_ncf as string) ?? "B02",
      fecha: data.fecha as string,
      subtotal: Number(data.subtotal),
      descuento_global: Number(data.descuento_global),
      itbis: Number(data.itbis),
      total,
      estado: data.estado as InvoiceEstado,
      metodo_pago: (data.metodo_pago as MetodoPago | null) ?? null,
      notas: (data.notas as string | null) ?? null,
      motivo_cancelacion: (data.motivo_cancelacion as string | null) ?? null,
      patient_id: data.patient_id as string,
      paciente: pat?.nombre ?? "Paciente",
      paciente_telefono: pat?.telefono ?? null,
      paciente_cedula: pat?.cedula ?? null,
      items,
      payments,
      pagado,
      saldo: Math.max(0, Number((total - pagado).toFixed(2))),
    };
  } catch {
    return null;
  }
}
