"use client";

import * as React from "react";
import Link from "next/link";
import { Printer, ArrowLeft, MessageCircle } from "lucide-react";
import { formatRD } from "@/lib/utils";

/** Normaliza un teléfono dominicano a formato wa.me (1 + 10 dígitos). */
function waNumber(tel: string | null): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return null;
}

export function PrintBar({
  budgetId,
  telefono,
  paciente,
  titulo,
  total,
}: {
  budgetId: string;
  telefono: string | null;
  paciente: string;
  titulo: string;
  total: number;
}) {
  React.useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  const wa = waNumber(telefono);
  const msg = encodeURIComponent(
    `Hola ${paciente}, le comparto su plan de tratamiento "${titulo}" por un total estimado de ${formatRD(
      total,
    )}. Cualquier duda, con gusto le atendemos. — Clínica Dental`,
  );

  return (
    <div className="mx-auto mb-6 flex max-w-2xl items-center justify-between gap-2 print:hidden">
      <Link
        href={`/presupuestos/${budgetId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>
      <div className="flex gap-2">
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${msg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] hover:brightness-105"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        )}
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-clinical px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,102,204,0.35)] hover:bg-clinical-600"
        >
          <Printer className="h-4 w-4" />
          Imprimir / Guardar PDF
        </button>
      </div>
    </div>
  );
}
