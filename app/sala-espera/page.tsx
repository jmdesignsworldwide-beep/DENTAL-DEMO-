import type { Metadata } from "next";
import Link from "next/link";
import { MonitorPlay, Lock } from "lucide-react";
import { getActiveUser } from "@/lib/auth";
import {
  validateScreenToken,
  getWaitingScreenByToken,
  getWaitingScreenBySession,
} from "@/lib/waiting-room";
import { Aurora } from "@/components/brand/aurora";
import { LogoMark } from "@/components/brand/logo";
import { Kiosk } from "./kiosk";

export const metadata: Metadata = {
  title: "Sala de espera",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

type SearchParams = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SalaEsperaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = one(searchParams.token) ?? "";
  const tokenValid = token ? await validateScreenToken(token) : false;
  const user = tokenValid ? null : await getActiveUser();

  if (!tokenValid && !user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-6 text-center text-white">
        <Aurora />
        <LogoMark className="h-16 w-16" glow />
        <div className="mt-6 flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">
          <Lock className="h-4 w-4" /> Pantalla protegida
        </div>
        <h1 className="mt-5 max-w-md text-2xl font-extrabold tracking-tight">
          Esta pantalla requiere un token válido o una sesión del personal.
        </h1>
        <p className="mt-2 max-w-md text-sm text-white/70">
          El token de pantalla se genera desde Configuración y da acceso de solo
          lectura a los datos mínimos de la sala de espera.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-navy hover:bg-white/90"
        >
          <MonitorPlay className="h-4 w-4" /> Ingresar como personal
        </Link>
      </div>
    );
  }

  const data = tokenValid
    ? await getWaitingScreenByToken()
    : await getWaitingScreenBySession();

  const canControl = !!user && (user.rol === "owner" || user.rol === "recepcionista");
  const pollUrl = tokenValid ? `/api/sala-espera?token=${encodeURIComponent(token)}` : "/api/sala-espera";

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy text-white">
        <p className="text-lg">No se pudo cargar la sala de espera.</p>
      </div>
    );
  }

  return (
    <Kiosk
      initial={data}
      pollUrl={pollUrl}
      canControl={canControl}
      liveCapable={!tokenValid}
    />
  );
}
