import {
  Clock,
  Send,
  CheckCheck,
  Eye,
  MessageSquareReply,
  XCircle,
  Ban,
  MessageCircle,
  Mail,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

export type MensajeEstado =
  | "programado"
  | "enviado"
  | "entregado"
  | "leido"
  | "respondido"
  | "fallido"
  | "cancelado";

export interface EstadoMsgConfig {
  label: string;
  icon: LucideIcon;
  chip: string;
  hex: string;
}

export const ESTADO_MENSAJE: Record<MensajeEstado, EstadoMsgConfig> = {
  programado: {
    label: "Programado",
    icon: Clock,
    chip: "bg-surface-2 text-muted ring-border",
    hex: "#64748B",
  },
  enviado: {
    label: "Enviado",
    icon: Send,
    chip: "bg-clinical/10 text-clinical ring-clinical/30",
    hex: "#0066CC",
  },
  entregado: {
    label: "Entregado",
    icon: CheckCheck,
    chip: "bg-clinical/10 text-clinical ring-clinical/30",
    hex: "#0066CC",
  },
  leido: {
    label: "Leído",
    icon: Eye,
    chip: "bg-ice text-clinical ring-clinical/20",
    hex: "#3391E6",
  },
  respondido: {
    label: "Respondió",
    icon: MessageSquareReply,
    chip: "bg-mint/10 text-mint ring-mint/30",
    hex: "#00C896",
  },
  fallido: {
    label: "Falló",
    icon: XCircle,
    chip: "bg-danger/10 text-danger ring-danger/30",
    hex: "#EF4444",
  },
  cancelado: {
    label: "Cancelado",
    icon: Ban,
    chip: "bg-surface-2 text-muted ring-border line-through",
    hex: "#94A3B8",
  },
};

export const ESTADOS_MSG_ORDEN: MensajeEstado[] = [
  "programado",
  "enviado",
  "entregado",
  "leido",
  "respondido",
  "fallido",
  "cancelado",
];

export type Canal = "whatsapp" | "sms" | "email";

export const CANAL: Record<Canal, { label: string; icon: LucideIcon; chip: string; hex: string; max: number }> = {
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    chip: "bg-[#25D366]/10 text-[#128C4B] ring-[#25D366]/30 dark:text-[#25D366]",
    hex: "#25D366",
    max: 1000,
  },
  sms: {
    label: "SMS",
    icon: Smartphone,
    chip: "bg-amber/10 text-amber ring-amber/30",
    hex: "#F59E0B",
    max: 160,
  },
  email: {
    label: "Correo",
    icon: Mail,
    chip: "bg-clinical/10 text-clinical ring-clinical/30",
    hex: "#0066CC",
    max: 5000,
  },
};

/** Variables que las plantillas pueden usar. Se validan contra esta lista. */
export const VARIABLES_DISPONIBLES = [
  "paciente",
  "primer_nombre",
  "fecha",
  "hora",
  "odontólogo",
  "tratamiento",
  "clínica",
  "teléfono_clínica",
  "dirección",
  "monto",
  "consultorio",
] as const;

export type Variable = (typeof VARIABLES_DISPONIBLES)[number];

/** Etiquetas legibles de cada tipo de automatización. */
export const TIPO_MENSAJE: Record<string, string> = {
  recordatorio_24h: "Recordatorio 24h",
  recordatorio_2h: "Recordatorio 2h",
  confirmacion_cita: "Confirmación de cita",
  cita_reagendada: "Cita reagendada",
  cita_cancelada: "Cita cancelada",
  post_tratamiento: "Post-tratamiento",
  higiene_6meses: "Higiene 6 meses",
  seguimiento_presupuesto: "Seguimiento presupuesto",
  factura_pendiente: "Factura pendiente",
  cumpleanos: "Cumpleaños",
  bienvenida: "Bienvenida",
  manual: "Manual",
};
