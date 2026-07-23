"use client";

import {
  CalendarClock, Armchair, BadgeDollarSign, ReceiptText, PackageMinus, PackageX,
  Repeat, CalendarX, Cake, FileDigit, Bell, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  cita_proxima: CalendarClock,
  sala_espera: Armchair,
  pago_recibido: BadgeDollarSign,
  factura_vencida: ReceiptText,
  stock_bajo: PackageMinus,
  stock_agotado: PackageX,
  seguimiento: Repeat,
  cita_cancelada: CalendarX,
  cumpleanos: Cake,
  ncf_agotandose: FileDigit,
};

export function notifIcon(tipo: string): LucideIcon {
  return MAP[tipo] ?? Bell;
}
