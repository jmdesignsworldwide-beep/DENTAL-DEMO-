import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "dentista" | "recepcionista" | "asistente";

export interface ActiveUser {
  id: string;
  email: string;
  nombre: string;
  rol: Role;
  activo: boolean;
  avatar_url: string | null;
}

/**
 * Puerta de entrada de TODA lógica de servidor protegida.
 * - Exige sesión válida.
 * - Exige perfil existente y `activo = true`.
 * Si algo falla, redirige a /login. Nunca devuelve un usuario no válido.
 */
export async function requireActiveUser(): Promise<ActiveUser> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, nombre, rol, activo, avatar_url")
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.activo) {
    redirect("/login?error=inactivo");
  }

  return {
    id: profile.id,
    email: user.email ?? "",
    nombre: profile.nombre,
    rol: profile.rol as Role,
    activo: profile.activo,
    avatar_url: profile.avatar_url,
  };
}

/**
 * Igual que requireActiveUser pero además exige uno de los roles dados.
 * La autorización vive en el SERVIDOR — nunca sólo ocultando UI.
 */
export async function requireRole(
  roles: Role[],
): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!roles.includes(user.rol)) {
    redirect("/dashboard?error=sin_permiso");
  }
  return user;
}

/** Versión no-redirect para lecturas suaves (devuelve null si no hay sesión). */
export async function getActiveUser(): Promise<ActiveUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nombre, rol, activo, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.activo) return null;

  return {
    id: profile.id,
    email: user.email ?? "",
    nombre: profile.nombre,
    rol: profile.rol as Role,
    activo: profile.activo,
    avatar_url: profile.avatar_url,
  };
}
