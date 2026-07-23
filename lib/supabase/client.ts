"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de navegador. Usa ANON key pública — toda la protección
 * real vive en RLS del lado de la base de datos.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
