export type InvoiceEstado = "pendiente" | "pagada" | "pagada_parcial" | "anulada";
export type MetodoPago = "efectivo" | "transferencia" | "tarjeta" | "seguro" | "mixto";

export const ESTADO_FACTURA: Record<
  InvoiceEstado,
  { label: string; badge: string; dot: string }
> = {
  pendiente: {
    label: "Pendiente",
    badge: "bg-amber/10 text-amber ring-amber/30",
    dot: "bg-amber",
  },
  pagada: {
    label: "Pagada",
    badge: "bg-mint/10 text-mint ring-mint/30",
    dot: "bg-mint",
  },
  pagada_parcial: {
    label: "Pagada parcial",
    badge: "bg-clinical-50 text-clinical-700 ring-clinical-200 dark:bg-clinical-900/40 dark:text-clinical-200 dark:ring-clinical-700/50",
    dot: "bg-clinical",
  },
  anulada: {
    label: "Anulada",
    badge: "bg-danger/10 text-danger ring-danger/30",
    dot: "bg-danger",
  },
};

export const METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  seguro: "Seguro médico",
  mixto: "Pago mixto",
};

export const METODOS: MetodoPago[] = [
  "efectivo",
  "transferencia",
  "tarjeta",
  "seguro",
  "mixto",
];
