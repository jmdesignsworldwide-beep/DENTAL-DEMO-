import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/app/(app)/tratamientos/categoria-config";

export interface Treatment {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: Categoria;
  duracion_min: number;
  precio: number;
  activo: boolean;
}

export interface CatalogItem {
  id: string;
  nombre: string;
  precio: number;
  duracion_min: number;
  categoria: Categoria;
}

export async function listTreatments(): Promise<Treatment[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("treatments")
      .select("id, nombre, descripcion, categoria, duracion_min, precio, activo")
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      nombre: r.nombre as string,
      descripcion: (r.descripcion as string | null) ?? null,
      categoria: r.categoria as Categoria,
      duracion_min: (r.duracion_min as number) ?? 30,
      precio: Number(r.precio),
      activo: !!r.activo,
    }));
  } catch {
    return [];
  }
}

/** Solo tratamientos activos, para selectores de citas y factura. */
export async function listCatalog(): Promise<CatalogItem[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("treatments")
      .select("id, nombre, precio, duracion_min, categoria")
      .eq("activo", true)
      .order("nombre", { ascending: true });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      nombre: r.nombre as string,
      precio: Number(r.precio),
      duracion_min: (r.duracion_min as number) ?? 30,
      categoria: r.categoria as Categoria,
    }));
  } catch {
    return [];
  }
}
