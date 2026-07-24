/**
 * ─── Capa de envío (abstracción de canal) ─────────────────────────────
 *
 * El módulo NO habla directo con WhatsApp/SMS/Email. Habla con esta capa.
 * Hoy, para el demo (y para el día uno de cualquier clínica sin cuenta de
 * WhatsApp Business API), el "envío" es un enlace `wa.me` que abre WhatsApp
 * con el mensaje y el número ya cargados: un clic y sale.
 *
 * Conectar la WhatsApp Business API (o Twilio, o un SMTP) el día de mañana
 * es implementar un `MessageChannel.dispatch` que haga el POST real y
 * devuelva `{ mode: "api", ... }` — sin tocar el resto del módulo. La cola,
 * la bitácora, el opt-out y las plantillas siguen igual.
 *
 * Client-safe: sin `server-only`, sin secretos. Solo construye destinos.
 */

export type Canal = "whatsapp" | "sms" | "email";

export interface DispatchResult {
  /** "link" = abrir una app externa (manual); "api" = ya enviado por backend. */
  mode: "link" | "api";
  /** URL a abrir cuando mode === "link". */
  url?: string;
  ok: boolean;
  error?: string;
}

export interface MessageToDispatch {
  canal: Canal;
  destinatario: string; // teléfono o correo
  cuerpo: string;
  asunto?: string | null;
}

/** Normaliza un teléfono dominicano a formato internacional para wa.me (1 + 10). */
export function normalizePhone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const d = tel.replace(/\D/g, "");
  if (d.length === 10) return `1${d}`;
  if (d.length === 11 && d.startsWith("1")) return d;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

export interface MessageChannel {
  dispatch(msg: MessageToDispatch): DispatchResult;
}

/**
 * Canal por defecto: enlaces `wa.me` / `sms:` / `mailto:`. Manual pero 100%
 * funcional desde el día uno. Reemplazar por un canal-API es cambiar esta
 * implementación, no el módulo.
 */
export const LinkChannel: MessageChannel = {
  dispatch(msg) {
    const text = encodeURIComponent(msg.cuerpo);
    if (msg.canal === "whatsapp") {
      const num = normalizePhone(msg.destinatario);
      if (!num) return { mode: "link", ok: false, error: "Teléfono inválido para WhatsApp." };
      return { mode: "link", ok: true, url: `https://wa.me/${num}?text=${text}` };
    }
    if (msg.canal === "sms") {
      const num = normalizePhone(msg.destinatario);
      if (!num) return { mode: "link", ok: false, error: "Teléfono inválido para SMS." };
      return { mode: "link", ok: true, url: `sms:+${num}?&body=${text}` };
    }
    // email
    const subject = encodeURIComponent(msg.asunto ?? "Clínica Dental");
    return {
      mode: "link",
      ok: true,
      url: `mailto:${msg.destinatario}?subject=${subject}&body=${text}`,
    };
  },
};

/** Punto único de despacho. Cambiar `LinkChannel` por un canal-API aquí. */
export function dispatchMessage(msg: MessageToDispatch): DispatchResult {
  return LinkChannel.dispatch(msg);
}
