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
  /** Cuenta demo temporal (acceso para prospectos). */
  esDemo: boolean;
  /** Vencimiento del acceso demo (ISO) o null. */
  demoExpira: string | null;
  /** Owner REAL (owner y NO demo): único que ve config, usuarios y el panel de demos. */
  esRealOwner: boolean;
}

const CINCO_MIN = 5 * 60 * 1000;

/**
 * Puerta de entrada de TODA lógica de servidor protegida.
 * - Exige sesión válida y perfil `activo`.
 * - Si es una cuenta demo VENCIDA, redirige a /login?error=demo_expirado.
 *   (La expiración también está forzada en la DB: is_active()/my_role() la
 *   respetan, así que un demo vencido no puede consultar nada por API.)
 */
export async function requireActiveUser(): Promise<ActiveUser> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, nombre, rol, activo, avatar_url, es_demo, demo_expira_at, ultimo_acceso")
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.activo) {
    redirect("/login?error=inactivo");
  }

  const esDemo = !!profile.es_demo;
  const demoExpira = (profile.demo_expira_at as string | null) ?? null;
  if (esDemo && (!demoExpira || new Date(demoExpira).getTime() <= Date.now())) {
    redirect("/login?error=demo_expirado");
  }

  // Registra el último acceso (con throttle para no escribir en cada request).
  const last = profile.ultimo_acceso as string | null;
  if (!last || Date.now() - new Date(last).getTime() > CINCO_MIN) {
    await supabase
      .from("profiles")
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq("id", user.id);
  }

  return {
    id: profile.id,
    email: user.email ?? "",
    nombre: profile.nombre,
    rol: profile.rol as Role,
    activo: profile.activo,
    avatar_url: profile.avatar_url,
    esDemo,
    demoExpira,
    esRealOwner: profile.rol === "owner" && !esDemo,
  };
}

/**
 * Igual que requireActiveUser pero exige uno de los roles dados.
 * La autorización vive en el SERVIDOR — nunca sólo ocultando UI.
 */
export async function requireRole(roles: Role[]): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!roles.includes(user.rol)) {
    redirect("/dashboard?error=sin_permiso");
  }
  return user;
}

/**
 * Exige el owner REAL (owner y NO demo). Para Configuración, gestión de
 * usuarios y el panel de acceso demo. Un demo con rol 'owner' NO pasa.
 */
export async function requireRealOwner(): Promise<ActiveUser> {
  const user = await requireActiveUser();
  if (!user.esRealOwner) {
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
    .select("id, nombre, rol, activo, avatar_url, es_demo, demo_expira_at")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.activo) return null;

  const esDemo = !!profile.es_demo;
  const demoExpira = (profile.demo_expira_at as string | null) ?? null;
  if (esDemo && (!demoExpira || new Date(demoExpira).getTime() <= Date.now())) return null;

  return {
    id: profile.id,
    email: user.email ?? "",
    nombre: profile.nombre,
    rol: profile.rol as Role,
    activo: profile.activo,
    avatar_url: profile.avatar_url,
    esDemo,
    demoExpira,
    esRealOwner: profile.rol === "owner" && !esDemo,
  };
}
