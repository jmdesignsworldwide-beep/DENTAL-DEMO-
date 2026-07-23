import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente ADMIN con service_role. SOLO SERVIDOR.
 * `import "server-only"` garantiza que jamás se filtre al bundle del cliente.
 *
 * Úsalo únicamente para operaciones que legítimamente deben saltar RLS
 * (p.ej. jobs de sistema). Nunca para responder a input del usuario sin
 * antes validar permisos con requireActiveUser().
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente — el cliente admin requiere entorno de servidor.",
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
