"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { ITBIS_RATE } from "@/lib/treatments-catalog";
import type { MetodoPago } from "./estado-config";

const WRITE_ROLES = ["owner", "recepcionista"] as const;
const METODOS = ["efectivo", "transferencia", "tarjeta", "seguro", "mixto"];

export interface NuevoItem {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento_item: number;
  tratamiento_id?: string | null;
}
export interface NuevaFactura {
  patientId: string;
  tipo_ncf: "B01" | "B02";
  descuento_global: number;
  items: NuevoItem[];
  notas: string;
  pago?: { metodo: MetodoPago; monto: number; referencia: string } | null;
}

function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function estadoDe(total: number, pagado: number): "pendiente" | "pagada" | "pagada_parcial" {
  if (pagado <= 0) return "pendiente";
  if (pagado + 0.01 >= total) return "pagada";
  return "pagada_parcial";
}

export async function createInvoice(
  data: NuevaFactura,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  const { ok } = rateLimit(`invoice-write:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones." };

  if (!/^[0-9a-f-]{36}$/i.test(data.patientId))
    return { ok: false, error: "Selecciona un paciente." };
  if (data.tipo_ncf !== "B01" && data.tipo_ncf !== "B02")
    return { ok: false, error: "Tipo de NCF inválido." };
  const items = (data.items ?? []).filter((i) => i.descripcion && i.precio_unitario >= 0 && i.cantidad > 0);
  if (items.length === 0) return { ok: false, error: "Agrega al menos un servicio." };

  const subtotal = money(
    items.reduce((a, i) => a + (money(i.precio_unitario) * i.cantidad - money(i.descuento_item)), 0),
  );
  const descGlobal = Math.min(money(data.descuento_global), subtotal);
  const base = money(subtotal - descGlobal);
  if (base < 0) return { ok: false, error: "El descuento supera el subtotal." };
  const itbis = money(base * ITBIS_RATE);
  const total = money(base + itbis);

  const supabase = createClient();

  // NCF atómico.
  const { data: ncf, error: ncfErr } = await supabase.rpc("next_ncf", { p_tipo: data.tipo_ncf });
  if (ncfErr || !ncf) return { ok: false, error: "No se pudo generar el NCF." };

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      patient_id: data.patientId,
      ncf: ncf as string,
      tipo_ncf: data.tipo_ncf,
      subtotal,
      descuento_global: descGlobal,
      itbis,
      total,
      monto: total,
      estado: "pendiente",
      metodo_pago: data.pago?.metodo ?? null,
      notas: (data.notas ?? "").trim().slice(0, 500) || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !inv) return { ok: false, error: "No se pudo crear la factura." };

  const itemRows = items.map((i) => ({
    invoice_id: inv.id,
    tratamiento_id:
      i.tratamiento_id && /^[0-9a-f-]{36}$/i.test(i.tratamiento_id) ? i.tratamiento_id : null,
    descripcion: i.descripcion.slice(0, 200),
    cantidad: i.cantidad,
    precio_unitario: money(i.precio_unitario),
    descuento_item: money(i.descuento_item),
    subtotal: money(money(i.precio_unitario) * i.cantidad - money(i.descuento_item)),
  }));
  await supabase.from("invoice_items").insert(itemRows);

  // Pago inicial opcional.
  let pagado = 0;
  if (data.pago && data.pago.monto > 0) {
    const p = data.pago;
    if (p.metodo === "transferencia" && !p.referencia.trim())
      return { ok: true, id: inv.id as string }; // factura creada; el pago requiere voucher, se registra luego
    const { error: payErr } = await supabase.from("payments").insert({
      invoice_id: inv.id,
      metodo: p.metodo,
      monto: money(p.monto),
      referencia: p.referencia.trim() || null,
      created_by: user.id,
    });
    if (!payErr) {
      pagado = money(p.monto);
      await supabase.from("invoices").update({ estado: estadoDe(total, pagado) }).eq("id", inv.id);
    }
  }

  await logActivity({
    action: `emitió la factura ${ncf} (RD$ ${total.toLocaleString("es-DO")})`,
    entity: "invoice",
    entityId: inv.id as string,
  });
  revalidatePath("/facturacion");
  return { ok: true, id: inv.id as string };
}

export async function addPayment(
  invoiceId: string,
  metodo: MetodoPago,
  monto: number,
  referencia: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return { ok: false, error: "Factura inválida." };
  if (!METODOS.includes(metodo)) return { ok: false, error: "Método inválido." };
  const m = money(monto);
  if (m <= 0) return { ok: false, error: "El monto debe ser mayor que cero." };
  if (metodo === "transferencia" && !referencia.trim())
    return { ok: false, error: "La transferencia requiere número de voucher." };

  const supabase = createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("total, estado, payments(monto)")
    .eq("id", invoiceId)
    .single();
  if (!inv) return { ok: false, error: "Factura no encontrada." };
  if (inv.estado === "anulada") return { ok: false, error: "La factura está anulada." };

  const pagadoPrev = ((inv as { payments?: { monto: number }[] }).payments ?? []).reduce(
    (a, p) => a + Number(p.monto),
    0,
  );
  const total = Number(inv.total);

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    metodo,
    monto: m,
    referencia: referencia.trim() || null,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ese voucher ya fue registrado." };
    return { ok: false, error: "No se pudo registrar el pago." };
  }

  await supabase
    .from("invoices")
    .update({ estado: estadoDe(total, money(pagadoPrev + m)) })
    .eq("id", invoiceId);

  await logActivity({
    action: `registró un pago de RD$ ${m.toLocaleString("es-DO")}`,
    entity: "invoice",
    entityId: invoiceId,
  });
  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${invoiceId}`);
  return { ok: true };
}

export async function cancelInvoice(
  invoiceId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole([...WRITE_ROLES]);
  const m = motivo.trim();
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return { ok: false, error: "Factura inválida." };
  if (m.length < 3) return { ok: false, error: "Indica el motivo de la anulación." };

  const supabase = createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ estado: "anulada", motivo_cancelacion: m.slice(0, 300) })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: "No se pudo anular la factura." };

  await logActivity({
    action: `anuló una factura — motivo: ${m.slice(0, 120)}`,
    entity: "invoice",
    entityId: invoiceId,
  });
  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${invoiceId}`);
  return { ok: true };
}
