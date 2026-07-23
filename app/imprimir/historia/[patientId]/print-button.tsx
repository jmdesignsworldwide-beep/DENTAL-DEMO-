"use client";

import * as React from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function PrintBar({ patientId }: { patientId: string }) {
  React.useEffect(() => {
    // Auto-abre el diálogo de impresión (Guardar como PDF) al cargar.
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between print:hidden">
      <Link
        href={`/historia/${patientId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-clinical px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,102,204,0.35)] hover:bg-clinical-600"
      >
        <Printer className="h-4 w-4" />
        Imprimir / Guardar PDF
      </button>
    </div>
  );
}
