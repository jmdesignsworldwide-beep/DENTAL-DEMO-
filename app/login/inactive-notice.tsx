"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Se muestra cuando requireActiveUser rebotó a /login?error=inactivo: el usuario
 * tiene sesión válida pero su perfil está inactivo (o pendiente de activación).
 * Limpia la sesión atascada para que no quede en un estado a medias y pueda
 * ingresar con otra cuenta. El middleware ya evita el bucle de redirección.
 */
export function InactiveNotice() {
  React.useEffect(() => {
    createClient()
      .auth.signOut()
      .catch(() => {});
  }, []);

  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber/10 p-3.5 text-sm text-amber">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Tu cuenta está <strong>inactiva o pendiente de activación</strong>. Pídele al
        administrador de la clínica que active tu acceso, y vuelve a ingresar.
      </span>
    </div>
  );
}
