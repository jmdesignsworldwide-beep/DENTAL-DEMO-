"use server";

import { revalidatePath } from "next/cache";
import { requireRealOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";

const UUID = /^[0-9a-f-]{36}$/i;

/** Calcula la fecha de expiración desde días (número) o una fecha ISO. */
function calcExpira(dias?: number, fecha?: string): string | null {
  if (fecha) {
    const d = new Date(`${fecha}T23:59:59`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const n = Math.max(1, Math.min(365, Math.floor(dias ?? 0)));
  if (!n) return null;
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function slugUsuario(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

export interface NuevaDemo {
  usuario: string;
  password: string;
  dias?: number;
  fecha?: string;
}

export async function createDemoAccount(
  data: NuevaDemo,
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const user = await requireRealOwner();
  const { ok } = rateLimit(`demo-write:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Demasiadas operaciones. Espera un momento." };

  const usuario = slugUsuario(data.usuario);
  if (usuario.length < 3) return { ok: false, error: "El usuario debe tener al menos 3 caracteres (letras/números)." };
  if (!data.password || data.password.length < 6)
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  const expira = calcExpira(data.dias, data.fecha);
  if (!expira) return { ok: false, error: "Indica los días de vigencia o una fecha válida." };
  if (new Date(expira).getTime() <= Date.now())
    return { ok: false, error: "La fecha de vigencia debe ser futura." };

  const email = `${usuario}@demo.local`;
  const admin = createAdminClient();

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    user_metadata: { nombre: `Demo — ${usuario}` },
  });
  if (cErr || !created?.user) {
    if ((cErr?.message ?? "").toLowerCase().includes("already"))
      return { ok: false, error: "Ese usuario ya existe. Usa otro nombre." };
    return { ok: false, error: "No se pudo crear la cuenta demo." };
  }

  // El trigger handle_new_user ya creó el perfil (inactivo). Lo convertimos en
  // cuenta demo activa con rol owner (ve todo) — el owner REAL sí puede.
  const supabase = createClient();
  const { error: uErr } = await supabase
    .from("profiles")
    .update({
      nombre: `Demo — ${usuario}`,
      rol: "owner",
      activo: true,
      es_demo: true,
      demo_expira_at: expira,
      demo_usuario: email,
      demo_creado_por: user.id,
    })
    .eq("id", created.user.id);
  if (uErr) {
    // Rollback: si no pudimos marcar el perfil, borramos el auth user.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return { ok: false, error: "No se pudo configurar la cuenta demo." };
  }

  await logActivity({
    action: `creó una cuenta demo (${email}) con vigencia hasta ${new Date(expira).toLocaleDateString("es-DO")}`,
    entity: "demo_account",
    entityId: created.user.id,
  });
  revalidatePath("/acceso-demos");
  return { ok: true, email };
}

export async function revokeDemoAccount(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRealOwner();
  if (!UUID.test(id)) return { ok: false, error: "Cuenta inválida." };
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ activo: false })
    .eq("id", id)
    .eq("es_demo", true);
  if (error) return { ok: false, error: "No se pudo revocar." };
  await logActivity({ action: "revocó una cuenta demo", entity: "demo_account", entityId: id });
  void user;
  revalidatePath("/acceso-demos");
  return { ok: true };
}

export async function extendDemoAccount(
  id: string,
  dias?: number,
  fecha?: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRealOwner();
  if (!UUID.test(id)) return { ok: false, error: "Cuenta inválida." };

  const supabase = createClient();
  const patch: Record<string, unknown> = { activo: true };
  if (fecha) {
    const e = calcExpira(undefined, fecha);
    if (!e) return { ok: false, error: "Fecha inválida." };
    patch.demo_expira_at = e;
  } else {
    // Extiende desde la expiración actual (o desde hoy si ya venció).
    const { data: cur } = await supabase
      .from("profiles")
      .select("demo_expira_at")
      .eq("id", id)
      .single();
    const base = cur?.demo_expira_at && new Date(cur.demo_expira_at as string).getTime() > Date.now()
      ? new Date(cur.demo_expira_at as string)
      : new Date();
    base.setDate(base.getDate() + Math.max(1, Math.min(365, Math.floor(dias ?? 7))));
    patch.demo_expira_at = base.toISOString();
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", id).eq("es_demo", true);
  if (error) return { ok: false, error: "No se pudo extender." };
  await logActivity({ action: "extendió la vigencia de una cuenta demo", entity: "demo_account", entityId: id });
  revalidatePath("/acceso-demos");
  return { ok: true };
}

export async function reseedDemoData(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRealOwner();
  const { ok } = rateLimit(`demo-reseed:${user.id}`, { limit: 5, windowMs: 60_000 });
  if (!ok) return { ok: false, error: "Espera un momento antes de volver a resembrar." };

  const supabase = createClient();
  const { error } = await supabase.rpc("reset_demo_data");
  if (error) return { ok: false, error: "No se pudo resembrar los datos." };

  await logActivity({ action: "resembró los datos de demostración a su estado limpio", entity: "demo_account" });
  revalidatePath("/");
  return { ok: true };
}
