"use client";

import Link from "next/link";
import { Home, Compass } from "lucide-react";
import { Aurora } from "@/components/brand/aurora";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-6 text-center">
      <Aurora />
      <LogoMark className="h-14 w-14" glow />
      <p className="mt-8 text-[64px] font-extrabold leading-none tracking-tight text-gradient-clinical">
        404
      </p>
      <h1 className="mt-2 text-xl font-bold text-fg">Página no encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        La ruta que buscas no existe o el módulo aún no está disponible en esta
        versión del sistema.
      </p>
      <div className="mt-7 flex gap-3">
        <Link href="/dashboard">
          <Button icon={Home}>Ir al Dashboard</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary" icon={Compass}>
            Ingresar
          </Button>
        </Link>
      </div>
    </div>
  );
}
