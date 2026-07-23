import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MaterialCategoria } from "@/app/(app)/inventario/categoria-config";

export interface Supplier {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
}

export interface Material {
  id: string;
  nombre: string;
  categoria: MaterialCategoria;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario: number;
  proveedor_id: string | null;
  proveedor: string | null;
  ultima_reposicion: string | null;
}

export interface ConsumoItem {
  material_id: string;
  nombre: string;
  cantidad: number;
}

export interface Receta {
  treatment: string;
  materiales: { nombre: string; cantidad: number }[];
}

export interface InventoryData {
  materials: Material[];
  suppliers: Supplier[];
  consumoMes: ConsumoItem[];
  recetas: Receta[];
  valorTotal: number;
  bajoMinimo: number;
}

export async function getInventory(): Promise<InventoryData> {
  const empty: InventoryData = {
    materials: [],
    suppliers: [],
    consumoMes: [],
    recetas: [],
    valorTotal: 0,
    bajoMinimo: 0,
  };
  try {
    const supabase = createClient();
    const monthStart = (() => {
      const n = new Date();
      return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1))
        .toISOString()
        .slice(0, 10);
    })();

    const [matRes, supRes, movRes, recRes] = await Promise.all([
      supabase
        .from("materials")
        .select(
          "id, nombre, categoria, unidad, stock_actual, stock_minimo, costo_unitario, proveedor_id, ultima_reposicion, suppliers(nombre)",
        )
        .eq("activo", true)
        .order("nombre", { ascending: true }),
      supabase
        .from("suppliers")
        .select("id, nombre, contacto, telefono")
        .eq("activo", true)
        .order("nombre", { ascending: true }),
      supabase
        .from("material_movements")
        .select("material_id, cantidad, materials(nombre)")
        .eq("tipo", "salida")
        .gte("fecha", monthStart),
      supabase
        .from("treatment_materials")
        .select("cantidad, treatments(nombre), materials(nombre)"),
    ]);

    const nameOf = (p: unknown): string | null => {
      if (Array.isArray(p)) return p[0]?.nombre ?? null;
      if (p && typeof p === "object" && "nombre" in p)
        return (p as { nombre: string }).nombre;
      return null;
    };

    const materials: Material[] = (matRes.data ?? []).map((r) => ({
      id: r.id as string,
      nombre: r.nombre as string,
      categoria: r.categoria as MaterialCategoria,
      unidad: r.unidad as string,
      stock_actual: Number(r.stock_actual),
      stock_minimo: Number(r.stock_minimo),
      costo_unitario: Number(r.costo_unitario),
      proveedor_id: (r.proveedor_id as string | null) ?? null,
      proveedor: nameOf((r as { suppliers: unknown }).suppliers),
      ultima_reposicion: (r.ultima_reposicion as string | null) ?? null,
    }));

    // Consumo del mes agrupado por material.
    const consMap = new Map<string, ConsumoItem>();
    for (const r of movRes.data ?? []) {
      const id = r.material_id as string;
      const nombre = nameOf((r as { materials: unknown }).materials) ?? "Material";
      const prev = consMap.get(id) ?? { material_id: id, nombre, cantidad: 0 };
      prev.cantidad += Number(r.cantidad);
      consMap.set(id, prev);
    }
    const consumoMes = Array.from(consMap.values()).sort((a, b) => b.cantidad - a.cantidad);

    // Recetas por tratamiento.
    const recMap = new Map<string, Receta>();
    for (const r of recRes.data ?? []) {
      const trat = nameOf((r as { treatments: unknown }).treatments);
      const mat = nameOf((r as { materials: unknown }).materials);
      if (!trat || !mat) continue;
      const rec = recMap.get(trat) ?? { treatment: trat, materiales: [] };
      rec.materiales.push({ nombre: mat, cantidad: Number(r.cantidad) });
      recMap.set(trat, rec);
    }

    const valorTotal = materials.reduce((a, m) => a + m.stock_actual * m.costo_unitario, 0);
    const bajoMinimo = materials.filter((m) => m.stock_actual <= m.stock_minimo).length;

    return {
      materials,
      suppliers: (supRes.data ?? []) as Supplier[],
      consumoMes,
      recetas: Array.from(recMap.values()),
      valorTotal,
      bajoMinimo,
    };
  } catch {
    return empty;
  }
}
