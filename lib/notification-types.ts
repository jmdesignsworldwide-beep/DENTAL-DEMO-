// Catálogo de tipos de notificación (datos puros, sin iconos — los iconos
// se mapean en el cliente para respetar la frontera RSC).

export type Prioridad = "alta" | "media" | "baja";
export type Canal = "in_app" | "email" | "whatsapp";

export interface NotifType {
  tipo: string;
  label: string;
  color: string;
  prioridad: Prioridad;
  /** Acción rápida disponible en la notificación. */
  accion?: "pasar_sillon" | "recordatorio_wa" | "registrar_reposicion";
  /** Verbo para agrupar en plural, ej. "pacientes en sala de espera". */
  grupo?: string;
}

export const NOTIF_TYPES: Record<string, NotifType> = {
  cita_proxima: { tipo: "cita_proxima", label: "Cita en 1 hora", color: "#0066CC", prioridad: "alta", accion: "recordatorio_wa", grupo: "citas próximas" },
  sala_espera: { tipo: "sala_espera", label: "Paciente en sala de espera", color: "#00C896", prioridad: "alta", accion: "pasar_sillon", grupo: "pacientes en sala de espera" },
  pago_recibido: { tipo: "pago_recibido", label: "Pago recibido", color: "#00C896", prioridad: "media", grupo: "pagos recibidos" },
  factura_vencida: { tipo: "factura_vencida", label: "Factura vencida", color: "#EF4444", prioridad: "alta", grupo: "facturas vencidas" },
  stock_bajo: { tipo: "stock_bajo", label: "Stock bajo", color: "#F59E0B", prioridad: "media", accion: "registrar_reposicion", grupo: "materiales bajo mínimo" },
  stock_agotado: { tipo: "stock_agotado", label: "Stock agotado", color: "#EF4444", prioridad: "alta", accion: "registrar_reposicion", grupo: "materiales agotados" },
  seguimiento: { tipo: "seguimiento", label: "Seguimiento pendiente", color: "#8B5CF6", prioridad: "media", grupo: "seguimientos pendientes" },
  cita_cancelada: { tipo: "cita_cancelada", label: "Cita cancelada / no-show", color: "#EF4444", prioridad: "media", grupo: "citas canceladas" },
  cumpleanos: { tipo: "cumpleanos", label: "Cumpleaños de paciente", color: "#C9A84C", prioridad: "baja", accion: "recordatorio_wa", grupo: "cumpleaños de hoy" },
  ncf_agotandose: { tipo: "ncf_agotandose", label: "NCF por agotarse", color: "#F59E0B", prioridad: "media", grupo: "secuencias NCF" },
};

export const NOTIF_TYPE_LIST: NotifType[] = Object.values(NOTIF_TYPES);

export const PRIORIDAD_PESO: Record<Prioridad, number> = { alta: 3, media: 2, baja: 1 };

export const CANAL_LABEL: Record<Canal, string> = {
  in_app: "En la app",
  email: "Correo",
  whatsapp: "WhatsApp",
};

export function typeMeta(tipo: string): NotifType {
  return (
    NOTIF_TYPES[tipo] ?? {
      tipo,
      label: "Notificación",
      color: "#94A3B8",
      prioridad: "media",
    }
  );
}
