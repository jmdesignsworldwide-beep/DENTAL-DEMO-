import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DemoEstado = "activa" | "expirada" | "revocada";

export interface DemoAccount {
  id: string;
  usuario: string; // email de login
  nombre: string;
  created_at: string | null;
  expira_at: string | null;
  ultimo_acceso: string | null;
  activo: boolean;
  dias_restantes: number | null;
  estado: DemoEstado;
}

function diasRestantes(expira: string | null): number | null {
  if (!expira) return null;
  return Math.ceil((new Date(expira).getTime() - Date.now()) / 86_400_000);
}

/**
 * Lista las cuentas demo. Usa el cliente admin porque necesita cruzar
 * `profiles` (es_demo, vigencia) con `auth.users` (email, alta) — auth.users
 * solo es accesible con service_role, en el servidor.
 */
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  try {
    const admin = createAdminClient();
    const { data: profs, error } = await admin
      .from("profiles")
      .select("id, nombre, activo, demo_expira_at, ultimo_acceso, demo_usuario, created_at")
      .eq("es_demo", true)
      .order("created_at", { ascending: false });
    if (error || !profs) return [];

    // Email real desde auth.users (fallback al demo_usuario guardado).
    const emailById = new Map<string, string>();
    try {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
      for (const u of list?.users ?? []) if (u.id && u.email) emailById.set(u.id, u.email);
    } catch {
      /* si falla, usamos demo_usuario */
    }

    return profs.map((p) => {
      const expira = (p.demo_expira_at as string | null) ?? null;
      const activo = !!p.activo;
      const vencida = !expira || new Date(expira).getTime() <= Date.now();
      const estado: DemoEstado = !activo ? "revocada" : vencida ? "expirada" : "activa";
      return {
        id: p.id as string,
        usuario: emailById.get(p.id as string) ?? (p.demo_usuario as string) ?? "—",
        nombre: (p.nombre as string) ?? "Demo",
        created_at: (p.created_at as string | null) ?? null,
        expira_at: expira,
        ultimo_acceso: (p.ultimo_acceso as string | null) ?? null,
        activo,
        dias_restantes: activo && !vencida ? diasRestantes(expira) : null,
        estado,
      };
    });
  } catch {
    return [];
  }
}
