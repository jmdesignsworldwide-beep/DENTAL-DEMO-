"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw, Home, AlertTriangle } from "lucide-react";
import { Aurora } from "@/components/brand/aurora";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    // En producción esto iría a un servicio de observabilidad.
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-6 text-center">
      <Aurora />
      <LogoMark className="h-14 w-14" glow />
      <span className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 text-amber">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-xl font-bold text-fg">Algo salió mal</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Ocurrió un error inesperado al cargar esta sección. Puedes reintentar o volver al inicio.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-muted/70">Ref: {error.digest}</p>
      )}
      <div className="mt-7 flex gap-3">
        <Button icon={RotateCcw} onClick={() => reset()}>
          Reintentar
        </Button>
        <Link href="/dashboard">
          <Button variant="secondary" icon={Home}>
            Ir al Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
