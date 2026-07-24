"use client";

import * as React from "react";
import { Clock, MessageCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Contacto del proveedor (editable). Se muestra al prospecto cuando su acceso vence.
const CONTACTO = {
  marca: "JM Nexus Designs",
  whatsapp: "18090000000", // formato wa.me (1 + 10 dígitos)
  whatsappLabel: "809-000-0000",
  email: "jm.designs.worldwide@gmail.com",
};

/**
 * Se muestra cuando una cuenta demo VENCIDA intenta entrar
 * (/login?error=demo_expirado). Cierra la sesión atascada y presenta el
 * contacto del proveedor para renovar el acceso.
 */
export function DemoExpiredNotice() {
  React.useEffect(() => {
    createClient()
      .auth.signOut()
      .catch(() => {});
  }, []);

  const msg = encodeURIComponent(
    "Hola, mi acceso de demostración al sistema dental venció. Me gustaría renovarlo o conversar sobre el sistema.",
  );

  return (
    <div className="mb-5 rounded-2xl border border-amber/30 bg-amber/10 p-4">
      <div className="flex items-start gap-2.5">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
        <div>
          <p className="text-sm font-bold text-fg">Tu acceso de demostración venció</p>
          <p className="mt-1 text-sm text-muted">
            Gracias por probar el sistema. Para reactivar tu acceso o conversar sobre una
            implementación, contáctanos en <span className="font-semibold text-fg">{CONTACTO.marca}</span>:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/${CONTACTO.whatsapp}?text=${msg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105"
            >
              <MessageCircle className="h-4 w-4" />
              {CONTACTO.whatsappLabel}
            </a>
            <a
              href={`mailto:${CONTACTO.email}?subject=${encodeURIComponent("Renovar acceso demo — Sistema Dental")}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-fg hover:bg-surface-2"
            >
              <Mail className="h-4 w-4" />
              Escribir correo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
