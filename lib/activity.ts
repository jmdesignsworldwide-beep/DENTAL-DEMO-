import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Registra una entrada en activity_log. La tabla sólo permite INSERT/SELECT
 * a nivel de base de datos: DELETE y UPDATE están bloqueados. Auditoría
 * inmutable por diseño.
 */
export async function logActivity(params: {
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("activity_log").insert({
    actor_id: user?.id ?? null,
    action: params.action,
    entity: params.entity ?? null,
    entity_id: params.entityId ?? null,
    meta: params.meta ?? {},
  });
}
